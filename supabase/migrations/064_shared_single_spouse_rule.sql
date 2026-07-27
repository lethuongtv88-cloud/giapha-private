-- 064_shared_single_spouse_rule.sql
--
-- Theo góp ý review cho migration 063:
--   1. "Vợ/chồng duy nhất" chỉ nên tính hôn nhân đang status='active'
--      (không tính đã ly hôn/ly thân) - tránh tự gán nhầm người cũ khi
--      thêm con mới.
--   2. Phải loại vợ/chồng đã bị soft-delete (persons.deleted_at) ngay tại
--      nguồn, không chỉ ở phía repair SQL.
--   3. Đưa quy tắc "tìm vợ/chồng duy nhất" thành 1 function Postgres dùng
--      chung, để UI (React), SQL repair, và các luồng khác sau này (import
--      GEDCOM, API, batch...) đều áp dụng đúng 1 quy tắc duy nhất, tránh
--      logic bị phân tán giữa TypeScript và SQL.

BEGIN;

-- Trả về vợ/chồng DUY NHẤT (hôn nhân type='marriage', chưa xoá,
-- status='active', và bản thân người đó chưa bị soft-delete) của 1 người.
-- Trả về NULL nếu có 0 hoặc >= 2 vợ/chồng thoả điều kiện (không đoán khi
-- mập mờ - đa thê/đa phu, tái hôn, ly hôn...).
CREATE OR REPLACE FUNCTION public.get_single_active_spouse(p_person_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN COUNT(*) = 1 THEN MIN(spouse_id) ELSE NULL END
  FROM (
    SELECT DISTINCT
      CASE WHEN r.person_a = p_person_id THEN r.person_b ELSE r.person_a END AS spouse_id
    FROM public.relationships r
    WHERE r.type = 'marriage'
      AND r.deleted_at IS NULL
      AND r.status = 'active'
      AND p_person_id IS NOT NULL
      AND (r.person_a = p_person_id OR r.person_b = p_person_id)
  ) spouses
  JOIN public.persons p ON p.id = spouses.spouse_id
  WHERE p.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_single_active_spouse(UUID) TO authenticated;

-- Cập nhật lại repair_single_parent_family_children() để dùng chung
-- get_single_active_spouse() thay vì tự suy luận lại (đồng thời áp dụng
-- luôn điều kiện status='active').
CREATE OR REPLACE FUNCTION public.repair_single_parent_family_children()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_family_id UUID;
  v_lone_parent UUID;
  v_spouse UUID;
  v_gender TEXT;
  v_target_family UUID;
  v_child RECORD;
  v_rel_type public.relationship_type_enum;
  v_families_completed INTEGER := 0;
  v_families_merged INTEGER := 0;
  v_children_moved INTEGER := 0;
  v_relationships_inserted INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Snapshot toàn bộ family "mồ côi 1 bên cha/mẹ" cần sửa, dùng
  -- get_single_active_spouse() làm nguồn suy luận duy nhất (đã lọc
  -- status='active' và loại người đã soft-delete).
  FOR v_row IN
    SELECT
      f.id AS family_id,
      fp.person_id AS lone_parent_id,
      public.get_single_active_spouse(fp.person_id) AS spouse_id
    FROM public.families f
    JOIN public.family_parents fp ON fp.family_id = f.id
    WHERE f.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.family_children fc WHERE fc.family_id = f.id
      )
      AND (
        SELECT COUNT(*) FROM public.family_parents fp2 WHERE fp2.family_id = f.id
      ) = 1
  LOOP
    BEGIN
      v_family_id := v_row.family_id;
      v_lone_parent := v_row.lone_parent_id;
      v_spouse := v_row.spouse_id;

      IF v_spouse IS NULL THEN
        CONTINUE;
      END IF;

      -- Bỏ qua nếu vợ/chồng lại đang là "con" trong chính family này
      -- (dữ liệu lỗi khác - không tự sửa ở đây).
      IF EXISTS (
        SELECT 1 FROM public.family_children fc
        WHERE fc.family_id = v_family_id AND fc.person_id = v_spouse
      ) THEN
        CONTINUE;
      END IF;

      -- Gia đình khác (nếu có) đã chứa sẵn CẢ HAI vợ chồng này rồi - xảy ra
      -- với dữ liệu cũ tạo trước migration 061.
      SELECT fp1.family_id
      INTO v_target_family
      FROM public.family_parents fp1
      JOIN public.family_parents fp2
        ON fp2.family_id = fp1.family_id AND fp2.person_id = v_spouse
      JOIN public.families f2
        ON f2.id = fp1.family_id AND f2.deleted_at IS NULL
      WHERE fp1.person_id = v_lone_parent
        AND fp1.family_id <> v_family_id
      LIMIT 1;

      IF v_target_family IS NOT NULL THEN
        FOR v_child IN
          SELECT * FROM public.family_children WHERE family_id = v_family_id
        LOOP
          INSERT INTO public.family_children (
            family_id, person_id, relationship_type, sort_order,
            legacy_relationship_id, migration_confidence
          )
          VALUES (
            v_target_family, v_child.person_id, v_child.relationship_type,
            v_child.sort_order, v_child.legacy_relationship_id,
            v_child.migration_confidence
          )
          ON CONFLICT (family_id, person_id) DO NOTHING;

          DELETE FROM public.family_children WHERE id = v_child.id;

          v_children_moved := v_children_moved + 1;
        END LOOP;

        DELETE FROM public.family_parents WHERE family_id = v_family_id;

        UPDATE public.families
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = v_family_id;

        v_families_merged := v_families_merged + 1;
        v_family_id := v_target_family;
      ELSE
        SELECT gender::TEXT INTO v_gender FROM public.persons WHERE id = v_spouse;

        INSERT INTO public.family_parents (family_id, person_id, role, sort_order)
        VALUES (
          v_family_id,
          v_spouse,
          (CASE
            WHEN v_gender = 'male' THEN 'husband'
            WHEN v_gender = 'female' THEN 'wife'
            ELSE 'partner'
          END)::public.parent_role_enum,
          1
        )
        ON CONFLICT (family_id, person_id) DO NOTHING;

        v_families_completed := v_families_completed + 1;
      END IF;

      FOR v_child IN
        SELECT fc.person_id, fc.relationship_type
        FROM public.family_children fc
        WHERE fc.family_id = v_family_id
      LOOP
        v_rel_type := CASE
          WHEN v_child.relationship_type = 'adopted'
            THEN 'adopted_child'::public.relationship_type_enum
          ELSE 'biological_child'::public.relationship_type_enum
        END;

        IF NOT EXISTS (
          SELECT 1 FROM public.relationships r
          WHERE r.person_a = v_spouse
            AND r.person_b = v_child.person_id
            AND r.type IN ('biological_child', 'adopted_child')
            AND r.deleted_at IS NULL
        ) THEN
          INSERT INTO public.relationships (person_a, person_b, type)
          VALUES (v_spouse, v_child.person_id, v_rel_type);

          v_relationships_inserted := v_relationships_inserted + 1;
        END IF;
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'family_id', v_row.family_id,
        'lone_parent_id', v_row.lone_parent_id,
        'spouse_id', v_row.spouse_id,
        'error', SQLERRM,
        'code', SQLSTATE
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'families_completed_with_spouse', v_families_completed,
    'families_merged_into_existing', v_families_merged,
    'children_moved', v_children_moved,
    'relationships_inserted', v_relationships_inserted,
    'errors', v_errors
  );
END;
$$;

COMMIT;
