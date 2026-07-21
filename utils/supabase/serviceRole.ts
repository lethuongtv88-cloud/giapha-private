import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase dùng service_role key - BỎ QUA hoàn toàn RLS. Chỉ dùng
 * trong server action, và LUÔN phải tự kiểm tra quyền (role admin/editor)
 * bằng code TRƯỚC khi gọi tới client này, vì bản thân nó không còn được
 * RLS bảo vệ nữa.
 *
 * Cùng pattern đã dùng trong app/actions/user.ts (getSupabaseAdmin).
 */
export function getSupabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_DEFAULT_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY trên server để thực hiện thao tác này.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
