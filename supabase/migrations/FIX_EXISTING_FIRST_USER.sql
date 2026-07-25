-- FIX_EXISTING_FIRST_USER.sql
--
-- (1) Tim tai khoan da dang ky truoc do (chua co profile)
SELECT id, email, created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- (2) Sau khi xac nhan dung email cua ban o ket qua (1), tao profile admin
--     cho no. THAY '<uuid-lay-tu-buoc-1>' bang gia tri id that.
INSERT INTO public.profiles (id, role, is_active)
VALUES ('<uuid-lay-tu-buoc-1>', 'admin', true)
ON CONFLICT (id) DO UPDATE
  SET role = 'admin', is_active = true;
