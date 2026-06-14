import { ExternalLink, MapPin, Navigation } from "lucide-react";

export type PlaceForMapLinks = {
  name?: string | null;
  province?: string | null;
  commune?: string | null;
  address_detail?: string | null;
  old_province?: string | null;
  old_district?: string | null;
  old_commune?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string | null;
  note?: string | null;
};

function cleanPart(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function buildPlaceAddress(place: PlaceForMapLinks) {
  return [
    cleanPart(place.address_detail),
    cleanPart(place.commune),
    cleanPart(place.province),
    "Việt Nam",
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildGoogleMapsOpenUrl(place: PlaceForMapLinks) {
  const customUrl = cleanPart(place.google_maps_url);
  if (customUrl) return customUrl;

  if (
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${place.latitude},${place.longitude}`,
    )}`;
  }

  const query = buildPlaceAddress(place) || cleanPart(place.name) || "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsDirectionsUrl(place: PlaceForMapLinks) {
  if (
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${place.latitude},${place.longitude}`,
    )}`;
  }

  const destination = buildPlaceAddress(place) || cleanPart(place.name) || "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination,
  )}`;
}

function hasAnyPlaceInfo(place: PlaceForMapLinks) {
  return Boolean(
    cleanPart(place.name) ||
      cleanPart(place.address_detail) ||
      cleanPart(place.commune) ||
      cleanPart(place.province) ||
      cleanPart(place.google_maps_url) ||
      typeof place.latitude === "number" ||
      typeof place.longitude === "number",
  );
}

export default function PlaceMapLinks({
  place,
  compact = false,
  showName = true,
}: {
  place: PlaceForMapLinks | null | undefined;
  compact?: boolean;
  showName?: boolean;
}) {
  if (!place || !hasAnyPlaceInfo(place)) return null;

  const address = buildPlaceAddress(place);
  const oldAddress = [
    cleanPart(place.old_commune),
    cleanPart(place.old_district),
    cleanPart(place.old_province),
  ]
    .filter(Boolean)
    .join(", ");

  const openUrl = buildGoogleMapsOpenUrl(place);
  const directionsUrl = buildGoogleMapsDirectionsUrl(place);

  return (
    <div
      className={
        compact
          ? "space-y-1 text-sm text-stone-600"
          : "rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700"
      }
    >
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-amber-700" />

        <div className="min-w-0 flex-1">
          {showName && place.name ? (
            <div className="font-medium text-stone-900">{place.name}</div>
          ) : null}

          {address ? (
            <div className={showName && place.name ? "mt-0.5" : ""}>{address}</div>
          ) : null}

          {oldAddress ? (
            <div className="mt-0.5 text-xs text-stone-500">
              Địa danh cũ: {oldAddress}
            </div>
          ) : null}

          {typeof place.latitude === "number" &&
          typeof place.longitude === "number" ? (
            <div className="mt-0.5 text-xs text-stone-500">
              Tọa độ: {place.latitude}, {place.longitude}
            </div>
          ) : null}

          {place.note ? (
            <div className="mt-1 text-xs text-stone-500">{place.note}</div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <ExternalLink className="size-3.5" />
              Mở bản đồ
            </a>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              <Navigation className="size-3.5" />
              Dẫn đường
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
