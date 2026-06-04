CREATE OR REPLACE FUNCTION public.commit_gedcom_merge_suggestions(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suggestion RECORD;
  v_event_id UUID;
  v_approved_count INTEGER := 0;
  v_inserted_events INTEGER := 0;
  v_inserted_person_events INTEGER := 0;
  v_skipped_existing INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_event_type public.event_type_enum;
  v_event_role public.event_role_enum;
BEGIN
  SELECT COUNT(*)
  INTO v_approved_count
  FROM public.import_merge_suggestions
  WHERE session_id = p_session_id
    AND status = 'approved'
    AND suggestion_type = 'create_event';

  IF v_approved_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'Không có approved merge suggestions để commit.',
      'approved', 0,
      'inserted_events', 0,
      'inserted_person_events', 0,
      'skipped_existing', 0,
      'errors', v_errors
    );
  END IF;

  FOR v_suggestion IN
    SELECT *
    FROM public.import_merge_suggestions
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND suggestion_type = 'create_event'
    ORDER BY created_at ASC
  LOOP
    BEGIN
      IF v_suggestion.matched_person_id IS NULL THEN
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'suggestion_id', v_suggestion.id,
            'error', 'missing_matched_person_id'
          )
        );
        CONTINUE;
      END IF;

      IF v_suggestion.payload->>'type' NOT IN ('birth', 'death') THEN
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'suggestion_id', v_suggestion.id,
            'error', 'unsupported_event_type',
            'type', v_suggestion.payload->>'type'
          )
        );
        CONTINUE;
      END IF;

      IF NULLIF(v_suggestion.payload->>'start_date', '') IS NULL THEN
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'suggestion_id', v_suggestion.id,
            'error', 'missing_start_date'
          )
        );
        CONTINUE;
      END IF;

      v_event_type := (v_suggestion.payload->>'type')::public.event_type_enum;

      v_event_role :=
        CASE
          WHEN v_suggestion.payload->>'type' = 'death'
          THEN 'deceased'::public.event_role_enum
          ELSE 'principal'::public.event_role_enum
        END;

      SELECT e.id
      INTO v_event_id
      FROM public.events e
      WHERE e.deleted_at IS NULL
        AND e.legacy_person_id = v_suggestion.matched_person_id
        AND e.type = v_event_type
        AND (
          e.start_date = NULLIF(v_suggestion.payload->>'start_date', '')::DATE
          OR e.sort_date = NULLIF(v_suggestion.payload->>'sort_date', '')::DATE
        )
      LIMIT 1;

      IF v_event_id IS NOT NULL THEN
        UPDATE public.import_merge_suggestions
        SET
          status = 'committed',
          committed_at = NOW(),
          committed_by = auth.uid(),
          updated_at = NOW(),
          reason = COALESCE(reason, '') || ' | skipped_existing_event'
        WHERE id = v_suggestion.id;

        v_skipped_existing := v_skipped_existing + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.events (
        type,
        start_date,
        end_date,
        sort_date,
        legacy_person_id,
        legacy_source,
        confidence,
        created_at,
        updated_at
      )
      VALUES (
        v_event_type,
        NULLIF(v_suggestion.payload->>'start_date', '')::DATE,
        NULLIF(v_suggestion.payload->>'end_date', '')::DATE,
        NULLIF(v_suggestion.payload->>'sort_date', '')::DATE,
        v_suggestion.matched_person_id,
        COALESCE(NULLIF(v_suggestion.payload->>'legacy_source', ''), 'gedcom.merge'),
        'review'::public.confidence_enum,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_event_id;

      v_inserted_events := v_inserted_events + 1;

      INSERT INTO public.person_events (
        person_id,
        event_id,
        role
      )
      VALUES (
        v_suggestion.matched_person_id,
        v_event_id,
        v_event_role
      )
      ON CONFLICT DO NOTHING;

      v_inserted_person_events := v_inserted_person_events + 1;

      UPDATE public.import_merge_suggestions
      SET
        status = 'committed',
        committed_at = NOW(),
        committed_by = auth.uid(),
        updated_at = NOW()
      WHERE id = v_suggestion.id;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object(
          'suggestion_id', v_suggestion.id,
          'error', SQLERRM,
          'code', SQLSTATE
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'approved', v_approved_count,
    'inserted_events', v_inserted_events,
    'inserted_person_events', v_inserted_person_events,
    'skipped_existing', v_skipped_existing,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.commit_gedcom_merge_suggestions(UUID)
TO authenticated;
