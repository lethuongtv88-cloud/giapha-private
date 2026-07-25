-- 067_relationships_unique_active_only.sql
--
-- BUG: "Không thể thêm mối quan hệ: duplicate key value violates unique
-- constraint relationships_person_a_person_b_type_key"
--
-- Nguyên nhân: bảng relationships có UNIQUE (person_a, person_b, type)
-- KHÔNG loại trừ các dòng đã soft-delete (deleted_at). Vì vậy khi:
--   1. Xóa 1 quan hệ (app chỉ soft-delete: UPDATE ... SET deleted_at = now())
--   2. Thêm lại ĐÚNG quan hệ đó (cùng person_a, person_b, type)
-- thì bước 2 luôn bị Postgres từ chối do dòng cũ (dù đã soft-delete) vẫn
-- tính vào unique constraint.
--
-- Bug này cũng ảnh hưởng trực tiếp tới link_child_with_family_sync()
-- (migration 065): nếu quan hệ cha/mẹ-con từng bị xóa rồi thêm lại, RPC sẽ
-- lỗi ở đúng bước INSERT quan hệ chính, khiến cả thao tác rollback.
--
-- FIX: thay UNIQUE constraint thường bằng UNIQUE INDEX có điều kiện
-- (partial index) - chỉ áp dụng cho các dòng ĐANG active (deleted_at IS
-- NULL). Nhờ vậy:
--   - Vẫn chặn được trùng lặp quan hệ đang active (đúng mục đích ban đầu).
--   - Cho phép thêm lại quan hệ đã từng bị xóa trước đó (vì dòng cũ không
--     còn active nên không tính vào unique index nữa).

BEGIN;

-- 1. Kiểm tra & dọn trùng lặp ĐANG ACTIVE trước khi tạo unique index mới
--    (nếu có, CREATE UNIQUE INDEX bên dưới sẽ báo lỗi). Giữ dòng cũ nhất,
--    soft-delete các dòng active trùng còn lại (không hard-delete để vẫn
--    giữ lịch sử/audit).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY person_a, person_b, type
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.relationships
  WHERE deleted_at IS NULL
)
UPDATE public.relationships r
SET deleted_at = NOW(), updated_at = NOW()
FROM ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

-- 2. Bỏ unique constraint cũ (không loại trừ soft-delete).
ALTER TABLE public.relationships
  DROP CONSTRAINT IF EXISTS relationships_person_a_person_b_type_key;

-- 3. Tạo lại dưới dạng partial unique index - chỉ tính các dòng active.
CREATE UNIQUE INDEX IF NOT EXISTS relationships_person_a_person_b_type_active_key
  ON public.relationships (person_a, person_b, type)
  WHERE deleted_at IS NULL;

COMMIT;
