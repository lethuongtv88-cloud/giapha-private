-- 069_get_admin_users_add_can_export.sql
--
-- Bổ sung cột can_export vào kết quả get_admin_users() để trang quản lý
-- người dùng (/dashboard/users) có dữ liệu hiển thị + toggle quyền xuất
-- file cho từng tài khoản. Không đổi logic JOIN/ORDER BY hiện có, chỉ
-- thêm 1 cột lấy từ profiles.can_export (đã thêm ở migration 068).
--
-- Phải DROP trước vì Postgres không cho CREATE OR REPLACE FUNCTION khi
-- đổi kiểu trả về (thêm cột mới vào RETURNS TABLE), giống cách migration
-- 040 đã làm khi thêm cột username/person_id.

DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  default_tree_root_id UUID,
  username TEXT,
  person_id UUID,
  can_export BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      ''
    )::TEXT AS full_name,
    p.role::TEXT AS role,
    p.is_active,
    u.created_at,
    up.default_tree_root_id,
    p.username,
    p.person_id,
    p.can_export
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id
  LEFT JOIN public.user_preferences up
    ON up.user_id = u.id
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
