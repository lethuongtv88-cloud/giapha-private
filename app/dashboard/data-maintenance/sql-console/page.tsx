import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Terminal } from "lucide-react";
import { getCurrentPersonAccess } from "@/utils/permissions/assertPersonAccess";
import { SqlConsoleForm } from "./SqlConsoleForm";

export const metadata = {
  title: "SQL Console - Bảo trì dữ liệu",
};

export default async function SqlConsolePage() {
  const access = await getCurrentPersonAccess();

  if (!access.isAdmin) {
    redirect("/dashboard/data-maintenance");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/dashboard/data-maintenance"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft className="size-4" />
        Quay lại Bảo trì dữ liệu
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-red-100 p-3 text-red-700">
          <Terminal className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900">SQL Console</h1>
          <p className="text-sm text-stone-600">
            Chạy SQL repair trực tiếp vào database, không cần vào Supabase SQL Editor.
          </p>
        </div>
      </div>

      <SqlConsoleForm />
    </div>
  );
}
