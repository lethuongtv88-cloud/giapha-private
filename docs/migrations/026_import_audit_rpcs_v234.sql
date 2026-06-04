CREATE OR REPLACE FUNCTION public.count_import_staging_records_by_session(
  p_session_id UUID
)
RETURNS TABLE (
  record_type TEXT,
  action TEXT,
  status TEXT,
  count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    record_type,
    action,
    status,
    COUNT(*) AS count
  FROM public.import_staging_records
  WHERE session_id = p_session_id
  GROUP BY record_type, action, status
  ORDER BY record_type, action, status;
$$;

CREATE OR REPLACE FUNCTION public.count_import_merge_suggestions_by_session(
  p_session_id UUID
)
RETURNS TABLE (
  suggestion_type TEXT,
  status TEXT,
  count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    suggestion_type,
    status,
    COUNT(*) AS count
  FROM public.import_merge_suggestions
  WHERE session_id = p_session_id
  GROUP BY suggestion_type, status
  ORDER BY suggestion_type, status;
$$;

CREATE OR REPLACE FUNCTION public.count_orphan_active_events()
RETURNS TABLE (count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) AS count
  FROM public.events e
  WHERE e.deleted_at IS NULL
    AND e.family_id IS NULL
    AND e.legacy_person_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.person_events pe
      WHERE pe.event_id = e.id
    );
$$;

CREATE OR REPLACE FUNCTION public.count_duplicate_birth_death_events()
RETURNS TABLE (count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH grouped AS (
    SELECT
      e.legacy_person_id,
      e.type,
      e.start_date,
      e.sort_date,
      COUNT(*) AS c
    FROM public.events e
    WHERE e.deleted_at IS NULL
      AND e.legacy_person_id IS NOT NULL
      AND e.type IN ('birth', 'death')
    GROUP BY e.legacy_person_id, e.type, e.start_date, e.sort_date
    HAVING COUNT(*) > 1
  )
  SELECT COUNT(*) AS count
  FROM grouped;
$$;

CREATE OR REPLACE FUNCTION public.count_events_without_person_events()
RETURNS TABLE (count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) AS count
  FROM public.events e
  WHERE e.deleted_at IS NULL
    AND e.legacy_person_id IS NOT NULL
    AND e.type IN ('birth', 'death')
    AND NOT EXISTS (
      SELECT 1 FROM public.person_events pe
      WHERE pe.event_id = e.id
        AND pe.person_id = e.legacy_person_id
    );
$$;

CREATE OR REPLACE FUNCTION public.count_active_empty_families()
RETURNS TABLE (count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) AS count
  FROM public.families f
  WHERE f.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.family_parents fp
      WHERE fp.family_id = f.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.family_children fc
      WHERE fc.family_id = f.id
    );
$$;

GRANT EXECUTE ON FUNCTION public.count_import_staging_records_by_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_import_merge_suggestions_by_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_orphan_active_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_duplicate_birth_death_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_events_without_person_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_empty_families() TO authenticated;
