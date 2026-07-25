-- 063_repair_single_parent_family_children.sql
--
-- BUG: Khi thêm con (hoặc con nuôi) mà chỉ chọn 1 cha/mẹ, và người đó thật
-- ra chỉ có 1 vợ/chồng duy nhất, hệ thống KHÔNG tự gán người còn lại. Hệ
-- quả trong dữ liệu:
--   1. Bảng family_children/family_parents: đứa con nằm trong 1 family chỉ
--      có 1 dòng family_parents (thiếu vợ/chồng còn lại).
--   2. Bảng relationships (bảng "gốc" cũ): chỉ có 1 dòng
--      (cha/mẹ đã chọn -> con), KHÔNG có dòng (vợ/chồng còn lại -> con).
--
-- Hậu quả hiển thị: khi mở trang người vợ/chồng còn lại, RelationshipManager
-- phải suy ra con từ family_children rồi gắn nhãn fallback "(Con)" chung
-- chung (không rõ thứ tự sinh, không có dòng relationships thật) - đồng thời
-- các chức năng khác đọc trực tiếp bảng relationships (tính thế hệ, danh
-- sách con theo cha/mẹ, cây phả hệ dạng cũ, v.v.) sẽ KHÔNG thấy người vợ/
-- chồng còn lại là cha/mẹ của đứa trẻ.
--
-- Từ migration 061 trở đi, ensure_family_model_child() đã có "BƯỚC 0": nếu
-- con đã thuộc 1 family rồi thì bổ sung cha/mẹ còn thiếu ngay vào family đó
-- (không tạo/gộp family mới). Vì vậy với dữ liệu phát sinh SAU migration
-- 061, trường hợp thường gặp chỉ là "family đã đúng nhưng thiếu 1 dòng
-- family_parents + thiếu 1 dòng relationships". Tuy nhiên dữ liệu cũ (tạo
-- trước migration 061, khi logic còn tìm "family gần nhất") có thể để lại
-- HAI family riêng biệt cho cùng 1 cặp vợ chồng (1 family chỉ có 1 người +
-- 1 con, 1 family khác đã có đủ cả 2 người). Script này xử lý cả 2 trường
-- hợp:
--   (a) Chưa có family nào khác chứa đủ cả 2 vợ chồng -> bổ sung thẳng
--       người còn lại vào family hiện tại của đứa con.
--   (b) Đã có sẵn 1 family khác chứa đủ cả 2 vợ chồng -> chuyển (move) các
--       family_children đang bị "mắc kẹt" trong family lẻ sang family
--       chung đó, rồi dọn (soft-delete) family lẻ đã rỗng.
-- Sau đó, với mọi con trong family đã đúng, đảm bảo có đủ dòng
-- relationships (vợ/chồng còn lại -> con) để đồng bộ với các chức năng
-- dùng bảng relationships cũ.
--
-- AN TOÀN / PHẠM VI:
--   - CHỈ tự động xử lý khi cha/mẹ đã có sẵn CÓ ĐÚNG 1 vợ/chồng đang hoạt
--     động (1 dòng relationships type='marriage', deleted_at IS NULL).
--     Nếu có 0 hoặc >= 2 vợ/chồng (đa thê/đa phu, tái hôn, ly hôn nhiều
--     lần...) -> KHÔNG tự động, bỏ qua để tránh gán sai (ambiguous).
--   - Bỏ qua nếu vợ/chồng suy ra được đã bị soft-delete, hoặc chính người
--     đó lại đang là "con" trong cùng family (dữ liệu lỗi khác, cần soát
--     tay riêng, không tự sửa ở đây).
--   - Chỉ INSERT/soft-delete, không hard-delete gì.
--   - Idempotent: chạy lại nhiều lần không tạo thêm dữ liệu trùng (dùng
--     ON CONFLICT DO NOTHING / NOT EXISTS trước khi insert).
--
-- CÁCH DÙNG:
--   1. (Khuyến nghị) Chạy khối PREVIEW bên dưới (chỉ SELECT, không sửa gì)
--      để xem trước những family/con sẽ bị ảnh hưởng.
--   2. Áp migration này để tạo function
--      public.repair_single_parent_family_children().
--   3. Gọi (chỉ admin - function tự kiểm tra role):
--        SELECT public.repair_single_parent_family_children();
--      Kết quả trả về JSONB tóm tắt số lượng đã sửa.

-- =========================================================================
-- PREVIEW (chạy tay, không nằm trong migration - chỉ để tham khảo trước khi
-- gọi function repair bên dưới):
--
-- SELECT
--   f.id AS family_id,
--   fp.person_id AS lone_parent_id,
--   lone.full_name AS lone_parent_name,
--   (
--     SELECT CASE WHEN r.person_a = fp.person_id THEN r.person_b ELSE r.person_a END
--     FROM public.relationships r
--     WHERE r.type = 'marriage' AND r.deleted_at IS NULL
--       AND (r.person_a = fp.person_id OR r.person_b = fp.person_id)
--   ) AS inferred_spouse_id,
--   (SELECT COUNT(*) FROM public.family_children fc WHERE fc.family_id = f.id) AS children_count
-- FROM public.families f
-- JOIN public.family_parents fp ON fp.family_id = f.id
-- JOIN public.persons lone ON lone.id = fp.person_id
-- WHERE f.deleted_at IS NULL
--   AND EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = f.id)
--   AND (SELECT COUNT(*) FROM public.family_parents fp2 WHERE fp2.family_id = f.id) = 1
--   AND (
--     SELECT COUNT(*) FROM public.relationships r2
--     WHERE r2.type = 'marriage' AND r2.deleted_at IS NULL
--       AND (r2.person_a = fp.person_id OR r2.person_b = fp.person_id)
--   ) = 1
-- ORDER BY f.created_at DESC;
-- =========================================================================

BEGIN;

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

  -- Snapshot toàn bộ family "mồ côi 1 bên cha/mẹ" cần sửa, xác định trước
  -- khi bắt đầu vòng lặp sửa dữ liệu.
  FOR v_row IN
    SELECT
      f.id AS family_id,
      fp.person_id AS lone_parent_id,
      (
        SELECT CASE WHEN r.person_a = fp.person_id THEN r.person_b ELSE r.person_a END
        FROM public.relationships r
        WHERE r.type = 'marriage'
          AND r.deleted_at IS NULL
          AND (r.person_a = fp.person_id OR r.person_b = fp.person_id)
      ) AS spouse_id
    FROM public.families f
    JOIN public.family_parents fp ON fp.family_id = f.id
    WHERE f.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.family_children fc WHERE fc.family_id = f.id
      )
      AND (
        SELECT COUNT(*) FROM public.family_parents fp2 WHERE fp2.family_id = f.id
      ) = 1
      AND (
        SELECT COUNT(*) FROM public.relationships r2
        WHERE r2.type = 'marriage' AND r2.deleted_at IS NULL
          AND (r2.person_a = fp.person_id OR r2.person_b = fp.person_id)
      ) = 1
  LOOP
    BEGIN
      v_family_id := v_row.family_id;
      v_lone_parent := v_row.lone_parent_id;
      v_spouse := v_row.spouse_id;

      IF v_spouse IS NULL THEN
        CONTINUE;
      END IF;

      -- Bỏ qua nếu vợ/chồng suy ra được đã bị soft-delete.
      IF EXISTS (
        SELECT 1 FROM public.persons p
        WHERE p.id = v_spouse AND p.deleted_at IS NOT NULL
      ) THEN
        CONTINUE;
      END IF;

      -- Bỏ qua nếu vợ/chồng lại đang là "con" trong chính family này
      -- (dữ liệu lỗi khác - không tự sửa ở đây, để data-quality tool riêng
      -- xử lý).
      IF EXISTS (
        SELECT 1 FROM public.family_children fc
        WHERE fc.family_id = v_family_id AND fc.person_id = v_spouse
      ) THEN
        CONTINUE;
      END IF;

      -- Gia đình khác (nếu có) đã chứa sẵn CẢ HAI vợ chồng này rồi - xảy ra
      -- với dữ liệu cũ tạo trước migration 061 (logic cũ có thể tạo family
      -- lẻ riêng thay vì dùng lại family đã có của con).
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
        -- (b) Đã có family chung -> chuyển toàn bộ con từ family lẻ sang
        -- family chung, rồi dọn family lẻ đã rỗng.
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
        -- (a) Chưa có family chung -> bổ sung thẳng vợ/chồng còn lại vào
        -- family hiện tại của đứa con.
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

      -- Đồng bộ bảng relationships "gốc": đảm bảo có dòng
      -- (vợ/chồng còn lại -> con) cho MỌI con hiện có trong family đã đúng
      -- (kể cả con vốn đã ở family chung từ trước, để chắc chắn nhất quán).
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
