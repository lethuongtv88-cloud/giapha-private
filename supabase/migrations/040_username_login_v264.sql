-- v2.6.4 Username login
-- Users can sign in with email or an admin-assigned username.
-- Users cannot change their own username; admins manage it from /dashboard/users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE public.profiles
SET username = lower(trim(username))
WHERE username IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_check
  CHECK (
    username IS NULL
    OR username = ''
    OR (
      username = lower(username)
      AND char_length(username) BETWEEN 3 AND 32
      AND username ~ '^[a-z0-9._]+$'
      AND username !~ '^\.'
      AND username !~ '\.$'
      AND username !~ '\.\.'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
ON public.profiles (lower(username))
WHERE username IS NOT NULL AND username <> '';

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
  person_id UUID
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
    p.person_id
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id
  LEFT JOIN public.user_preferences up
    ON up.user_id = u.id
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
