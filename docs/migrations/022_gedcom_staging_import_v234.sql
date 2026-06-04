CREATE TABLE IF NOT EXISTS public.import_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  source_type TEXT NOT NULL DEFAULT 'gedcom'
    CHECK (source_type IN ('gedcom', 'json', 'csv', 'manual')),

  file_name TEXT,
  file_size BIGINT,
  file_hash TEXT,

  status TEXT NOT NULL DEFAULT 'parsed'
    CHECK (status IN (
      'uploaded',
      'parsed',
      'reviewing',
      'ready_to_commit',
      'committing',
      'committed',
      'failed',
      'cancelled'
    )),

  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_by UUID REFERENCES public.profiles(id),
  committed_by UUID REFERENCES public.profiles(id),

  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_staging_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  session_id UUID REFERENCES public.import_sessions(id) ON DELETE CASCADE NOT NULL,

  record_type TEXT NOT NULL
    CHECK (record_type IN (
      'person',
      'name',
      'family',
      'family_parent',
      'family_child',
      'event',
      'person_event',
      'note',
      'source',
      'media',
      'warning',
      'unknown'
    )),

  external_id TEXT,
  parent_external_id TEXT,

  action TEXT NOT NULL DEFAULT 'create'
    CHECK (action IN ('create', 'update', 'match', 'skip', 'warning', 'error')),

  confidence TEXT NOT NULL DEFAULT 'review'
    CHECK (confidence IN ('certain', 'review', 'low', 'manual')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'skipped', 'rejected', 'committed')),

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  matched_table TEXT,
  matched_id UUID,

  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,

  sort_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_staging_records_session_id_idx
ON public.import_staging_records(session_id);

CREATE INDEX IF NOT EXISTS import_staging_records_type_idx
ON public.import_staging_records(session_id, record_type);

CREATE INDEX IF NOT EXISTS import_staging_records_external_id_idx
ON public.import_staging_records(session_id, external_id);

CREATE INDEX IF NOT EXISTS import_staging_records_status_idx
ON public.import_staging_records(session_id, status);

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_staging_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read import sessions" ON public.import_sessions;
CREATE POLICY "Read import sessions" ON public.import_sessions
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Editors manage import sessions" ON public.import_sessions;
CREATE POLICY "Editors manage import sessions" ON public.import_sessions
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

DROP POLICY IF EXISTS "Read import staging records" ON public.import_staging_records;
CREATE POLICY "Read import staging records" ON public.import_staging_records
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Editors manage import staging records" ON public.import_staging_records;
CREATE POLICY "Editors manage import staging records" ON public.import_staging_records
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

DROP TRIGGER IF EXISTS audit_import_sessions ON public.import_sessions;
CREATE TRIGGER audit_import_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.import_sessions
FOR EACH ROW EXECUTE FUNCTION public.log_changes();

DROP TRIGGER IF EXISTS audit_import_staging_records ON public.import_staging_records;
CREATE TRIGGER audit_import_staging_records
AFTER INSERT OR UPDATE OR DELETE ON public.import_staging_records
FOR EACH ROW EXECUTE FUNCTION public.log_changes();
