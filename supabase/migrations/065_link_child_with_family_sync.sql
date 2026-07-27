-- 065_link_child_with_family_sync.sql
--
-- Theo góp ý review điểm (4) và (5): trước đây flow "thêm con" ở client
-- gồm nhiều bước round-trip riêng lẻ:
--   1. INSERT relationships (cha/mẹ đã biết -> con)
--   2. INSERT relationships (vợ/chồng còn lại -> con) [nếu có]
--   3. RPC ensure_family_model_child(...)
-- Nếu bước 3 (hoặc bước 2) lỗi SAU KHI bước 1 đã thành công, dữ liệu sẽ bị
-- lệch: có relationships nhưng Family Model chưa đồng bộ - đúng loại lỗi
-- mà "missing_child_family" quality check đang phải phát hiện/repair.
--
-- Function này gộp cả 3 bước vào 1 lệnh RPC duy nhất. Vì đây là 1 lệnh SQL
-- top-level, Postgres tự động coi toàn bộ là 1 transaction: nếu bước nào
-- RAISE EXCEPTION mà không bị bắt riêng, MỌI thay đổi trong lệnh gọi này
-- (kể cả các INSERT relationships đã chạy trước đó) sẽ tự động rollback.
-- Không cần BEGIN/COMMIT thủ công phía client.
--
-- LƯU Ý VỀ QUYỀN HẠN:
--   - Function này KHÔNG khai báo SECURITY DEFINER (mặc định SECURITY
--     INVOKER) nên các lệnh INSERT INTO relationships vẫn đi qua đúng RLS
--     branch-scoped hiện có (relationships_insert_branch_scoped) như khi
--     client tự insert trực tiếp - không mở rộng quyền hạn nào so với
--     trước đây.
--   - public.ensure_family_model_child() vốn đã là SECURITY DEFINER từ
--     trước (không đổi bởi migration này).
--   - Việc gán "vợ/chồng còn lại" (v_parent_b) là best-effort: nếu INSERT
--     relationships cho người đó thất bại (vd. RLS từ chối vì ngoài nhánh
--     được phép sửa), chỉ bước đó bị bỏ qua (SAVEPOINT nội bộ), KHÔNG làm
--     hỏng thao tác chính (thêm cha/mẹ đã biết + Family Model) - giữ đúng
--     hành vi "graceful degradation" hiện có của app.
--   - Riêng cặp (cha/mẹ đã biết -> con) + Family Model là bắt buộc phải
--     cùng thành công hoặc cùng thất bại - đây chính là phần được sửa để
--     atomic.

BEGIN;

CREATE OR REPLACE FUNCTION public.link_child_with_family_sync(
  p_parent_a UUID,
  p_child UUID,
  p_type public.relationship_type_enum,
  p_note TEXT DEFAULT NULL,
  p_parent_b UUID DEFAULT NULL,
  p_auto_link_spouse BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_b UUID;
  v_family_id UUID;
  v_rel_a_id UUID;
  v_rel_b_id UUID;
BEGIN
  IF p_parent_a IS NULL OR p_child IS NULL THEN
    RAISE EXCEPTION 'parent_a and child must not be null';
  END IF;

  IF p_type NOT IN ('biological_child', 'adopted_child') THEN
    RAISE EXCEPTION 'type must be biological_child or adopted_child, got %', p_type;
  END IF;

  IF p_parent_a = p_child THEN
    RAISE EXCEPTION 'parent_a and child must be different';
  END IF;

  -- Xác định cha/mẹ còn lại: ưu tiên giá trị được truyền rõ ràng (vd.
  -- người dùng đã tự chọn trong dropdown "Thêm nhanh nhiều con"); nếu
  -- không có và p_auto_link_spouse = true, tự dò vợ/chồng DUY NHẤT đang
  -- active bằng đúng quy tắc dùng chung với repair script
  -- (get_single_active_spouse).
  v_parent_b := p_parent_b;
  IF v_parent_b IS NULL AND p_auto_link_spouse THEN
    v_parent_b := public.get_single_active_spouse(p_parent_a);
  END IF;
  IF v_parent_b = p_parent_a OR v_parent_b = p_child THEN
    v_parent_b := NULL;
  END IF;

  -- (1) Quan hệ chính: cha/mẹ đã biết -> con.
  INSERT INTO public.relationships (person_a, person_b, type, note)
  VALUES (p_parent_a, p_child, p_type, p_note)
  RETURNING id INTO v_rel_a_id;

  -- (2) Quan hệ vợ/chồng còn lại -> con (best-effort, không chặn thao tác
  -- chính nếu thất bại).
  IF v_parent_b IS NOT NULL THEN
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.relationships r
        WHERE r.person_a = v_parent_b
          AND r.person_b = p_child
          AND r.type IN ('biological_child', 'adopted_child')
          AND r.deleted_at IS NULL
      ) THEN
        INSERT INTO public.relationships (person_a, person_b, type, note)
        VALUES (v_parent_b, p_child, p_type, p_note)
        RETURNING id INTO v_rel_b_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Không thể ghi quan hệ cho vợ/chồng còn lại (vd. ngoài nhánh được
      -- phép sửa) -> bỏ qua phần auto-link, vẫn tiếp tục với cha/mẹ chính.
      v_parent_b := NULL;
      v_rel_b_id := NULL;
    END;
  END IF;

  -- (3) Đồng bộ Family Model - BẮT BUỘC cùng thành công với bước (1).
  -- Nếu lỗi ở đây, toàn bộ bước (1) và (2) sẽ tự động rollback theo cùng
  -- transaction của lệnh RPC này.
  v_family_id := public.ensure_family_model_child(p_parent_a, p_child, v_parent_b);

  RETURN jsonb_build_object(
    'family_id', v_family_id,
    'parent_b_used', v_parent_b,
    'relationship_a_id', v_rel_a_id,
    'relationship_b_id', v_rel_b_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_child_with_family_sync(
  UUID, UUID, public.relationship_type_enum, TEXT, UUID, BOOLEAN
) TO authenticated;

COMMIT;
