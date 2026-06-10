-- v2.5.9: unified event creation and flexible audit actions
-- Idempotent hotfix.

DO $$
BEGIN
  IF to_regtype('public.event_role_enum') IS NOT NULL THEN
    ALTER TYPE public.event_role_enum ADD VALUE IF NOT EXISTS 'visibility_root';
  END IF;
END $$;

-- Audit action must be flexible because the app records semantic actions such as
-- event.created, permission.denied, data_maintenance.repair_broken_person_events.
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- Keep useful constraints for severity/source, but make legacy columns compatible
-- with app-level audit inserts.
ALTER TABLE public.audit_logs
  ALTER COLUMN table_name DROP NOT NULL,
  ALTER COLUMN table_name SET DEFAULT 'system',
  ALTER COLUMN record_id DROP NOT NULL,
  ALTER COLUMN record_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN action SET DEFAULT 'unknown',
  ALTER COLUMN entity_type SET DEFAULT 'system',
  ALTER COLUMN severity SET DEFAULT 'info',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN source SET DEFAULT 'app',
  ALTER COLUMN changed_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.audit_logs
SET table_name = COALESCE(table_name, entity_type, 'system'),
    record_id = COALESCE(record_id, gen_random_uuid()),
    action = COALESCE(action, 'unknown'),
    entity_type = COALESCE(entity_type, 'system'),
    severity = COALESCE(severity, 'info'),
    metadata = COALESCE(metadata, '{}'::jsonb),
    source = COALESCE(source, 'app'),
    changed_at = COALESCE(changed_at, created_at, now()),
    created_at = COALESCE(created_at, changed_at, now());
