import AdminUserList from "@/components/AdminUserList";
import { AdminUserData, Person } from "@/types";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const supabase = await getSupabase();

  const [usersRes, personsRes, profilesRes] = await Promise.all([
    supabase.rpc("get_admin_users"),
    supabase
      .from("persons_active")
      .select("id, full_name, birth_year, gender, avatar_url, generation")
      .order("full_name", { ascending: true }),
    supabase.from("profiles").select("id, person_id"),
  ]);

  if (usersRes.error) {
    console.error("Error fetching users:", usersRes.error);
  }

  if (personsRes.error) {
    console.error("Error fetching persons for user root settings:", personsRes.error);
  }

  if (profilesRes.error) {
    console.error("Error fetching user linked persons:", profilesRes.error);
  }

  const profilePersonByUserId = new Map(
    ((profilesRes.data as Array<{ id: string; person_id: string | null }> | null) ?? []).map(
      (item) => [item.id, item.person_id] as const,
    ),
  );

  const typedUsers = (((usersRes.data as AdminUserData[]) || []).map((user) => ({
    ...user,
    person_id: user.person_id ?? profilePersonByUserId.get(user.id) ?? null,
  }))) as AdminUserData[];
  const persons = (personsRes.data as Person[]) || [];

  return (
    <main className="flex-1 overflow-auto bg-stone-50/50 flex flex-col pt-8 relative w-full">
      <div className="max-w-7xl mx-auto px-4 pb-8 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="title">Quản lý Người dùng</h1>
            <p className="text-stone-500 mt-2 text-sm sm:text-base">
              Danh sách các tài khoản đang tham gia vào hệ thống.
            </p>
          </div>
        </div>
        <AdminUserList
          initialUsers={typedUsers}
          currentUserId={profile.id}
          persons={persons}
        />
      </div>
    </main>
  );
}
