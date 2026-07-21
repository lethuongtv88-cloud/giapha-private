-- Thiết kế lại ensure_family_model_child theo hướng chắc chắn hơn hẳn: thay
-- vì đoán gia đình "gần nhất" của 1 trong 2 cha/mẹ (dễ chọn nhầm khi dữ liệu
-- có gia đình rác/trùng lặp - đúng như trường hợp đã gặp), giờ ưu tiên tuyệt
-- đối: NẾU ĐỨA CON ĐÃ THUỘC 1 GIA ĐÌNH ĐANG HOẠT ĐỘNG, dùng chính gia đình đó
-- làm chuẩn, chỉ bổ sung cha/mẹ nào còn thiếu vào gia đình này. Chỉ khi con
-- CHƯA thuộc gia đình nào mới áp dụng logic tìm/tạo gia đình như cũ.

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
  v_child_family_id uuid;
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
  -- BƯỚC 0 (ưu tiên cao nhất): đứa con đã thuộc gia đình nào chưa?
  ------------------------------------------------------------------
  SELECT fc.family_id
  INTO v_child_family_id
  FROM family_children fc
  JOIN families f ON f.id = fc.family_id
  WHERE fc.person_id = p_child
    AND f.deleted_at IS NULL
  LIMIT 1;

  IF v_child_family_id IS NOT NULL THEN
    v_family_id := v_child_family_id;

    -- Bổ sung parent_a vào đúng gia đình của con nếu chưa có mặt.
    IF NOT EXISTS (
      SELECT 1 FROM family_parents
      WHERE family_id = v_family_id AND person_id = p_parent_a
    ) THEN
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

    -- Bổ sung parent_b (nếu có) vào đúng gia đình của con nếu chưa có mặt.
    IF p_parent_b IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM family_parents
      WHERE family_id = v_family_id AND person_id = p_parent_b
    ) THEN
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

    RETURN v_family_id;
  END IF;

  ------------------------------------------------------------------
  -- Con CHƯA thuộc gia đình nào -> tìm/tạo gia đình như logic cũ.
  ------------------------------------------------------------------

  IF p_parent_b IS NOT NULL THEN

    -- Gia đình đã có sẵn CẢ HAI người này rồi (cặp vợ chồng đã tồn tại,
    -- đang thêm một đứa con khác cho họ).
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
      );

      SELECT gender::text
      INTO v_gender_b
      FROM persons
      WHERE id = p_parent_b;

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
      );
    END IF;

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
      );
    END IF;

  END IF;

  ------------------------------------------------------------------
  -- CHILD (con chưa từng thuộc gia đình nào, giờ gắn vào family_id vừa
  -- tìm/tạo ở trên)
  ------------------------------------------------------------------
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
