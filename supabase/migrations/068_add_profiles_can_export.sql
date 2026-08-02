-- 068_add_profiles_can_export.sql
--
-- Thêm quyền "can_export" cho từng tài khoản: admin bật/tắt riêng cho
-- từng người dùng (member/editor) để quyết định ai được thấy nút Xuất
-- file ở các sơ đồ (Sơ đồ cây, Mindmap, Bubble, Nội Ngoại, Sui Gia).
-- Admin luôn được xuất file mặc định, không phụ thuộc cột này (xử lý ở
-- tầng ứng dụng: canExport = role === 'admin' || can_export === true).
--
-- Mặc định FALSE cho user hiện có và user mới tạo (đúng yêu cầu: phải
-- bật thủ công từng người).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_export boolean NOT NULL DEFAULT false;

--
-- RPC set_user_can_export: mirror của set_user_active_status /
-- set_user_role (062/schema) — SECURITY DEFINER, tự kiểm tra caller là
-- admin trước khi update, để không thể bị gọi thẳng qua PostgREST bởi
-- user thường.
--

CREATE OR REPLACE FUNCTION public.set_user_can_export(target_user_id uuid, new_value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    UPDATE public.profiles
    SET can_export = new_value
    WHERE id = target_user_id;
END;
$$;
