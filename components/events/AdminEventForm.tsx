"use client";

import { createAdminEvent } from "@/app/actions/events";
import PersonSelector from "@/components/PersonSelector";
import PlaceSelector from "@/components/places/PlaceSelector";
import type { Person } from "@/types";
import { CalendarPlus, Loader2, Users2, X } from "lucide-react";
import { useState, useTransition } from "react";

const EVENT_TYPES = [
  { value: "custom", label: "Sự kiện chung" },
  { value: "wedding", label: "Đám cưới / Thiệp cưới" },
];

const PRECISIONS = [
  { value: "day", label: "Chính xác ngày", placeholder: "dd/mm/yyyy, ví dụ 21/07/2026" },
  { value: "month", label: "Chỉ tháng/năm", placeholder: "mm/yyyy, ví dụ 07/2026" },
  { value: "year", label: "Chỉ năm", placeholder: "yyyy, ví dụ 2026" },
  { value: "unknown", label: "Không rõ ngày", placeholder: "Để trống" },
];

type AdminEventFormProps = {
  persons: Person[];
};

export default function AdminEventForm({ persons }: AdminEventFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [eventType, setEventType] = useState("custom");
  const [precision, setPrecision] = useState("day");
  const [rootPersonId, setRootPersonId] = useState<string | null>(null);
  const [brideId, setBrideId] = useState<string | null>(null);
  const [groomId, setGroomId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setMessage(null);

    formData.set("type", eventType);
    formData.set("date_precision", precision);
    formData.set("place_id", selectedPlaceId ?? "");

    if (rootPersonId) formData.set("root_person_id", rootPersonId);
    if (brideId) formData.set("bride_id", brideId);
    if (groomId) formData.set("groom_id", groomId);

    startTransition(() => {
      void (async () => {
        const result = await createAdminEvent(formData);

        if (!result) {
          setError("Không nhận được phản hồi sau khi tạo sự kiện.");
          return;
        }

        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }

        const auditOk = "auditOk" in result ? result.auditOk : true;
        const auditError = "auditError" in result ? result.auditError : null;

        setMessage(
          auditOk === false
            ? `Đã thêm sự kiện, nhưng audit log chưa ghi được: ${auditError ?? "không rõ lỗi"}`
            : "Đã thêm sự kiện.",
        );
        setSelectedPlaceId(null);
        setIsOpen(false);
      })();
    });
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Danh sách sự kiện</h2>
          <p className="text-sm text-stone-500">
            Sinh nhật, ngày giỗ, kỷ niệm ngày cưới, đám cưới và sự kiện gia đình. Mỗi sự kiện đã có thời gian đếm ngược ngay trên thẻ sự kiện.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMessage(null);
            setIsOpen((value) => !value);
          }}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-60"
          disabled={isPending}
        >
          {isOpen ? <X className="size-4" /> : <CalendarPlus className="size-4" />}
          {isOpen ? "Đóng" : "Thêm sự kiện"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isOpen ? (
        <form action={handleSubmit} className="mt-5 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 shadow-sm ring-1 ring-amber-50">
          <div className="mb-4 rounded-xl border border-amber-200 bg-white px-4 py-3 text-xs leading-5 text-amber-800">
            <strong>Quyền hiển thị:</strong> chọn <strong>Gốc hiển thị</strong> để member thuộc nhánh đó nhìn thấy sự kiện theo cơ chế phân quyền hiện có. Nếu để trống, sự kiện chỉ hiển thị cho Admin/Editor.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Loại sự kiện</span>
              <select
                name="type_select"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Tiêu đề</span>
              <input
                name="title"
                defaultValue="Sự kiện gia đình"
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder={eventType === "wedding" ? "Ví dụ: Thiệp cưới Nguyễn Văn A và Trần Thị B" : "Ví dụ: Họp mặt gia đình"}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Độ chính xác ngày</span>
              <select
                name="date_precision_select"
                value={precision}
                onChange={(event) => setPrecision(event.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                {PRECISIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Ngày tổ chức</span>
              <input
                name="date_text"
                type={precision === "day" ? "date" : precision === "month" ? "month" : "text"}
                inputMode="numeric"
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100 disabled:text-stone-400"
                placeholder={PRECISIONS.find((item) => item.value === precision)?.placeholder ?? "dd/mm/yyyy"}
                disabled={precision === "unknown"}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Giờ tổ chức</span>
              <input
                name="time_text"
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Ví dụ: 17:30 hoặc 17 giờ 30"
              />
            </label>

            <div className="space-y-3 md:col-span-2">
              <PlaceSelector
                value={selectedPlaceId}
                onChange={(placeId) => setSelectedPlaceId(placeId)}
                label="Địa điểm chuẩn"
                placeholder="Tìm hoặc tạo địa điểm theo tỉnh/xã hiện tại..."
                disabled={isPending}
              />

              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                  Địa điểm ghi chú / fallback
                </span>
                <input
                  name="place_text"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Nhà hàng, tư gia, địa chỉ tổ chức nếu chưa chọn địa điểm chuẩn..."
                />
              </label>

              <p className="text-xs leading-5 text-stone-500">
                Nếu đã chọn địa điểm chuẩn, hệ thống lưu place_id để mở Google Maps và dẫn đường. Ô ghi chú vẫn được giữ làm fallback.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <PersonSelector
              persons={persons}
              selectedId={rootPersonId}
              onSelect={setRootPersonId}
              label="Gốc hiển thị"
              placeholder="Chọn root để chia sẻ theo nhánh"
              className="w-full"
              showAllOption
              allOptionLabel="Chỉ admin/editor"
            />
            <div className="rounded-2xl border border-stone-200 bg-white/80 p-3 text-xs leading-5 text-stone-600">
              <div className="mb-1 flex items-center gap-2 font-bold text-stone-700">
                <Users2 className="size-4" />
                Phạm vi xem
              </div>
              Root được chọn sẽ được gắn vào sự kiện để dùng lại cơ chế phân quyền theo nhánh hiện có. Member chỉ thấy nếu root đó nằm trong vùng họ được phép xem.
            </div>

            {eventType === "wedding" ? (
              <>
                <PersonSelector
                  persons={persons}
                  selectedId={brideId}
                  onSelect={setBrideId}
                  label="Cô dâu"
                  placeholder="Chọn cô dâu"
                  className="w-full"
                />
                <PersonSelector
                  persons={persons}
                  selectedId={groomId}
                  onSelect={setGroomId}
                  label="Chú rể"
                  placeholder="Chọn chú rể"
                  className="w-full"
                />
              </>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Nội dung thiệp / thông báo</span>
              <textarea
                name="invitation_text"
                rows={5}
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Thông tin thiệp cưới, lời mời, ghi chú thời gian đón khách..."
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Ghi chú</span>
              <textarea
                name="description"
                rows={5}
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Ghi chú nội bộ hoặc mô tả thêm cho sự kiện..."
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
              disabled={isPending}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
              Lưu sự kiện
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
