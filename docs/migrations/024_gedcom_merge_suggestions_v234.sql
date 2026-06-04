CREATE TABLE IF NOT EXISTS public.import_merge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,

  suggestion_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',

  matched_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  matched_person_name TEXT,

  source_record_id UUID REFERENCES public.import_staging_records(id) ON DELETE SET NULL,
  source_external_id TEXT,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,

  created_by UUID DEFAULT auth.uid(),
  committed_by UUID,
  committed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT import_merge_suggestions_status_check
    CHECK (status IN ('pending', 'approved', 'skipped', 'rejected', 'committed')),

  CONSTRAINT import_merge_suggestions_type_check
    CHECK (suggestion_type IN ('create_event', 'create_person_event'))
);

CREATE INDEX IF NOT EXISTS idx_import_merge_suggestions_session
ON public.import_merge_suggestions(session_id);

CREATE INDEX IF NOT EXISTS idx_import_merge_suggestions_status
ON public.import_merge_suggestions(status);

CREATE INDEX IF NOT EXISTS idx_import_merge_suggestions_person
ON public.import_merge_suggestions(matched_person_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_merge_suggestions_dedupe_create_event
ON public.import_merge_suggestions(
  session_id,
  suggestion_type,
  matched_person_id,
  source_external_id
)
WHERE suggestion_type = 'create_event';

ALTER TABLE public.import_merge_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and editors can manage import merge suggestions"
ON public.import_merge_suggestions;

CREATE POLICY "Admins and editors can manage import merge suggestions"
ON public.import_merge_suggestions
FOR ALL
USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());
