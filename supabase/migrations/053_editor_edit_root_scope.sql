-- v2.6.6 "rootedit": cho phép admin gán một "gốc chỉnh sửa" riêng cho một
-- tài khoản (thường là editor), độc lập với profiles.person_id (khoá phân
-- quyền xem hiện có). Khi được gán, tài khoản đó được cấp thêm quyền xem/sửa:
--   - Người gốc + toàn bộ hậu duệ (con, cháu, chắt, ...)
--   - Vợ/chồng của những hậu duệ đó (để thêm/sửa dâu, rể)
--   - Toàn bộ gia đình bên vợ/chồng của CHÍNH người gốc
--     (ví dụ: gán gốc = "Chế 2" -> chồng Chế 2 sửa được từ Chế 2 trở xuống
--      và cả gia đình ruột của chính anh ấy).
--
-- Việc tính toán phạm vi này nằm ở tầng ứng dụng
-- (utils/permissions/visiblePersons.ts -> applyEditRootScope), tương tự cách
-- profiles.person_id đã được dùng để tính "visiblePersonIds" từ trước. Cột
-- này KHÔNG thay đổi RLS hiện có (Admins/Editors vẫn insert/update/delete
-- persons & relationships theo policy is_admin()/is_editor() sẵn có) - việc
-- giới hạn theo nhánh cho editor đã và đang được thực hiện ở tầng ứng dụng
-- (trang chỉnh sửa thành viên, RelationshipManager, các server action dùng
-- assertCanEditPerson/assertCanEditRelationship), nay chỉ mở rộng phạm vi đó.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS edit_root_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_edit_root_person_id
ON public.profiles(edit_root_person_id);

COMMENT ON COLUMN public.profiles.edit_root_person_id IS
'Gốc chỉnh sửa (rootedit) do admin gán cho tài khoản: người này trở xuống + gia đình bên vợ/chồng của người này sẽ nằm trong phạm vi được phép xem/sửa, cộng thêm (không thay thế) phạm vi tính theo profiles.person_id.';
