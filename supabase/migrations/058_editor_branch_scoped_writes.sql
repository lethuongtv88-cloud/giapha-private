-- 055_editor_branch_scoped_writes.sql
--
-- PHỤ THUỘC 053_branch_scoped_rls.sql (dùng lại public.visible_person_ids()).
-- Áp dụng SAU 053 và 054.
--
-- Trước migration này: mọi policy ghi (INSERT/UPDATE/DELETE) trên
-- persons/relationships/events/families/family_parents/family_children/
-- person_events/person_names đều là "is_admin() OR is_editor()" — không
-- giới hạn nhánh, tức editor sửa/xoá được BẤT KỲ ai trong toàn bộ cây.
--
-- Sau migration này: editor chỉ được sửa/xoá dữ liệu đã nằm trong nhánh
-- họ được phép xem (visible_person_ids()); admin không đổi, vẫn full quyền.
--
-- Nguyên tắc cho INSERT (xem giải thích đầy đủ trong hội thoại thiết kế):
--   - persons / families / events: KHÔNG giới hạn — 1 dòng person/family/
--     event vừa tạo mà chưa gắn với ai thì vô hại (không hiện với ai qua
--     policy SELECT, kể cả với chính editor vừa tạo nếu họ không phải
--     admin), rủi ro chỉ nằm ở bước NỐI quan hệ.
--   - relationships / family_parents / family_children / person_events /
--     person_names: đây là bước "nối" thật sự, phải kiểm tra phía đã tồn
--     tại từ trước nằm trong nhánh editor. Khớp đúng luồng UI thực tế
--     (components/RelationshipManager.tsx): luôn insert person trơ trước,
--     ngay sau đó insert quan hệ nối với personId đang xem (đã có sẵn,
--     nên chắc chắn nằm trong nhánh editor nếu họ đọc được trang đó).

-- ─── persons: UPDATE / DELETE giới hạn theo nhánh ───────────────────────
-- INSERT giữ nguyên "is_admin() OR is_editor()" — không đổi, cố ý không đụng.

DROP POLICY IF EXISTS "Admins and Editors can update persons" ON public.persons;
CREATE POLICY "persons_update_branch_scoped" ON public.persons
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND id IN (SELECT visible_id FROM public.visible_person_ids()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "Admins and Editors can delete persons" ON public.persons;
CREATE POLICY "persons_delete_branch_scoped" ON public.persons
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

-- ─── relationships ───────────────────────────────────────────────────────
-- INSERT: chỉ cần 1 trong 2 phía đã nằm trong nhánh (phía còn lại là
-- người mới/hoặc người sắp được nối, sẽ tự "vào nhánh" sau khi lưu).
-- UPDATE/DELETE: cả 2 phía phải nằm trong nhánh (đây là quan hệ đã tồn tại,
-- không có khái niệm "người mới chưa vào nhánh" nữa).

DROP POLICY IF EXISTS "Admins and Editors can insert relationships" ON public.relationships;
CREATE POLICY "relationships_insert_branch_scoped" ON public.relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        person_a IN (SELECT visible_id FROM public.visible_person_ids())
        OR person_b IN (SELECT visible_id FROM public.visible_person_ids())
      )
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can update relationships" ON public.relationships;
CREATE POLICY "relationships_update_branch_scoped" ON public.relationships
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_editor()
      AND person_a IN (SELECT visible_id FROM public.visible_person_ids())
      AND person_b IN (SELECT visible_id FROM public.visible_person_ids())
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_editor()
      AND person_a IN (SELECT visible_id FROM public.visible_person_ids())
      AND person_b IN (SELECT visible_id FROM public.visible_person_ids())
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete relationships" ON public.relationships;
CREATE POLICY "relationships_delete_branch_scoped" ON public.relationships
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_editor()
      AND person_a IN (SELECT visible_id FROM public.visible_person_ids())
      AND person_b IN (SELECT visible_id FROM public.visible_person_ids())
    )
  );

-- ─── families: UPDATE / DELETE giới hạn theo nhánh ──────────────────────
-- INSERT giữ nguyên không giới hạn (family trơ, vô hại).

DROP POLICY IF EXISTS "families_update_admin_editor" ON public.families;
CREATE POLICY "families_update_branch_scoped" ON public.families
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = families.id AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = families.id AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = families.id AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = families.id AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "families_delete_admin_editor" ON public.families;
CREATE POLICY "families_delete_branch_scoped" ON public.families
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = families.id AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = families.id AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
      )
    )
  );

-- ─── family_parents ──────────────────────────────────────────────────────
-- INSERT: person_id đang thêm nằm trong nhánh, HOẶC family đó đã có sẵn
-- 1 thành viên (cha/mẹ hoặc con) khác thuộc nhánh editor (cho phép thêm
-- vợ/chồng mới vào 1 family đã có neo trong nhánh).

DROP POLICY IF EXISTS "family_parents_insert_admin_editor" ON public.family_parents;
CREATE POLICY "family_parents_insert_branch_scoped" ON public.family_parents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        person_id IN (SELECT visible_id FROM public.visible_person_ids())
        OR EXISTS (SELECT 1 FROM public.family_parents fp2 WHERE fp2.family_id = family_parents.family_id AND fp2.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR EXISTS (SELECT 1 FROM public.family_children fc2 WHERE fc2.family_id = family_parents.family_id AND fc2.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "family_parents_update_admin_editor" ON public.family_parents;
CREATE POLICY "family_parents_update_branch_scoped" ON public.family_parents
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "family_parents_delete_admin_editor" ON public.family_parents;
CREATE POLICY "family_parents_delete_branch_scoped" ON public.family_parents
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

-- ─── family_children ─────────────────────────────────────────────────────
-- Cùng nguyên tắc với family_parents (đảo vai trò cha/mẹ <-> con).

DROP POLICY IF EXISTS "family_children_insert_admin_editor" ON public.family_children;
CREATE POLICY "family_children_insert_branch_scoped" ON public.family_children
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        person_id IN (SELECT visible_id FROM public.visible_person_ids())
        OR EXISTS (SELECT 1 FROM public.family_parents fp2 WHERE fp2.family_id = family_children.family_id AND fp2.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR EXISTS (SELECT 1 FROM public.family_children fc2 WHERE fc2.family_id = family_children.family_id AND fc2.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "family_children_update_admin_editor" ON public.family_children;
CREATE POLICY "family_children_update_branch_scoped" ON public.family_children
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "family_children_delete_admin_editor" ON public.family_children;
CREATE POLICY "family_children_delete_branch_scoped" ON public.family_children
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

-- ─── events: UPDATE / DELETE giới hạn theo nhánh ────────────────────────
-- INSERT giữ nguyên không giới hạn (event trơ, chưa gắn ai thì vô hại,
-- không ai xem được kể cả người tạo — trừ admin — theo events_select_branch_scoped).

DROP POLICY IF EXISTS "events_update_admin_editor" ON public.events;
CREATE POLICY "events_update_branch_scoped" ON public.events
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR (events.family_id IS NOT NULL AND (
          EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = events.family_id AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
          OR EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = events.family_id AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        ))
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR (events.family_id IS NOT NULL AND (
          EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = events.family_id AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
          OR EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = events.family_id AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        ))
      )
    )
  );

DROP POLICY IF EXISTS "events_delete_admin_editor" ON public.events;
CREATE POLICY "events_delete_branch_scoped" ON public.events
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_editor()
      AND (
        EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        OR (events.family_id IS NOT NULL AND (
          EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = events.family_id AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
          OR EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = events.family_id AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
        ))
      )
    )
  );

-- ─── person_events: INSERT / UPDATE / DELETE giới hạn theo nhánh ───────
-- Đây luôn là bước "nối" (person_id đã tồn tại từ trước), nên INSERT cũng
-- giới hạn được luôn, không cần ngoại lệ "trơ" như persons/families/events.

DROP POLICY IF EXISTS "person_events_insert_admin_editor" ON public.person_events;
CREATE POLICY "person_events_insert_branch_scoped" ON public.person_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "person_events_update_admin_editor" ON public.person_events;
CREATE POLICY "person_events_update_branch_scoped" ON public.person_events
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "person_events_delete_admin_editor" ON public.person_events;
CREATE POLICY "person_events_delete_branch_scoped" ON public.person_events
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

-- ─── person_names: INSERT / UPDATE / DELETE giới hạn theo nhánh ────────
-- Luôn gắn với 1 person_id đã tồn tại (không có khái niệm "trơ").

DROP POLICY IF EXISTS "person_names_insert_admin_editor" ON public.person_names;
CREATE POLICY "person_names_insert_branch_scoped" ON public.person_names
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "person_names_update_admin_editor" ON public.person_names;
CREATE POLICY "person_names_update_branch_scoped" ON public.person_names
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );

DROP POLICY IF EXISTS "person_names_delete_admin_editor" ON public.person_names;
CREATE POLICY "person_names_delete_branch_scoped" ON public.person_names
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_editor() AND person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  );
