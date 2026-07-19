import AccountSettingsPanel from "@/components/AccountSettingsPanel";
import { getSupabase } from "@/utils/supabase/queries";

export const metadata = {
  title: "Cài đặt tài khoản",
};

export default async function AccountSettingsPage() {
  const supabase = await getSupabase();

  const personsRes = await supabase
    .from("persons_active")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="title">Cài đặt tài khoản</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Thiết lập người gốc mặc định cho các màn xem gia phả. Sau này các tuỳ chọn cá nhân khác sẽ gom vào đây.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        <AccountSettingsPanel persons={personsRes.data ?? []} />
      </main>
    </div>
  );
}
