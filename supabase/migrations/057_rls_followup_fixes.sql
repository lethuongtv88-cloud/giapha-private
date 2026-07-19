-- 054_rls_followup_fixes.sql
--
-- Vá 4 vấn đề RLS phát hiện thêm sau migration 053_branch_scoped_rls.sql.
-- PHỤ THUỘC vào 053 (dùng lại hàm public.visible_person_ids()) — phải áp
-- dụng 053 TRƯỚC file này.
--
--   1) import_sessions: xoá policy "Read import sessions" (đang cho phép
--      MỌI user đăng nhập đọc, mâu thuẫn với "Editors manage import sessions"
--      vốn đã là FOR ALL admin/editor và tự bao gồm SELECT).
--   2) import_staging_records: tương tự (1).
--   3) person_names: thay policy đọc không lọc nhánh bằng branch-scoped
--      SELECT dùng visible_person_ids(); đồng thời tách "Editors manage
--      person_names" (FOR ALL ngầm định) thành INSERT/UPDATE/DELETE riêng,
--      giống cách đã làm với events/families/... ở 053 — nếu không tách,
--      editor vẫn thấy hết person_names bất kể policy branch-scoped mới.
--   4) sources / event_source_links / person_source_links: policy INSERT
--      đang "WITH CHECK (true)" trong khi cột created_by KHÔNG có
--      "DEFAULT auth.uid()" -> user có thể tự gán created_by = UUID của
--      người khác lúc insert. Sửa lại để ép created_by phải là chính
--      auth.uid() (hoặc NULL, cho trường hợp import hệ thống không gắn user).

-- ─── 1) import_sessions ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read import sessions" ON public.import_sessions;
-- Không tạo policy SELECT mới: "Editors manage import sessions" (FOR ALL,
-- is_admin() OR is_editor()) đã tự bao gồm SELECT cho đúng đối tượng.

-- ─── 2) import_staging_records ──────────────────────────────────────────

DROP POLICY IF EXISTS "Read import staging records" ON public.import_staging_records;
-- Tương tự (1): "Editors manage import staging records" đã đủ cho SELECT.

-- ─── 3) person_names ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read person_names" ON public.person_names;
CREATE POLICY "person_names_select_branch_scoped"
ON public.person_names
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND person_id IN (SELECT visible_id FROM public.visible_person_ids())
);

DROP POLICY IF EXISTS "Editors manage person_names" ON public.person_names;
CREATE POLICY "person_names_insert_admin_editor" ON public.person_names
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());
CREATE POLICY "person_names_update_admin_editor" ON public.person_names
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());
CREATE POLICY "person_names_delete_admin_editor" ON public.person_names
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());

-- ─── 4) sources / event_source_links / person_source_links ─────────────
-- Ép created_by phải là chính người gọi (hoặc NULL cho tác vụ hệ thống),
-- không cho phép gán created_by = UUID người khác.

DROP POLICY IF EXISTS sources_insert_authenticated ON public.sources;
CREATE POLICY sources_insert_own
ON public.sources
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS event_source_links_insert_authenticated ON public.event_source_links;
CREATE POLICY event_source_links_insert_own
ON public.event_source_links
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS person_source_links_insert_authenticated ON public.person_source_links;
CREATE POLICY person_source_links_insert_own
ON public.person_source_links
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- Lưu ý: nếu app hiện tại KHÔNG bao giờ gửi created_by lên (để cột tự NULL
-- rồi trigger/app tầng khác gán sau), policy trên vẫn cho qua bình thường
-- vì đã có "OR created_by IS NULL". Chỉ chặn đúng trường hợp cố tình gán
-- created_by = UUID của người khác.
