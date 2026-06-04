CREATE OR REPLACE FUNCTION public.soft_delete_duplicate_birth_death_events()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  WITH ranked AS (
    SELECT
      e.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          e.legacy_person_id,
          e.type,
          e.start_date,
          e.sort_date
        ORDER BY
          e.created_at ASC NULLS LAST,
          e.id ASC
      ) AS rn
    FROM public.events e
    WHERE e.deleted_at IS NULL
      AND e.legacy_person_id IS NOT NULL
      AND e.type IN ('birth', 'death')
  ),
  duplicates AS (
    SELECT id
    FROM ranked
    WHERE rn > 1
  )
  UPDATE public.events e
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  FROM duplicates d
  WHERE e.id = d.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'soft_deleted', v_deleted,
    'errors', v_errors
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'soft_deleted', v_deleted,
    'errors', jsonb_build_array(
      jsonb_build_object(
        'error', SQLERRM,
        'code', SQLSTATE
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_duplicate_birth_death_events()
TO authenticated;
