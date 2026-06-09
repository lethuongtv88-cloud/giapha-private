-- v2.5.6 hotfix: remove raw trigger-style audit rows and stop generic DB audit triggers
-- Lý do: các trigger thô trước đây chỉ ghi CREATE/UPDATE/DELETE + unknown, không có actor/metadata.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      t.tgname AS trigger_name,
      t.tgrelid::regclass AS table_name,
      p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND t.tgrelid <> 'public.audit_logs'::regclass
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ILIKE '%audit_logs%'
      AND pg_get_functiondef(p.oid) ILIKE '%TG_OP%'
  LOOP
    RAISE NOTICE 'Dropping generic audit trigger %.% using function %', r.table_name, r.trigger_name, r.function_name;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.trigger_name, r.table_name);
  END LOOP;
END $$;

-- Các dòng này không thể khôi phục vì không có actor, entity_id, metadata.
-- Xóa để trang Audit Log không bị lấp đầy bằng bản ghi vô nghĩa.
DELETE FROM public.audit_logs
WHERE action IN ('CREATE', 'UPDATE', 'DELETE')
  AND entity_type = 'unknown'
  AND actor_user_id IS NULL
  AND actor_email IS NULL
  AND entity_id IS NULL
  AND entity_label IS NULL
  AND metadata IS NULL;

-- Bảo đảm log mới luôn có giá trị an toàn nếu caller truyền thiếu.
ALTER TABLE public.audit_logs
  ALTER COLUMN action SET DEFAULT 'unknown',
  ALTER COLUMN entity_type SET DEFAULT 'system',
  ALTER COLUMN severity SET DEFAULT 'info',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.audit_logs
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;
