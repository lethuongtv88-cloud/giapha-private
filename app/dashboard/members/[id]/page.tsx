import DeleteMemberButton from "@/components/DeleteMemberButton";
import MemberDetailContent from "@/context/MemberDetailContent";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import {
  buildVisiblePersonSetForProfile,
  isAdminProfile,
} from "@/utils/permissions/applyPersonVisibility";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-xl rounded-2xl border border-red-200/70 bg-red-50/80 p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-stone-800">Không có quyền xem</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Thành viên này nằm ngoài nhánh gia phả mà tài khoản của bạn được phép xem.
        </p>
        <Link
          href="/dashboard/members"
          className="mt-5 inline-flex rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Quay lại danh sách
        </Link>
      </div>
    </div>
  );
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  const profile = await getProfile();

  const isAdmin = profile?.role === "admin";
  const canEdit = profile?.role === "admin" || profile?.role === "editor";

  const supabase = await getSupabase();

  let allowedPersonIds: string[] | null = null;

  if (!isAdminProfile(profile)) {
    const [
      personsRes,
      relsRes,
      familiesRes,
      familyParentsRes,
      familyChildrenRes,
    ] = await Promise.all([
      supabase.from("persons_active").select("id"),
      supabase.from("relationships_active").select("*"),
      supabase.from("families").select("*").is("deleted_at", null),
      supabase.from("family_parents").select("*"),
      supabase.from("family_children").select("*"),
    ]);

    const permission = buildVisiblePersonSetForProfile({
      profile,
      persons: personsRes.data ?? [],
      relationships: relsRes.data ?? [],
      families: familiesRes.data ?? [],
      familyParents: familyParentsRes.data ?? [],
      familyChildren: familyChildrenRes.data ?? [],
    });

    if (!permission.visiblePersonIds.has(id)) {
      return <AccessDenied />;
    }

    allowedPersonIds = Array.from(permission.visiblePersonIds);
  }

  // Fetch Person Public Data
  const { data: person, error } = await supabase
    .from("persons_active")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !person) {
    notFound();
  }

  // Fetch Private Data if Admin
  let privateData = null;
  if (isAdmin) {
    const { data } = await supabase
      .from("person_details_private")
      .select("*")
      .eq("person_id", id)
      .single();
    privateData = data;
  }

  return (
    <div className="flex-1 w-full relative flex flex-col pb-8">
      <div className="w-full relative z-20 py-4 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/members"
            className="p-2 -ml-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="title">Chi Tiết Thành Viên</h1>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2.5">
            <Link
              href={`/dashboard/members/${id}/edit`}
              className="px-4 py-2 bg-stone-100/80 text-stone-700 rounded-lg hover:bg-stone-200 hover:text-stone-900 font-medium text-sm transition-all shadow-sm"
            >
              Chỉnh sửa
            </Link>
            <DeleteMemberButton memberId={id} />
          </div>
        )}
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10 w-full flex-1">
        <div className="bg-white/60 rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden hover:shadow-md transition-shadow duration-300">
          <MemberDetailContent
            person={person}
            privateData={privateData}
            isAdmin={isAdmin}
            canEdit={canEdit}
            allowedPersonIds={allowedPersonIds}
          />
        </div>
      </main>
    </div>
  );
}
