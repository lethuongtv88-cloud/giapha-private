-- 053_branch_scoped_rls.sql
--
-- Thay the cac policy SELECT hien dang "USING (true)" / "auth.uid() IS NOT NULL"
-- (khong loc nhanh) tren persons/relationships/events/person_events/
-- families/family_parents/family_children bang RLS that su loc theo nhanh,
-- MO PHONG CHINH XAC logic hien co trong utils/permissions/visiblePersons.ts:
--
--   - role = 'admin'            -> thay toan bo persons con active (deleted_at IS NULL)
--   - role = 'editor' / 'member' -> KHONG co ngoai le (giong het JS: chi 'admin' duoc bypass),
--     phai tra theo profiles.person_id, thay:
--       1) chinh minh
--       2) "lineage": voi moi to tien (ke ca ban than), toan bo hau due cua to tien do
--          (= huyet thong day du: ong ba, cha me, anh chi em, co di chu bac, chau...)
--       3) "lineage_spouse": vo/chong cua bat ky ai trong (2)
--       4) "direct_spouse": vo/chong truc tiep cua viewer
--       5) "direct_spouse_lineage": lineage day du cua vo/chong viewer (ap lai buoc 2)
--       6) "direct_spouse_lineage_spouse": vo/chong cua bat ky ai trong (5)
--
--   Canh cha-me/con va canh vo-chong duoc gop tu CA HAI nguon du lieu, giong JS:
--     - bang relationships (legacy): type IN ('biological_child','adopted_child') va type = 'marriage'
--     - bang family_parents + family_children (Family Model): moi cap cha/me trong cung
--       1 family duoc coi la vo/chong cua nhau, ke ca khi khong co relationships.type='marriage'
--
-- LUU Y QUAN TRONG:
--   - Bang custom_events (legacy, truoc Event Model) KHONG nam trong pham vi migration nay vi
--     visiblePersons.ts cung khong co logic loc cho no. custom_events van "USING (true)" nhu cu.
--     Can xu ly rieng neu van con dung.
--   - Voi bang events co gan family_id (su kien chung cua 1 gia dinh, khong qua person_events),
--     JS goc (filterPersonEventsByVisiblePersons) KHONG co logic loc rieng cho case nay - co the
--     la mot khoang trong co san trong ung dung. Migration nay MO RONG hop ly: mot event duoc coi
--     la visible neu co person_events tro toi visible person, HOAC neu event co family_id va gia
--     dinh do co cha/me hoac con la visible person. Xem lai phan "events" ben duoi neu muon behavior
--     khac.
--   - Ham visible_person_ids() dung SECURITY DEFINER de tu no bypass RLS khi truy van
--     persons/relationships/families/family_parents/family_children - bat buoc phai vay,
--     neu khong se tao vong lap policy goi lai chinh RLS dang duoc bao ve.
--   - Day la truy van de quy (WITH RECURSIVE) chay tren moi cau SELECT persons/relationships/...
--     Can EXPLAIN ANALYZE + test tren du lieu that truoc khi ap dung production, dac biet neu
--     cay gia pha lon (vai nghin person tro len).

-- --- Ham loi: tinh tap person_id ma user hien tai duoc phep xem -------------

BEGIN;

CREATE OR REPLACE FUNCTION public.visible_person_ids()
RETURNS TABLE(visible_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_viewer_person_id uuid;
BEGIN
  SELECT role::text, person_id
  INTO v_role, v_viewer_person_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Admin: thay toan bo person con active. Khop voi
  -- `if (input.role === "admin") { ... tat ca activePersonIds ... }`
  IF v_role = 'admin' THEN
    RETURN QUERY SELECT p.id FROM public.persons p WHERE p.deleted_at IS NULL;
    RETURN;
  END IF;

  -- Chua gan tai khoan voi person nao -> khong thay ai.
  -- Khop voi `if (!viewerPersonId) { warnings.push(...); return {...rong} }`
  IF v_viewer_person_id IS NULL THEN
    RETURN;
  END IF;

  -- Person gan voi tai khoan da bi xoa -> khong thay ai.
  -- Khop voi `if (!graphs.activePersonIds.has(viewerPersonId)) { ... return {...rong} }`
  IF NOT EXISTS (
    SELECT 1 FROM public.persons p
    WHERE p.id = v_viewer_person_id AND p.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  -- Canh cha/me -> con (directed), gop relationships (legacy) + Family Model.
  -- Khop buildGraphs(): parentToChildren / childToParents.
  parent_child_edges AS (
    SELECT r.person_a AS parent_id, r.person_b AS child_id
    FROM public.relationships r
    WHERE r.deleted_at IS NULL
      AND r.type IN ('biological_child', 'adopted_child')
      AND EXISTS (SELECT 1 FROM public.persons pa WHERE pa.id = r.person_a AND pa.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pb WHERE pb.id = r.person_b AND pb.deleted_at IS NULL)

    UNION

    SELECT fp.person_id AS parent_id, fc.person_id AS child_id
    FROM public.family_parents fp
    JOIN public.family_children fc ON fc.family_id = fp.family_id
    WHERE EXISTS (SELECT 1 FROM public.families f WHERE f.id = fp.family_id AND f.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pp WHERE pp.id = fp.person_id AND pp.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pc WHERE pc.id = fc.person_id AND pc.deleted_at IS NULL)
  ),

  -- Canh vo/chong (2 chieu), gop relationships.type='marriage' + dong cha/me trong 1 family.
  -- Khop buildGraphs(): spouseGraph (addUndirectedEdge tu marriage + tu moi cap parentsByFamily).
  spouse_edges AS (
    SELECT r.person_a AS a, r.person_b AS b
    FROM public.relationships r
    WHERE r.deleted_at IS NULL AND r.type = 'marriage'
      AND EXISTS (SELECT 1 FROM public.persons pa WHERE pa.id = r.person_a AND pa.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pb WHERE pb.id = r.person_b AND pb.deleted_at IS NULL)
    UNION
    SELECT r.person_b AS a, r.person_a AS b
    FROM public.relationships r
    WHERE r.deleted_at IS NULL AND r.type = 'marriage'
      AND EXISTS (SELECT 1 FROM public.persons pa WHERE pa.id = r.person_a AND pa.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pb WHERE pb.id = r.person_b AND pb.deleted_at IS NULL)
    UNION
    SELECT fp1.person_id AS a, fp2.person_id AS b
    FROM public.family_parents fp1
    JOIN public.family_parents fp2
      ON fp2.family_id = fp1.family_id AND fp2.person_id <> fp1.person_id
    WHERE EXISTS (SELECT 1 FROM public.families f WHERE f.id = fp1.family_id AND f.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons p1 WHERE p1.id = fp1.person_id AND p1.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons p2 WHERE p2.id = fp2.person_id AND p2.deleted_at IS NULL)
  ),

  -- To tien cua viewer (di nguoc len), bao gom chinh viewer.
  -- Khop collectReachable(personId, childToParents) trong buildLineageScope().
  ancestors AS (
    SELECT v_viewer_person_id AS id
    UNION
    SELECT pce.parent_id
    FROM parent_child_edges pce
    JOIN ancestors a ON a.id = pce.child_id
  ),

  -- Voi MOI to tien (ke ca viewer), lay toan bo hau due -> hop lai = lineage scope cua viewer.
  -- Khop buildLineageScope(): for (ancestorId of ancestors) { scope.add(collectReachable(ancestorId, parentToChildren)) }
  lineage_scope AS (
    SELECT id FROM ancestors
    UNION
    SELECT pce.child_id
    FROM parent_child_edges pce
    JOIN lineage_scope ls ON ls.id = pce.parent_id
  ),

  -- Vo/chong truc tiep cua viewer. Khop graphs.spouseGraph.get(viewerPersonId).
  viewer_spouses AS (
    SELECT b AS id FROM spouse_edges WHERE a = v_viewer_person_id
  ),

  -- To tien cua TUNG vo/chong truc tiep cua viewer (base cho spouse_lineage_scope).
  spouse_ancestors AS (
    SELECT vs.id FROM viewer_spouses vs
    UNION
    SELECT pce.parent_id
    FROM parent_child_edges pce
    JOIN spouse_ancestors sa ON sa.id = pce.child_id
  ),

  -- Lineage scope day du cua (cac) vo/chong viewer.
  -- Khop: for (spouseId of ...) { spouseLineage = buildLineageScope(spouseId, graphs) }
  spouse_lineage_scope AS (
    SELECT id FROM spouse_ancestors
    UNION
    SELECT pce.child_id
    FROM parent_child_edges pce
    JOIN spouse_lineage_scope sls ON sls.id = pce.parent_id
  )

  -- Hop nhat toan bo, khop addLineageWithSpouses() cho ca 2 nhanh (viewer + spouse).
  SELECT DISTINCT v.id
  FROM (
    SELECT v_viewer_person_id AS id                                           -- "self"
    UNION SELECT id FROM lineage_scope                                        -- "lineage"
    UNION SELECT se.b FROM spouse_edges se JOIN lineage_scope ls ON ls.id = se.a   -- "lineage_spouse"
    UNION SELECT id FROM viewer_spouses                                       -- "direct_spouse"
    UNION SELECT id FROM spouse_lineage_scope                                 -- "direct_spouse_lineage"
    UNION SELECT se.b FROM spouse_edges se JOIN spouse_lineage_scope sls ON sls.id = se.a -- "direct_spouse_lineage_spouse"
  ) v
  JOIN public.persons p ON p.id = v.id AND p.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.visible_person_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visible_person_ids() TO authenticated;

-- --- persons -------------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.persons;
CREATE POLICY "persons_select_branch_scoped"
ON public.persons
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND id IN (SELECT visible_id FROM public.visible_person_ids())
);

-- --- relationships -------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.relationships;
CREATE POLICY "relationships_select_branch_scoped"
ON public.relationships
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND person_a IN (SELECT visible_id FROM public.visible_person_ids())
  AND person_b IN (SELECT visible_id FROM public.visible_person_ids())
);

-- --- person_events -------------------------------------------------------

DROP POLICY IF EXISTS "Read person_events" ON public.person_events;
CREATE POLICY "person_events_select_branch_scoped"
ON public.person_events
FOR SELECT
TO authenticated
USING (
  person_id IN (SELECT visible_id FROM public.visible_person_ids())
);

-- --- events --------------------------------------------------------------
-- Visible neu: co person_events tro toi visible person (dung theo
-- filterPersonEventsByVisiblePersons), HOAC event gan family_id ma gia dinh
-- do co cha/me/con la visible person (mo rong hop ly, xem ghi chu dau file).

DROP POLICY IF EXISTS "Read events" ON public.events;
CREATE POLICY "events_select_branch_scoped"
ON public.events
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.person_events pe
      WHERE pe.event_id = events.id
        AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids())
    )
    OR (
      events.family_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.family_parents fp
          WHERE fp.family_id = events.family_id
            AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids())
        )
        OR EXISTS (
          SELECT 1 FROM public.family_children fc
          WHERE fc.family_id = events.family_id
            AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids())
        )
      )
    )
  )
);

-- --- families / family_parents / family_children ------------------------
-- Visible neu co it nhat 1 cha/me HOAC 1 con trong family do la visible person.

DROP POLICY IF EXISTS "Read families" ON public.families;
CREATE POLICY "families_select_branch_scoped"
ON public.families
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.family_parents fp
      WHERE fp.family_id = families.id
        AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids())
    )
    OR EXISTS (
      SELECT 1 FROM public.family_children fc
      WHERE fc.family_id = families.id
        AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids())
    )
  )
);

DROP POLICY IF EXISTS "Read family_parents" ON public.family_parents;
CREATE POLICY "family_parents_select_branch_scoped"
ON public.family_parents
FOR SELECT
TO authenticated
USING (
  person_id IN (SELECT visible_id FROM public.visible_person_ids())
  OR EXISTS (
    SELECT 1 FROM public.family_children fc
    WHERE fc.family_id = family_parents.family_id
      AND fc.person_id IN (SELECT visible_id FROM public.visible_person_ids())
  )
);

DROP POLICY IF EXISTS "Read family_children" ON public.family_children;
CREATE POLICY "family_children_select_branch_scoped"
ON public.family_children
FOR SELECT
TO authenticated
USING (
  person_id IN (SELECT visible_id FROM public.visible_person_ids())
  OR EXISTS (
    SELECT 1 FROM public.family_parents fp
    WHERE fp.family_id = family_children.family_id
      AND fp.person_id IN (SELECT visible_id FROM public.visible_person_ids())
  )
);

-- --- QUAN TRONG: tach cac policy "Editors manage X" khoi SELECT ----------
--
-- Cac policy "Editors manage events/families/family_children/family_parents/
-- person_events" duoc tao KHONG khai bao "FOR ...", nen Postgres mac dinh
-- hieu la FOR ALL - tuc la chung DANG cap luon quyen SELECT khong gioi han
-- cho is_admin() OR is_editor(). RLS gop nhieu policy permissive bang OR,
-- nen neu giu nguyen cac policy nay, editor van nhin thay TOAN BO 5 bang
-- tren bat ke policy *_select_branch_scoped moi o tren - khong khop voi
-- visiblePersons.ts (chi 'admin' duoc bypass, 'editor' van bi gioi han nhanh
-- giong 'member'). Tach lai thanh INSERT/UPDATE/DELETE rieng de loai bo
-- phan SELECT ngam dinh.

DROP POLICY IF EXISTS "Editors manage events" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin_editor" ON public.events;
CREATE POLICY "events_insert_admin_editor" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "events_update_admin_editor" ON public.events;
CREATE POLICY "events_update_admin_editor" ON public.events
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "events_delete_admin_editor" ON public.events;
CREATE POLICY "events_delete_admin_editor" ON public.events
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());

DROP POLICY IF EXISTS "Editors manage families" ON public.families;
DROP POLICY IF EXISTS "families_insert_admin_editor" ON public.families;
CREATE POLICY "families_insert_admin_editor" ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "families_update_admin_editor" ON public.families;
CREATE POLICY "families_update_admin_editor" ON public.families
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "families_delete_admin_editor" ON public.families;
CREATE POLICY "families_delete_admin_editor" ON public.families
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());

DROP POLICY IF EXISTS "Editors manage family_children" ON public.family_children;
DROP POLICY IF EXISTS "family_children_insert_admin_editor" ON public.family_children;
CREATE POLICY "family_children_insert_admin_editor" ON public.family_children
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "family_children_update_admin_editor" ON public.family_children;
CREATE POLICY "family_children_update_admin_editor" ON public.family_children
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "family_children_delete_admin_editor" ON public.family_children;
CREATE POLICY "family_children_delete_admin_editor" ON public.family_children
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());

DROP POLICY IF EXISTS "Editors manage family_parents" ON public.family_parents;
DROP POLICY IF EXISTS "family_parents_insert_admin_editor" ON public.family_parents;
CREATE POLICY "family_parents_insert_admin_editor" ON public.family_parents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "family_parents_update_admin_editor" ON public.family_parents;
CREATE POLICY "family_parents_update_admin_editor" ON public.family_parents
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "family_parents_delete_admin_editor" ON public.family_parents;
CREATE POLICY "family_parents_delete_admin_editor" ON public.family_parents
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());

DROP POLICY IF EXISTS "Editors manage person_events" ON public.person_events;
DROP POLICY IF EXISTS "person_events_insert_admin_editor" ON public.person_events;
CREATE POLICY "person_events_insert_admin_editor" ON public.person_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "person_events_update_admin_editor" ON public.person_events;
CREATE POLICY "person_events_update_admin_editor" ON public.person_events
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());
DROP POLICY IF EXISTS "person_events_delete_admin_editor" ON public.person_events;
CREATE POLICY "person_events_delete_admin_editor" ON public.person_events
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());

-- Luu y: "Editors manage import sessions" / "Editors manage import staging
-- records" (bang import_sessions, import_staging_records) CO Y khong dung
-- toi o day - 2 bang do khong nam trong pham vi lineage-scoping (chi admin/
-- editor moi can thay, khong co khai niem "member xem theo nhanh" cho du
-- lieu dang import), nen FOR ALL hien tai la dung y do, khong phai lo hong.

COMMIT;
