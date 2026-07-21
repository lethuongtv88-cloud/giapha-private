-- Fix tiếp theo cho ensure_family_model_child: khi thêm cha/mẹ THỨ HAI cho
-- một người (ví dụ đã có cha, giờ thêm mẹ mới tinh), hàm cũ chỉ tìm được gia
-- đình chung nếu CẢ HAI cha/mẹ đã từng cùng nằm trong 1 gia đình từ trước.
-- Vì mẹ là người vừa tạo, không nằm trong gia đình nào cả -> hàm không tìm
-- thấy -> tạo gia đình MỚI -> con đã thuộc gia đình cũ (do thêm cha trước)
-- -> RAISE EXCEPTION 'child already belongs to another active family'.
--
-- Sửa: nếu không tìm thấy gia đình có sẵn CẢ HAI, thử tìm gia đình đã có
-- SẴN p_parent_a (hoặc p_parent_b) rồi TÁI SỬ DỤNG, chỉ thêm người còn lại
-- vào gia đình đó thay vì tạo gia đình mới toanh.

CREATE OR REPLACE FUNCTION public.ensure_family_model_child(
  p_parent_a uuid,
  p_child uuid,
  p_parent_b uuid DEFAULT NULL::uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_family_id uuid;
  v_gender_a text;
  v_gender_b text;
BEGIN

  IF p_parent_a IS NULL OR p_child IS NULL THEN
    RAISE EXCEPTION 'parent_a and child must not be null';
  END IF;

  IF p_parent_b IS NOT NULL
  AND p_parent_a = p_parent_b THEN
    RAISE EXCEPTION 'parent_a and parent_b must be different';
  END IF;

  ------------------------------------------------------------------
  -- CASE 1: Có đủ cha mẹ
  ------------------------------------------------------------------

  IF p_parent_b IS NOT NULL THEN

    -- 1a. Gia đình đã có sẵn CẢ HAI người này rồi (cặp vợ chồng đã tồn tại).
    SELECT f.id
    INTO v_family_id
    FROM families f
    JOIN family_parents fp1
      ON fp1.family_id = f.id
     AND fp1.person_id = p_parent_a
    JOIN family_parents fp2
      ON fp2.family_id = f.id
     AND fp2.person_id = p_parent_b
    WHERE f.deleted_at IS NULL
    LIMIT 1;

    -- 1b. Chưa có gia đình chung -> thử TÁI SỬ DỤNG gia đình đã có sẵn của
    -- p_parent_a (nếu người kia - p_parent_b - chưa nằm trong gia đình nào),
    -- rồi thêm p_parent_b còn thiếu vào gia đình đó.
    IF v_family_id IS NULL THEN
      SELECT f.id
      INTO v_family_id
      FROM families f
      JOIN family_parents fp
        ON fp.family_id = f.id
       AND fp.person_id = p_parent_a
      WHERE f.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM family_parents fp2
          WHERE fp2.person_id = p_parent_b
        )
      ORDER BY f.created_at DESC
      LIMIT 1;

      IF v_family_id IS NOT NULL THEN
        SELECT gender::text INTO v_gender_b FROM persons WHERE id = p_parent_b;

        INSERT INTO family_parents(family_id, person_id, role, sort_order)
        VALUES (
          v_family_id,
          p_parent_b,
          (CASE
            WHEN v_gender_b='male' THEN 'husband'
            WHEN v_gender_b='female' THEN 'wife'
            ELSE 'parent'
          END)::parent_role_enum,
          1
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- 1c. Ngược lại: gia đình đã có sẵn của p_parent_b (p_parent_a mới).
    IF v_family_id IS NULL THEN
      SELECT f.id
      INTO v_family_id
      FROM families f
      JOIN family_parents fp
        ON fp.family_id = f.id
       AND fp.person_id = p_parent_b
      WHERE f.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM family_parents fp2
          WHERE fp2.person_id = p_parent_a
        )
      ORDER BY f.created_at DESC
      LIMIT 1;

      IF v_family_id IS NOT NULL THEN
        SELECT gender::text INTO v_gender_a FROM persons WHERE id = p_parent_a;

        INSERT INTO family_parents(family_id, person_id, role, sort_order)
        VALUES (
          v_family_id,
          p_parent_a,
          (CASE
            WHEN v_gender_a='male' THEN 'husband'
            WHEN v_gender_a='female' THEN 'wife'
            ELSE 'parent'
          END)::parent_role_enum,
          0
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    ----------------------------------------------------------------
    -- 1d. Vẫn không có gì để tái sử dụng → TẠO FAMILY MỚI cho cả hai.
    ----------------------------------------------------------------

    IF v_family_id IS NULL THEN

      INSERT INTO families(status)
      VALUES ('active')
      RETURNING id INTO v_family_id;

      SELECT gender::text
      INTO v_gender_a
      FROM persons
      WHERE id = p_parent_a
        AND deleted_at IS NULL;

      IF v_gender_a IS NULL THEN
        RAISE EXCEPTION 'parent_a not found';
      END IF;

      INSERT INTO family_parents(
        family_id,
        person_id,
        role,
        sort_order
      )
      VALUES (
        v_family_id,
        p_parent_a,
        (CASE
          WHEN v_gender_a='male' THEN 'husband'
          WHEN v_gender_a='female' THEN 'wife'
          ELSE 'parent'
        END)::parent_role_enum,
        0
      );

      SELECT gender::text
      INTO v_gender_b
      FROM persons
      WHERE id = p_parent_b;

      INSERT INTO family_parents(
        family_id,
        person_id,
        role,
        sort_order
      )
      VALUES (
        v_family_id,
        p_parent_b,
        (CASE
          WHEN v_gender_b='male' THEN 'husband'
          WHEN v_gender_b='female' THEN 'wife'
          ELSE 'parent'
        END)::parent_role_enum,
        1
      );
    END IF;

  ------------------------------------------------------------------
  -- CASE 2: Chỉ có 1 parent
  ------------------------------------------------------------------

  ELSE

    SELECT f.id
    INTO v_family_id
    FROM families f
    JOIN family_parents fp
      ON fp.family_id = f.id
     AND fp.person_id = p_parent_a
    WHERE f.deleted_at IS NULL
    ORDER BY f.created_at DESC
    LIMIT 1;

    IF v_family_id IS NULL THEN

      INSERT INTO families(status)
      VALUES ('active')
      RETURNING id INTO v_family_id;

      SELECT gender::text
      INTO v_gender_a
      FROM persons
      WHERE id = p_parent_a;

      INSERT INTO family_parents(
        family_id,
        person_id,
        role,
        sort_order
      )
      VALUES (
        v_family_id,
        p_parent_a,
        (CASE
          WHEN v_gender_a='male' THEN 'husband'
          WHEN v_gender_a='female' THEN 'wife'
          ELSE 'parent'
        END)::parent_role_enum,
        0
      );
    END IF;

  END IF;

  ------------------------------------------------------------------
  -- CHILD
  ------------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM family_children fc
    JOIN families f
      ON f.id = fc.family_id
    WHERE fc.person_id = p_child
      AND f.deleted_at IS NULL
      AND fc.family_id <> v_family_id
  ) THEN

    RAISE EXCEPTION
      'child % already belongs to another active family',
      p_child;

  END IF;

  INSERT INTO family_children(
    family_id,
    person_id,
    relationship_type,
    sort_order,
    migration_confidence
  )
  VALUES (
    v_family_id,
    p_child,
    'biological',
    0,
    'certain'
  )
  ON CONFLICT DO NOTHING;

  RETURN v_family_id;

END;
$function$;
