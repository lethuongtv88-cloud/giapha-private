-- v2.4.8 Admin user profile/root preferences helpers
-- Adds name/default-root fields to get_admin_users() so the Users UI can edit
-- email, display name, role, active status and default diagram root in one place.

DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  default_tree_root_id UUID
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
    up.default_tree_root_id
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id
  LEFT JOIN public.user_preferences up
    ON up.user_id = u.id
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
