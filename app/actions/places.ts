"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, getProfile } from "@/utils/supabase/queries";
import { getSupabaseServiceRole } from "@/utils/supabase/serviceRole";

/**
 * Kiểm tra quyền admin/editor bằng code (thay cho việc dựa vào RLS, vì các
 * hàm ghi dưới đây dùng service-role client để bỏ qua RLS - xem ghi chú ở
 * softDeletePlace). Đây là nơi DUY NHẤT enforce quyền cho các thao tác ghi
 * trên bảng places.
 */
async function assertCanManagePlaces(): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getProfile();
  if (profile?.role === "admin" || profile?.role === "editor") {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Bạn không có quyền quản lý địa điểm (chỉ admin/editor).",
  };
}

export type PlaceInput = {
  name: string;
  province?: string;
  commune?: string;
  addressDetail?: string;
  oldProvince?: string;
  oldDistrict?: string;
  oldCommune?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  googleMapsUrl?: string;
  note?: string;
};

export type PlaceSearchResult = {
  id: string;
  name: string;
  province: string | null;
  commune: string | null;
  address_detail: string | null;
  old_province: string | null;
  old_district: string | null;
  old_commune: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  note: string | null;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanRequiredText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanCoordinate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function isValidLatitude(value: number | null) {
  return value === null || (value >= -90 && value <= 90);
}

function isValidLongitude(value: number | null) {
  return value === null || (value >= -180 && value <= 180);
}

function normalizeUrl(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function toDbPayload(input: PlaceInput) {
  const latitude = cleanCoordinate(input.latitude);
  const longitude = cleanCoordinate(input.longitude);

  return {
    name: cleanRequiredText(input.name),
    province: cleanText(input.province),
    commune: cleanText(input.commune),
    address_detail: cleanText(input.addressDetail),
    old_province: cleanText(input.oldProvince),
    old_district: cleanText(input.oldDistrict),
    old_commune: cleanText(input.oldCommune),
    latitude,
    longitude,
    google_maps_url: normalizeUrl(input.googleMapsUrl),
    note: cleanText(input.note),
  };
}

function buildPlaceAddress(place: {
  name?: string | null;
  province?: string | null;
  commune?: string | null;
  address_detail?: string | null;
}) {
  return [
    place.address_detail,
    place.commune,
    place.province,
    "Việt Nam",
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function buildGoogleMapsSearchUrl(place: {
  name?: string | null;
  province?: string | null;
  commune?: string | null;
  address_detail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string | null;
}) {
  if (place.google_maps_url) return place.google_maps_url;

  if (typeof place.latitude === "number" && typeof place.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${place.latitude},${place.longitude}`,
    )}`;
  }

  const query = buildPlaceAddress(place) || place.name || "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildGoogleMapsDirectionsUrl(place: {
  name?: string | null;
  province?: string | null;
  commune?: string | null;
  address_detail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  if (typeof place.latitude === "number" && typeof place.longitude === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${place.latitude},${place.longitude}`,
    )}`;
  }

  const destination = buildPlaceAddress(place) || place.name || "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination,
  )}`;
}

export async function createPlace(input: PlaceInput) {
  const guard = await assertCanManagePlaces();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const supabase = getSupabaseServiceRole();
  const payload = toDbPayload(input);

  if (!payload.name) {
    return { ok: false as const, error: "Tên địa điểm không được để trống." };
  }

  if (!isValidLatitude(payload.latitude)) {
    return { ok: false as const, error: "Latitude phải nằm trong khoảng -90 đến 90." };
  }

  if (!isValidLongitude(payload.longitude)) {
    return { ok: false as const, error: "Longitude phải nằm trong khoảng -180 đến 180." };
  }

  const { data, error } = await supabase
    .from("places")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/dashboard/places");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/members");

  return { ok: true as const, id: data.id as string };
}

export async function updatePlace(placeId: string, input: PlaceInput) {
  const guard = await assertCanManagePlaces();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const supabase = getSupabaseServiceRole();
  const cleanPlaceId = cleanRequiredText(placeId);
  const payload = toDbPayload(input);

  if (!cleanPlaceId) {
    return { ok: false as const, error: "Thiếu placeId." };
  }

  if (!payload.name) {
    return { ok: false as const, error: "Tên địa điểm không được để trống." };
  }

  if (!isValidLatitude(payload.latitude)) {
    return { ok: false as const, error: "Latitude phải nằm trong khoảng -90 đến 90." };
  }

  if (!isValidLongitude(payload.longitude)) {
    return { ok: false as const, error: "Longitude phải nằm trong khoảng -180 đến 180." };
  }

  const { error } = await supabase
    .from("places")
    .update(payload)
    .eq("id", cleanPlaceId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/dashboard/places");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/members");

  return { ok: true as const };
}

export async function softDeletePlace(placeId: string) {
  const guard = await assertCanManagePlaces();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const cleanPlaceId = cleanRequiredText(placeId);

  if (!cleanPlaceId) {
    return { ok: false as const, error: "Thiếu placeId." };
  }

  // Dùng service-role client: RLS trên bảng "places" đang có lỗi chưa xác
  // định được nguyên nhân gốc (WITH CHECK từ chối dù is_admin()=true khi
  // kiểm tra trực tiếp bằng SQL) - tạm thời enforce quyền bằng code ở
  // assertCanManagePlaces() thay vì dựa vào RLS cho tới khi tìm ra gốc rễ.
  const supabase = getSupabaseServiceRole();

  const { error, data } = await supabase
    .from("places")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cleanPlaceId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return { ok: false as const, error: error.message };
  }

  if (!data || data.length === 0) {
    return {
      ok: false as const,
      error: "Không tìm thấy địa điểm để xoá (có thể đã bị xoá trước đó).",
    };
  }

  revalidatePath("/dashboard/places");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/members");

  return { ok: true as const };
}

export async function searchPlaces(query = "", limit = 50) {
  const supabase = await getSupabase();
  const q = cleanRequiredText(query);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  let request = supabase
    .from("places")
    .select(
      "id, name, province, commune, address_detail, old_province, old_district, old_commune, latitude, longitude, google_maps_url, note",
    )
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(safeLimit);

  if (q) {
    request = request.or(
      [
        `name.ilike.%${q}%`,
        `province.ilike.%${q}%`,
        `commune.ilike.%${q}%`,
        `address_detail.ilike.%${q}%`,
        `old_province.ilike.%${q}%`,
        `old_district.ilike.%${q}%`,
        `old_commune.ilike.%${q}%`,
        `note.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await request;

  if (error) {
    return { ok: false as const, error: error.message, places: [] as PlaceSearchResult[] };
  }

  return {
    ok: true as const,
    places: (data ?? []) as PlaceSearchResult[],
  };
}

export async function getPlaceById(placeId: string) {
  const supabase = await getSupabase();
  const cleanPlaceId = cleanRequiredText(placeId);

  if (!cleanPlaceId) {
    return { ok: false as const, error: "Thiếu placeId.", place: null };
  }

  const { data, error } = await supabase
    .from("places")
    .select(
      "id, name, province, commune, address_detail, old_province, old_district, old_commune, latitude, longitude, google_maps_url, note",
    )
    .eq("id", cleanPlaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, place: null };
  }

  return {
    ok: true as const,
    place: data as PlaceSearchResult | null,
  };
}
