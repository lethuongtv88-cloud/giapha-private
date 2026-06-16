export const metadata = {
  title: "Phòng trưng bày | Gia Phả OS",
  description: "Lưu giữ và chia sẻ hình ảnh, kỷ niệm dòng họ",
};

export default function GalleryPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-4 sm:p-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h1 className="text-xl font-bold">Phòng trưng bày đang tạm khóa</h1>
        <p className="mt-3 leading-7">
          Chức năng hình ảnh chưa được kích hoạt trong schema hiện tại. Dữ liệu
          gia phả, sự kiện, nguồn trích dẫn, địa điểm và GEDCOM không bị ảnh hưởng.
        </p>
      </div>
    </main>
  );
}
