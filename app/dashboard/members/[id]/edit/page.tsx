import MemberForm from "@/components/MemberForm";
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

function AccessDenied({
  message,
}: {
  message: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="max-w-xl rounded-2xl border border-red-200/70 bg-red-50/80 p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-stone-800">
          Truy cập bị từ chối
        </h1>
        <p className="text-stone-600 mt-2">{message}</p>
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

export default async function EditMemberPage({ params }: PageProps) {
  const { id } = await params;

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const isEditor = profile?.role === "editor";
  if (!isAdmin && !isEditor) {
    return (
      <AccessDenied message="Bạn không có quyền chỉnh sửa thành viên." />
    );
  }

  const supabase = await getSupabase();

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

    if (!permission.editablePersonIds.has(id)) {
      return (
        <AccessDenied message="Thành viên này nằm ngoài nhánh gia phả mà tài khoản của bạn được phép chỉnh sửa." />
      );
    }
  }

  // Fetch Public Data
  const { data: person, error } = await supabase
    .from("persons_active")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !person) {
    notFound();
  }

  // Fetch Private Data
  let privateData = null;
  if (isAdmin) {
    const { data } = await supabase
      .from("person_details_private")
      .select("*")
      .eq("person_id", id)
      .single();
    privateData = data;
  }

  const initialData = isAdmin ? { ...person, ...privateData } : { ...person };

  return (
    <div className="flex-1 w-full relative flex flex-col pb-8">
      <div className="w-full relative z-20 py-4 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/members/${id}`}
            className="p-2 -ml-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="title">Chỉnh Sửa Thành Viên</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10 w-full flex-1">
        <MemberForm initialData={initialData} isEditing={true} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
