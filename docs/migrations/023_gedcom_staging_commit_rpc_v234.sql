CREATE OR REPLACE FUNCTION public.commit_gedcom_staging_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.import_sessions%ROWTYPE;
  v_record public.import_staging_records%ROWTYPE;
  v_payload JSONB;

  v_new_person_id UUID;
  v_new_family_id UUID;
  v_new_event_id UUID;

  v_person_id UUID;
  v_family_id UUID;
  v_event_id UUID;

  v_approved_count INT := 0;
  v_error_count INT := 0;

  v_person_count INT := 0;
  v_name_count INT := 0;
  v_family_count INT := 0;
  v_family_parent_count INT := 0;
  v_family_child_count INT := 0;
  v_event_count INT := 0;
  v_person_event_count INT := 0;
  v_staging_count INT := 0;

  v_result JSONB;
BEGIN
  IF NOT (public.is_admin() OR public.is_editor()) THEN
    RAISE EXCEPTION 'not_allowed: chỉ admin/editor mới được commit GEDCOM staging';
  END IF;

  SELECT *
  INTO v_session
  FROM public.import_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'import_session_not_found: %', p_session_id;
  END IF;

  IF v_session.status = 'committed' THEN
    RAISE EXCEPTION 'session_already_committed: %', p_session_id;
  END IF;

  SELECT COUNT(*)
  INTO v_approved_count
  FROM public.import_staging_records
  WHERE session_id = p_session_id
    AND status = 'approved'
    AND action = 'create';

  IF v_approved_count = 0 THEN
    RAISE EXCEPTION 'no_approved_records: session % chưa có record approved để commit', p_session_id;
  END IF;

  SELECT COUNT(*)
  INTO v_error_count
  FROM public.import_staging_records
  WHERE session_id = p_session_id
    AND status = 'approved'
    AND action = 'create'
    AND jsonb_array_length(COALESCE(errors, '[]'::jsonb)) > 0;

  IF v_error_count > 0 THEN
    RAISE EXCEPTION 'approved_records_have_errors: còn % approved records có errors', v_error_count;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_gedcom_person_map (
    session_id UUID NOT NULL,
    external_id TEXT NOT NULL,
    person_id UUID NOT NULL,
    PRIMARY KEY (session_id, external_id)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS tmp_gedcom_family_map (
    session_id UUID NOT NULL,
    external_id TEXT NOT NULL,
    family_id UUID NOT NULL,
    PRIMARY KEY (session_id, external_id)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS tmp_gedcom_event_map (
    session_id UUID NOT NULL,
    external_id TEXT NOT NULL,
    event_id UUID NOT NULL,
    PRIMARY KEY (session_id, external_id)
  ) ON COMMIT DROP;

  DELETE FROM tmp_gedcom_person_map WHERE session_id = p_session_id;
  DELETE FROM tmp_gedcom_family_map WHERE session_id = p_session_id;
  DELETE FROM tmp_gedcom_event_map WHERE session_id = p_session_id;

  UPDATE public.import_sessions
  SET
    status = 'committing',
    updated_at = NOW()
  WHERE id = p_session_id;

  -- 1. persons
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'person'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    INSERT INTO public.persons (
      full_name,
      gender,
      birth_year,
      birth_month,
      birth_day,
      death_year,
      death_month,
      death_day,
      is_deceased,
      note
    )
    VALUES (
      COALESCE(NULLIF(v_payload->>'full_name', ''), 'Chưa rõ tên'),
      CASE
        WHEN v_payload->>'gender' IN ('male', 'female', 'other')
        THEN (v_payload->>'gender')::public.gender_enum
        ELSE 'other'::public.gender_enum
      END,
      NULLIF(v_payload->>'birth_year', '')::INT,
      NULLIF(v_payload->>'birth_month', '')::INT,
      NULLIF(v_payload->>'birth_day', '')::INT,
      NULLIF(v_payload->>'death_year', '')::INT,
      NULLIF(v_payload->>'death_month', '')::INT,
      NULLIF(v_payload->>'death_day', '')::INT,
      COALESCE((v_payload->>'is_deceased')::BOOLEAN, FALSE),
      NULLIF(v_payload->>'note', '')
    )
    RETURNING id INTO v_new_person_id;

    IF v_record.external_id IS NULL THEN
      RAISE EXCEPTION 'person_record_missing_external_id: %', v_record.id;
    END IF;

    INSERT INTO tmp_gedcom_person_map (session_id, external_id, person_id)
    VALUES (p_session_id, v_record.external_id, v_new_person_id);

    v_person_count := v_person_count + 1;
  END LOOP;

  -- 2. person_names
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'name'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    SELECT person_id
    INTO v_person_id
    FROM tmp_gedcom_person_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'person_external_id';

    IF v_person_id IS NULL THEN
      RAISE EXCEPTION 'name_missing_person_mapping: record %, person_external_id %',
        v_record.id,
        v_payload->>'person_external_id';
    END IF;

    INSERT INTO public.person_names (
      person_id,
      type,
      full_text,
      surname,
      given_name,
      language,
      is_primary,
      note
    )
    VALUES (
      v_person_id,
      CASE
        WHEN v_payload->>'name_type' IN (
          'birth', 'courtesy', 'posthumous', 'religious',
          'married', 'nickname', 'alias'
        )
        THEN (v_payload->>'name_type')::public.name_type_enum
        ELSE 'birth'::public.name_type_enum
      END,
      COALESCE(NULLIF(v_payload->>'full_name', ''), 'Chưa rõ tên'),
      NULLIF(v_payload->>'surname', ''),
      NULLIF(v_payload->>'given_name', ''),
      COALESCE(NULLIF(v_payload->>'language', ''), 'vi'),
      COALESCE((v_payload->>'is_primary')::BOOLEAN, TRUE),
      NULLIF(v_payload->>'note', '')
    );

    v_name_count := v_name_count + 1;
  END LOOP;

  -- 3. families
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'family'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    INSERT INTO public.families (
      status
    )
    VALUES (
      CASE
        WHEN v_payload->>'status' IN ('active', 'divorced', 'separated')
        THEN (v_payload->>'status')::public.family_status_enum
        ELSE 'active'::public.family_status_enum
      END
    )
    RETURNING id INTO v_new_family_id;

    IF v_record.external_id IS NULL THEN
      RAISE EXCEPTION 'family_record_missing_external_id: %', v_record.id;
    END IF;

    INSERT INTO tmp_gedcom_family_map (session_id, external_id, family_id)
    VALUES (p_session_id, v_record.external_id, v_new_family_id);

    v_family_count := v_family_count + 1;
  END LOOP;

  -- 4. family_parents
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'family_parent'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    SELECT family_id
    INTO v_family_id
    FROM tmp_gedcom_family_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'family_external_id';

    SELECT person_id
    INTO v_person_id
    FROM tmp_gedcom_person_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'person_external_id';

    IF v_family_id IS NULL OR v_person_id IS NULL THEN
      RAISE EXCEPTION 'family_parent_missing_mapping: record %, family_external_id %, person_external_id %',
        v_record.id,
        v_payload->>'family_external_id',
        v_payload->>'person_external_id';
    END IF;

    INSERT INTO public.family_parents (
      family_id,
      person_id,
      role,
      sort_order
    )
    VALUES (
      v_family_id,
      v_person_id,
      CASE
        WHEN v_payload->>'role' IN ('husband', 'wife')
        THEN (v_payload->>'role')::public.parent_role_enum
        ELSE 'partner'::public.parent_role_enum
      END,
      COALESCE(NULLIF(v_payload->>'sort_order', '')::INT, 0)
    )
    ON CONFLICT DO NOTHING;

    v_family_parent_count := v_family_parent_count + 1;
  END LOOP;

  -- 5. family_children
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'family_child'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    SELECT family_id
    INTO v_family_id
    FROM tmp_gedcom_family_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'family_external_id';

    SELECT person_id
    INTO v_person_id
    FROM tmp_gedcom_person_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'person_external_id';

    IF v_family_id IS NULL OR v_person_id IS NULL THEN
      RAISE EXCEPTION 'family_child_missing_mapping: record %, family_external_id %, person_external_id %',
        v_record.id,
        v_payload->>'family_external_id',
        v_payload->>'person_external_id';
    END IF;

    INSERT INTO public.family_children (
      family_id,
      person_id,
      relationship_type,
      sort_order
    )
    VALUES (
      v_family_id,
      v_person_id,
      CASE
        WHEN v_payload->>'relationship_type' = 'adopted'
        THEN 'adopted'::public.child_type_enum
        WHEN v_payload->>'relationship_type' IN ('step', 'stepchild')
        THEN 'stepchild'::public.child_type_enum
        WHEN v_payload->>'relationship_type' = 'foster'
        THEN 'foster'::public.child_type_enum
        ELSE 'biological'::public.child_type_enum
      END,
      COALESCE(NULLIF(v_payload->>'sort_order', '')::INT, 0)
    )
    ON CONFLICT DO NOTHING;

    v_family_child_count := v_family_child_count + 1;
  END LOOP;

  -- 6. events
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'event'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    v_person_id := NULL;
    v_family_id := NULL;

    IF v_payload ? 'legacy_person_external_id' THEN
      SELECT person_id
      INTO v_person_id
      FROM tmp_gedcom_person_map
      WHERE session_id = p_session_id
        AND external_id = v_payload->>'legacy_person_external_id';
    END IF;

    IF v_payload ? 'family_external_id' THEN
      SELECT family_id
      INTO v_family_id
      FROM tmp_gedcom_family_map
      WHERE session_id = p_session_id
        AND external_id = v_payload->>'family_external_id';
    END IF;

    INSERT INTO public.events (
      type,
      start_date,
      end_date,
      sort_date,
      date_precision,
      date_modifier,
      canonical_calendar,
      date_original_text,
      date_phrase,
      lunar_year,
      lunar_month,
      lunar_day,
      lunar_is_leap_month,
      place_text,
      description,
      family_id,
      legacy_person_id,
      legacy_source,
      migration_confidence
    )
    VALUES (
      CASE
        WHEN v_payload->>'type' IN (
          'birth', 'death', 'marriage', 'divorce', 'burial', 'baptism',
          'confirmation', 'ordination', 'graduation', 'occupation',
          'residence', 'migration', 'military', 'award', 'retirement', 'custom'
        )
        THEN (v_payload->>'type')::public.event_type_enum
        ELSE 'custom'::public.event_type_enum
      END,
      NULLIF(v_payload->>'start_date', '')::DATE,
      NULLIF(v_payload->>'end_date', '')::DATE,
      NULLIF(v_payload->>'sort_date', '')::DATE,
      CASE
        WHEN v_payload->>'date_precision' IN ('day', 'month', 'year', 'decade', 'range', 'text', 'unknown')
        THEN (v_payload->>'date_precision')::public.date_precision_enum
        ELSE 'unknown'::public.date_precision_enum
      END,
      CASE
        WHEN v_payload->>'date_modifier' IN (
          'exact', 'about', 'before', 'after', 'between', 'from_to',
          'estimated', 'calculated', 'interpreted', 'phrase', 'unknown'
        )
        THEN (v_payload->>'date_modifier')::public.date_modifier_enum
        ELSE 'unknown'::public.date_modifier_enum
      END,
      CASE
        WHEN v_payload->>'canonical_calendar' IN ('gregorian', 'lunar', 'text', 'unknown')
        THEN (v_payload->>'canonical_calendar')::public.calendar_type_enum
        ELSE 'gregorian'::public.calendar_type_enum
      END,
      NULLIF(v_payload->>'date_original_text', ''),
      NULLIF(v_payload->>'date_phrase', ''),
      NULLIF(v_payload->>'lunar_year', '')::INT,
      NULLIF(v_payload->>'lunar_month', '')::INT,
      NULLIF(v_payload->>'lunar_day', '')::INT,
      COALESCE((v_payload->>'lunar_is_leap_month')::BOOLEAN, FALSE),
      NULLIF(v_payload->>'place_text', ''),
      NULLIF(v_payload->>'description', ''),
      v_family_id,
      v_person_id,
      COALESCE(NULLIF(v_payload->>'legacy_source', ''), 'gedcom.staging'),
      'review'
    )
    RETURNING id INTO v_new_event_id;

    IF v_record.external_id IS NULL THEN
      RAISE EXCEPTION 'event_record_missing_external_id: %', v_record.id;
    END IF;

    INSERT INTO tmp_gedcom_event_map (session_id, external_id, event_id)
    VALUES (p_session_id, v_record.external_id, v_new_event_id);

    v_event_count := v_event_count + 1;
  END LOOP;

  -- 7. person_events
  FOR v_record IN
    SELECT *
    FROM public.import_staging_records
    WHERE session_id = p_session_id
      AND status = 'approved'
      AND action = 'create'
      AND record_type = 'person_event'
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_payload := COALESCE(v_record.normalized_payload, '{}'::jsonb);

    SELECT person_id
    INTO v_person_id
    FROM tmp_gedcom_person_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'person_external_id';

    SELECT event_id
    INTO v_event_id
    FROM tmp_gedcom_event_map
    WHERE session_id = p_session_id
      AND external_id = v_payload->>'event_external_id';

    IF v_person_id IS NULL OR v_event_id IS NULL THEN
      RAISE EXCEPTION 'person_event_missing_mapping: record %, person_external_id %, event_external_id %',
        v_record.id,
        v_payload->>'person_external_id',
        v_payload->>'event_external_id';
    END IF;

    INSERT INTO public.person_events (
      person_id,
      event_id,
      role
    )
    VALUES (
      v_person_id,
      v_event_id,
      CASE
        WHEN v_payload->>'role' IN (
          'principal', 'child', 'husband', 'wife', 'witness',
          'officiant', 'deceased', 'participant'
        )
        THEN (v_payload->>'role')::public.event_role_enum
        ELSE 'principal'::public.event_role_enum
      END
    )
    ON CONFLICT DO NOTHING;

    v_person_event_count := v_person_event_count + 1;
  END LOOP;

  UPDATE public.import_staging_records
  SET
    status = 'committed',
    updated_at = NOW()
  WHERE session_id = p_session_id
    AND status = 'approved'
    AND action = 'create';

  GET DIAGNOSTICS v_staging_count = ROW_COUNT;

  v_result := jsonb_build_object(
    'persons', v_person_count,
    'personNames', v_name_count,
    'families', v_family_count,
    'familyParents', v_family_parent_count,
    'familyChildren', v_family_child_count,
    'events', v_event_count,
    'personEvents', v_person_event_count,
    'stagingRecords', v_staging_count
  );

  UPDATE public.import_sessions
  SET
    status = 'committed',
    committed_by = auth.uid(),
    committed_at = NOW(),
    updated_at = NOW(),
    summary = jsonb_build_object('committed', v_result)
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sessionId', p_session_id,
    'committed', v_result,
    'errors', '[]'::jsonb,
    'warnings', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.commit_gedcom_staging_session(UUID) TO authenticated;
