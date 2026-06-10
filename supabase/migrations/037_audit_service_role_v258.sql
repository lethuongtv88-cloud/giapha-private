-- v2.5.8 hotfix: make audit_logs compatible with service-role inserts
-- This migration is intentionally idempotent.

DO $$
BEGIN
  IF to_regtype('public.event_role_enum') IS NOT NULL THEN
    ALTER TYPE public.event_role_enum ADD VALUE IF NOT EXISTS 'visibility_root';
  END IF;
END $$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS table_name TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS record_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS changed_by UUID,
  ADD COLUMN IF NOT EXISTS old_data JSONB,
  ADD COLUMN IF NOT EXISTS new_data JSONB,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actor_user_id UUID,
  ADD COLUMN IF NOT EXISTS actor_email TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS entity_label TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert own audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.audit_logs;
CREATE POLICY "Service role can manage audit logs"
ON public.audit_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins read audit_logs" ON public.audit_logs;
CREATE POLICY "Admins read audit_logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);
