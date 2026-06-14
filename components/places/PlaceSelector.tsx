"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createPlace,
  searchPlaces,
  type PlaceInput,
  type PlaceSearchResult,
} from "@/app/actions/places";
import PlaceMapLinks from "@/components/places/PlaceMapLinks";
import { MapPin, Plus, Search, X } from "lucide-react";

type PlaceSelectorProps = {
  value?: string | null;
  onChange: (placeId: string | null, place?: PlaceSearchResult | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

const emptyForm: PlaceInput = {
  name: "",
  province: "",
  commune: "",
  addressDetail: "",
  oldProvince: "",
  oldDistrict: "",
  oldCommune: "",
  latitude: "",
  longitude: "",
  googleMapsUrl: "",
  note: "",
};

function placeSummary(place: PlaceSearchResult) {
  return [
    place.address_detail,
    place.commune,
    place.province,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export default function PlaceSelector({
  value,
  onChange,
  label = "Địa điểm",
  placeholder = "Tìm địa điểm theo tên, tỉnh, xã, địa chỉ...",
  disabled = false,
}: PlaceSelectorProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceSearchResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<PlaceInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedFromList = useMemo(() => {
    if (!value) return null;
    return places.find((place) => place.id === value) ?? null;
  }, [places, value]);

  useEffect(() => {
    if (selectedFromList && selectedFromList.id !== selectedPlace?.id) {
      setSelectedPlace(selectedFromList);
    }
  }, [selectedFromList, selectedPlace?.id]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchPlaces(query, 50);

        if (cancelled) return;

        if (!result.ok) {
          setError(result.error);
          setPlaces([]);
          return;
        }

        setError(null);
        setPlaces(result.places);

        if (value && !selectedPlace) {
          const found = result.places.find((place) => place.id === value);
          if (found) setSelectedPlace(found);
        }
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, value, selectedPlace]);

  const handleSelect = (place: PlaceSearchResult) => {
    setSelectedPlace(place);
    setQuery(place.name);
    setShowCreateForm(false);
    setError(null);
    onChange(place.id, place);
  };

  const handleClear = () => {
    setSelectedPlace(null);
    setQuery("");
    setError(null);
    onChange(null, null);
  };

  const updateForm = (key: keyof PlaceInput, nextValue: string) => {
    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  const resetCreateForm = () => {
    setForm(emptyForm);
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    setError(null);

    startTransition(async () => {
      const result = await createPlace(form);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const refreshed = await searchPlaces(form.name, 20);

      if (!refreshed.ok) {
        setError(refreshed.error);
        return;
      }

      setPlaces(refreshed.places);

      const created =
        refreshed.places.find((place) => place.id === result.id) ??
        refreshed.places.find((place) => place.name === form.name.trim()) ??
        null;

      if (created) {
        handleSelect(created);
      } else {
        onChange(result.id, null);
        setSelectedPlace(null);
      }

      resetCreateForm();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-stone-700">{label}</label>

        {selectedPlace || value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-3.5" />
            Bỏ chọn
          </button>
        ) : null}
      </div>

      {selectedPlace ? (
        <PlaceMapLinks place={selectedPlace} />
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm disabled:cursor-not-allowed disabled:bg-stone-100"
          />
        </div>

        {error ? (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-stone-100">
          {isPending && places.length === 0 ? (
            <div className="px-3 py-3 text-sm text-stone-500">Đang tìm...</div>
          ) : places.length === 0 ? (
            <div className="px-3 py-3 text-sm text-stone-500">
              Chưa có địa điểm phù hợp.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {places.map((place) => {
                const selected = place.id === value;

                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelect(place)}
                    disabled={disabled}
                    className={`w-full px-3 py-3 text-left transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected ? "bg-amber-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-amber-700" />

                      <div className="min-w-0">
                        <div className="font-medium text-stone-900">
                          {place.name}
                        </div>

                        {placeSummary(place) ? (
                          <div className="mt-0.5 text-xs text-stone-500">
                            {placeSummary(place)}
                          </div>
                        ) : null}

                        {place.old_commune || place.old_district || place.old_province ? (
                          <div className="mt-0.5 text-xs text-stone-400">
                            Cũ: {[place.old_commune, place.old_district, place.old_province]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setError(null);
              setForm((current) => ({
                ...current,
                name: current.name || query,
              }));
            }}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" />
            {showCreateForm ? "Ẩn tạo địa điểm" : "Tạo địa điểm mới"}
          </button>
        </div>
      </div>

      {showCreateForm ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <h3 className="font-medium text-stone-900">Tạo địa điểm mới</h3>

          <div className="mt-3 grid gap-3">
            <Field
              label="Tên địa điểm"
              value={form.name ?? ""}
              onChange={(nextValue) => updateForm("name", nextValue)}
              placeholder="Ví dụ: Nhà thờ họ Lê, Mộ ông Nguyễn Văn A..."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Tỉnh / Thành phố hiện tại"
                value={form.province ?? ""}
                onChange={(nextValue) => updateForm("province", nextValue)}
                placeholder="Ví dụ: Cà Mau"
              />

              <Field
                label="Xã / Phường / Đặc khu hiện tại"
                value={form.commune ?? ""}
                onChange={(nextValue) => updateForm("commune", nextValue)}
                placeholder="Ví dụ: Xã Tân Thành"
              />
            </div>

            <Field
              label="Địa chỉ chi tiết"
              value={form.addressDetail ?? ""}
              onChange={(nextValue) => updateForm("addressDetail", nextValue)}
              placeholder="Ấp, khóm, số nhà, đường..."
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Tỉnh cũ"
                value={form.oldProvince ?? ""}
                onChange={(nextValue) => updateForm("oldProvince", nextValue)}
              />

              <Field
                label="Huyện cũ"
                value={form.oldDistrict ?? ""}
                onChange={(nextValue) => updateForm("oldDistrict", nextValue)}
              />

              <Field
                label="Xã cũ"
                value={form.oldCommune ?? ""}
                onChange={(nextValue) => updateForm("oldCommune", nextValue)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Latitude"
                value={String(form.latitude ?? "")}
                onChange={(nextValue) => updateForm("latitude", nextValue)}
                placeholder="Ví dụ: 9.176"
              />

              <Field
                label="Longitude"
                value={String(form.longitude ?? "")}
                onChange={(nextValue) => updateForm("longitude", nextValue)}
                placeholder="Ví dụ: 105.15"
              />
            </div>

            <Field
              label="Google Maps URL"
              value={form.googleMapsUrl ?? ""}
              onChange={(nextValue) => updateForm("googleMapsUrl", nextValue)}
              placeholder="Dán link Google Maps nếu có"
            />

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Ghi chú</span>
              <textarea
                value={form.note ?? ""}
                onChange={(event) => updateForm("note", event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={disabled || isPending || !String(form.name ?? "").trim()}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Đang tạo..." : "Tạo và chọn địa điểm"}
              </button>

              <button
                type="button"
                onClick={resetCreateForm}
                disabled={disabled || isPending}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-300 px-3 py-2"
      />
    </label>
  );
}
