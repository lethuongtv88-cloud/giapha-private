-- 070_get_admin_users_add_last_sign_in.sql
--
-- Bổ sung cột last_sign_in_at vào kết quả get_admin_users() để trang quản
-- lý người dùng hiển thị "Lần truy cập gần đây" cạnh "Ngày tạo". Cột này
-- có sẵn trong auth.users (đã JOIN trong hàm), chỉ cần thêm vào SELECT +
-- RETURNS TABLE, không đổi logic JOIN/ORDER BY hiện có.

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
  can_export BOOLEAN,
  last_sign_in_at TIMESTAMPTZ
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
    p.can_export,
    u.last_sign_in_at
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id
  LEFT JOIN public.user_preferences up
    ON up.user_id = u.id
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
