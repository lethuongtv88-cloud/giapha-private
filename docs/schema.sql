--
-- PostgreSQL database dump
--
-- ============================================================================
-- docs/schema.sql -- Schema day du dung de cai dat MOI (fresh install).
--
-- Nguon: dump that tu Supabase project dang chay (07/2026), da gop them
-- toan bo cac ban va RLS DA DUOC KIEM CHUNG THUC TE tren production, ap
-- dung theo dung thu tu:
--   053 - doc theo nhanh (SELECT co ban)
--   056 - fix loi infinite recursion 42P17 giua family_parents/family_children
--   057 - fix hieu nang (visible_family_ids() thay ham scalar theo dong)
--   058 - don policy cu con sot lai
--   059 - khoi phuc policy ghi bi thieu
--   060 - fix INSERT...RETURNING that bai voi ban ghi "tro" chua lien ket
--   061 - fix UPDATE...RETURNING that bai sau soft-delete
--   054 - that chat import_sessions/import_staging_records/person_names/
--         nguon tu lieu (khong con doc rong, ep created_by dung nguoi)
--   055 - gioi han quyen GHI cua editor theo nhanh (truoc day editor ghi
--         tu do toan bo cay); da bao gom san ban va RETURNING cho
--         relationships (allow admin/editor thay quan he khi chi 1 phia
--         thuoc nhanh, tranh loi RETURNING khi noi voi nguoi hoan toan moi)
--
-- Day la trang thai DAY DU, moi nhat, da qua kiem thu thuc te (ca doc lan
-- ghi, ca admin lan editor lan member) tinh den thoi diem dump.
--
-- CACH DUNG: dan toan bo noi dung file nay vao Supabase SQL Editor cua
-- project MOI (rong), chay 1 lan duy nhat. Voi project DANG CHAY THAT (da
-- co du lieu), KHONG chay lai file nay -- dung dung cac file migration
-- rieng le trong supabase/migrations/ theo dung thu tu so.
-- ============================================================================
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public; -- BO QUA: Supabase da tu tao san schema public
-- trong moi project moi, chay lai dong nay se bao loi 42P06 "already exists".


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role_enum AS ENUM (
    'admin',
    'editor',
    'member'
);


--
-- Name: admin_user_data; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_user_data AS (
	id uuid,
	email text,
	role public.user_role_enum,
	created_at timestamp with time zone,
	is_active boolean
);


--
-- Name: calendar_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.calendar_type_enum AS ENUM (
    'gregorian',
    'lunar',
    'text',
    'unknown'
);


--
-- Name: child_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.child_type_enum AS ENUM (
    'biological',
    'adopted',
    'foster',
    'stepchild',
    'unknown'
);


--
-- Name: date_modifier_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.date_modifier_enum AS ENUM (
    'exact',
    'about',
    'before',
    'after',
    'between',
    'from_to',
    'estimated',
    'calculated',
    'interpreted',
    'phrase',
    'unknown'
);


--
-- Name: date_precision_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.date_precision_enum AS ENUM (
    'day',
    'month',
    'year',
    'decade',
    'range',
    'text',
    'unknown'
);


--
-- Name: event_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_role_enum AS ENUM (
    'principal',
    'child',
    'husband',
    'wife',
    'witness',
    'officiant',
    'deceased',
    'participant',
    'visibility_root'
);


--
-- Name: event_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_type_enum AS ENUM (
    'birth',
    'death',
    'marriage',
    'divorce',
    'burial',
    'baptism',
    'confirmation',
    'ordination',
    'graduation',
    'occupation',
    'residence',
    'migration',
    'military',
    'award',
    'retirement',
    'custom',
    'death_anniversary',
    'wedding'
);


--
-- Name: family_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.family_status_enum AS ENUM (
    'active',
    'divorced',
    'widowed',
    'separated',
    'ended',
    'unknown'
);


--
-- Name: family_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.family_type_enum AS ENUM (
    'marriage',
    'partnership',
    'unknown'
);


--
-- Name: gender_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gender_enum AS ENUM (
    'male',
    'female',
    'other'
);


--
-- Name: name_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.name_type_enum AS ENUM (
    'birth',
    'courtesy',
    'posthumous',
    'religious',
    'married',
    'nickname',
    'alias'
);


--
-- Name: parent_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.parent_role_enum AS ENUM (
    'husband',
    'wife',
    'partner',
    'parent'
);


--
-- Name: relationship_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.relationship_type_enum AS ENUM (
    'marriage',
    'biological_child',
    'adopted_child'
);


--
-- Name: source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.source_type AS ENUM (
    'document',
    'photo',
    'oral_history',
    'book',
    'website',
    'archive',
    'other'
);


--
-- Name: admin_create_user(text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_user(new_email text, new_password text, new_role text, new_active boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
    new_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    new_id := gen_random_uuid();

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at,         -- Auto-verify: skip email confirmation
        confirmation_token,         -- Must be '' not NULL (Supabase Auth Go scanner)
        recovery_token,             -- Must be '' not NULL
        email_change_token_new,     -- Must be '' not NULL
        email_change_token_current, -- Must be '' not NULL
        reauthentication_token,     -- Must be '' not NULL
        email_change,               -- Must be '' not NULL
        phone_change,               -- Must be '' not NULL
        phone_change_token,         -- Must be '' not NULL
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
        new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        new_email, extensions.crypt(new_password, extensions.gen_salt('bf')),
        now(),
        '', '', '', '', '', '', '', '',
        '{"provider":"email","providers":["email"]}', '{}', now(), now()
    );

    INSERT INTO public.profiles (id, role, is_active, created_at, updated_at)
    VALUES (new_id, new_role::public.user_role_enum, new_active, now(), now())
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;
    
    RETURN new_id;
END;
$$;


--
-- Name: check_family_parent_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_family_parent_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

  IF (
    SELECT count(*)
    FROM family_parents
    WHERE family_id = NEW.family_id
  ) >= 2 THEN

    RAISE EXCEPTION
      'family % already has 2 parents',
      NEW.family_id;

  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: commit_gedcom_merge_suggestions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_gedcom_merge_suggestions(p_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: commit_gedcom_staging_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_gedcom_staging_session(p_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    AND record_type = 'person'
    AND action = 'match'
    AND status = 'pending';

  IF v_error_count > 0 THEN
    RAISE EXCEPTION 'pending_possible_matches: còn % person possible matches chưa duyệt. Hãy xử lý trong Match Review trước khi commit', v_error_count;
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


--
-- Name: count_active_empty_families(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_active_empty_families() RETURNS TABLE(count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: count_duplicate_birth_death_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_duplicate_birth_death_events() RETURNS TABLE(count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: count_events_without_person_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_events_without_person_events() RETURNS TABLE(count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: count_import_merge_suggestions_by_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_import_merge_suggestions_by_session(p_session_id uuid) RETURNS TABLE(suggestion_type text, status text, count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: count_import_staging_records_by_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_import_staging_records_by_session(p_session_id uuid) RETURNS TABLE(record_type text, action text, status text, count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: count_orphan_active_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_orphan_active_events() RETURNS TABLE(count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: create_family_unit(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_family_unit(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_family_id UUID;
  is_db_admin BOOLEAN;
BEGIN
  /*
    SQL Editor / migration thường chạy bằng postgres hoặc service role,
    không có auth.uid(). Cho phép DB admin chạy để test/migration.
    Client app vẫn cần is_editor() hoặc is_admin().
  */
  is_db_admin := current_user IN ('postgres', 'supabase_admin')
                 OR current_role IN ('postgres', 'supabase_admin');

  IF NOT (is_db_admin OR public.is_editor() OR public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_PERMISSION', 'error', 'Không có quyền');
  END IF;

  INSERT INTO public.families(type, status, legacy_relationship_id)
  VALUES (
    COALESCE(payload->>'type', 'marriage')::public.family_type_enum,
    COALESCE(payload->>'status', 'active')::public.family_status_enum,
    NULLIF(payload->>'legacy_relationship_id', '')::UUID
  )
  RETURNING id INTO new_family_id;

  IF payload->>'parent_a_id' IS NOT NULL THEN
    INSERT INTO public.family_parents(family_id, person_id, role)
    VALUES (
      new_family_id,
      (payload->>'parent_a_id')::UUID,
      COALESCE(payload->>'parent_a_role', 'partner')::public.parent_role_enum
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF payload->>'parent_b_id' IS NOT NULL THEN
    INSERT INTO public.family_parents(family_id, person_id, role)
    VALUES (
      new_family_id,
      (payload->>'parent_b_id')::UUID,
      COALESCE(payload->>'parent_b_role', 'partner')::public.parent_role_enum
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'family_id', new_family_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'error', SQLERRM);
END;
$$;


--
-- Name: delete_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;
    
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot delete yourself.';
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


--
-- Name: ensure_family_model_child(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_family_model_child(p_parent_a uuid, p_child uuid, p_parent_b uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_family_id uuid;
  v_gender_a text;
  v_gender_b text;
BEGIN

  IF p_parent_a IS NULL OR p_child IS NULL THEN
    RAISE EXCEPTION 'parent_a and child must not be null';
  END IF;

IF p_parent_b IS NOT NULL
AND p_parent_a = p_parent_b THEN
  RAISE EXCEPTION 'parent_a and parent_b must be different';
END IF;

  ------------------------------------------------------------------
  -- CASE 1: Có đủ cha mẹ
  ------------------------------------------------------------------

  IF p_parent_b IS NOT NULL THEN

    SELECT f.id
    INTO v_family_id
    FROM families f
    JOIN family_parents fp1
      ON fp1.family_id = f.id
     AND fp1.person_id = p_parent_a
    JOIN family_parents fp2
      ON fp2.family_id = f.id
     AND fp2.person_id = p_parent_b
    WHERE f.deleted_at IS NULL
    LIMIT 1;

    ----------------------------------------------------------------
    -- KHÔNG TÌM THẤY → TẠO FAMILY MỚI
    ----------------------------------------------------------------

    IF v_family_id IS NULL THEN

      INSERT INTO families(status)
      VALUES ('active')
      RETURNING id INTO v_family_id;

SELECT gender::text
INTO v_gender_a
FROM persons
WHERE id = p_parent_a
  AND deleted_at IS NULL;

IF v_gender_a IS NULL THEN
  RAISE EXCEPTION 'parent_a not found';
END IF;

      INSERT INTO family_parents(
        family_id,
        person_id,
        role,
        sort_order
      )
      VALUES (
        v_family_id,
        p_parent_a,
        CASE
          WHEN v_gender_a='male' THEN 'husband'
          WHEN v_gender_a='female' THEN 'wife'
          ELSE 'parent'
        END,
        0
      );

      SELECT gender::text
      INTO v_gender_b
      FROM persons
      WHERE id = p_parent_b;

      INSERT INTO family_parents(
        family_id,
        person_id,
        role,
        sort_order
      )
      VALUES (
        v_family_id,
        p_parent_b,
        CASE
          WHEN v_gender_b='male' THEN 'husband'
          WHEN v_gender_b='female' THEN 'wife'
          ELSE 'parent'
        END,
        1
      );
    END IF;

  ------------------------------------------------------------------
  -- CASE 2: Chỉ có 1 parent
  ------------------------------------------------------------------

  ELSE

    SELECT f.id
    INTO v_family_id
    FROM families f
    JOIN family_parents fp
      ON fp.family_id = f.id
     AND fp.person_id = p_parent_a
    WHERE f.deleted_at IS NULL
    ORDER BY f.created_at DESC
    LIMIT 1;

    IF v_family_id IS NULL THEN

      INSERT INTO families(status)
      VALUES ('active')
      RETURNING id INTO v_family_id;

      SELECT gender::text
      INTO v_gender_a
      FROM persons
      WHERE id = p_parent_a;

      INSERT INTO family_parents(
        family_id,
        person_id,
        role,
        sort_order
      )
      VALUES (
        v_family_id,
        p_parent_a,
        CASE
          WHEN v_gender_a='male' THEN 'husband'
          WHEN v_gender_a='female' THEN 'wife'
          ELSE 'parent'
        END,
        0
      );
    END IF;

  END IF;

  ------------------------------------------------------------------
  -- CHILD
  ------------------------------------------------------------------
IF EXISTS (
  SELECT 1
  FROM family_children fc
  JOIN families f
    ON f.id = fc.family_id
  WHERE fc.person_id = p_child
    AND f.deleted_at IS NULL
    AND fc.family_id <> v_family_id
) THEN

  RAISE EXCEPTION
    'child % already belongs to another active family',
    p_child;

END IF;
  INSERT INTO family_children(
    family_id,
    person_id,
    relationship_type,
    sort_order,
    migration_confidence
  )
  VALUES (
    v_family_id,
    p_child,
    'biological',
    0,
    'certain'
  )
  ON CONFLICT DO NOTHING;

  RETURN v_family_id;

END;
$$;


--
-- Name: FUNCTION ensure_family_model_child(p_parent_a uuid, p_child uuid, p_parent_b uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ensure_family_model_child(p_parent_a uuid, p_child uuid, p_parent_b uuid) IS 'Primary synchronization path from relationships -> family model';


--
-- Name: ensure_family_model_marriage(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_family_model_marriage(p_person_a uuid, p_person_b uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_family_id UUID;
  v_gender_a TEXT;
  v_gender_b TEXT;
BEGIN
  IF p_person_a IS NULL OR p_person_b IS NULL THEN
    RAISE EXCEPTION 'person ids must not be null';
  END IF;

  IF p_person_a = p_person_b THEN
    RAISE EXCEPTION 'cannot create marriage with same person';
  END IF;

  SELECT f.id
  INTO v_family_id
  FROM public.families f
  JOIN public.family_parents fp1
    ON fp1.family_id = f.id
   AND fp1.person_id = p_person_a
  JOIN public.family_parents fp2
    ON fp2.family_id = f.id
   AND fp2.person_id = p_person_b
  WHERE f.deleted_at IS NULL
  LIMIT 1;

  IF v_family_id IS NOT NULL THEN
    RETURN v_family_id;
  END IF;

  SELECT gender::TEXT
  INTO v_gender_a
  FROM public.persons
  WHERE id = p_person_a
    AND deleted_at IS NULL;

  SELECT gender::TEXT
  INTO v_gender_b
  FROM public.persons
  WHERE id = p_person_b
    AND deleted_at IS NULL;

  IF v_gender_a IS NULL OR v_gender_b IS NULL THEN
    RAISE EXCEPTION 'one or both persons not found';
  END IF;

  INSERT INTO public.families (status)
  VALUES ('active'::public.family_status_enum)
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_parents (
    family_id,
    person_id,
    role,
    sort_order
  )
  VALUES
    (
      v_family_id,
      p_person_a,
      (
        CASE
          WHEN v_gender_a = 'male' THEN 'husband'
          WHEN v_gender_a = 'female' THEN 'wife'
          ELSE 'partner'
        END
      )::public.parent_role_enum,
      0
    ),
    (
      v_family_id,
      p_person_b,
      (
        CASE
          WHEN v_gender_b = 'male' THEN 'husband'
          WHEN v_gender_b = 'female' THEN 'wife'
          ELSE 'partner'
        END
      )::public.parent_role_enum,
      1
    );

  RETURN v_family_id;
END;
$$;


--
-- Name: get_admin_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_users() RETURNS TABLE(id uuid, email text, full_name text, role text, is_active boolean, created_at timestamp with time zone, default_tree_root_id uuid, username text, person_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      ''
    )::TEXT AS full_name,
    p.role::TEXT AS role,
    p.is_active,
    u.created_at,
    up.default_tree_root_id,
    p.username,
    p.person_id
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id
  LEFT JOIN public.user_preferences up
    ON up.user_id = u.id
  ORDER BY u.created_at DESC;
$$;


--
-- Name: handle_first_user_confirmation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_first_user_confirmation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth'
    AS $$
BEGIN
  -- If no users exist yet, auto-confirm this first one
  IF NOT EXISTS (SELECT 1 FROM auth.users) THEN
    NEW.email_confirmed_at := NOW();
    NEW.last_sign_in_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Check if this is the first user (count will be 1 as this is AFTER INSERT)
  SELECT count(*) = 1 FROM auth.users INTO is_first_user;

  INSERT INTO public.profiles (id, role, is_active)
  VALUES (
    new.id, 
    CASE WHEN is_first_user THEN 'admin'::public.user_role_enum ELSE 'member'::public.user_role_enum END,
    true
  );

  UPDATE public.profiles 
  SET is_active = true 
  WHERE id = new.id AND is_first_user = true;

  RETURN new;
END;
$$;

--
-- GHI CHU: ban dump goc (supabase db dump --schema public) BI THIEU trigger
-- gan ham tren vao auth.users, vi trigger nay thuoc auth.users (ngoai pham
-- vi --schema public) du ham thuc thi lai nam trong public. Bo sung lai
-- thu cong tai day de fresh install khong bi loi "dang ky xong khong tu
-- kich hoat / khong phai admin".
--

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: increment_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;


--
-- Name: insert_audit_log(text, text, text, text, text, jsonb, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_audit_log(p_action text, p_entity_type text DEFAULT 'system'::text, p_entity_id text DEFAULT NULL::text, p_entity_label text DEFAULT NULL::text, p_severity text DEFAULT 'info'::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_actor_user_id uuid DEFAULT NULL::uuid, p_actor_email text DEFAULT NULL::text, p_actor_role text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_id UUID;
  v_actor UUID;
  v_email TEXT;
  v_role TEXT;
  v_entity_type TEXT;
  v_severity TEXT;
  v_record_id UUID;
BEGIN
  v_actor := COALESCE(p_actor_user_id, auth.uid());
  v_entity_type := COALESCE(NULLIF(p_entity_type, ''), 'system');
  v_severity := COALESCE(NULLIF(p_severity, ''), 'info');

  IF v_severity NOT IN ('info', 'warning', 'danger') THEN
    v_severity := 'info';
  END IF;

  v_email := p_actor_email;
  v_role := p_actor_role;

  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(v_email, u.email)
    INTO v_email
    FROM auth.users u
    WHERE u.id = v_actor;

    SELECT COALESCE(v_role, pr.role::text)
    INTO v_role
    FROM public.profiles pr
    WHERE pr.id = v_actor;
  END IF;

  BEGIN
    v_record_id := NULLIF(p_entity_id, '')::uuid;
  EXCEPTION WHEN others THEN
    v_record_id := gen_random_uuid();
  END;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    changed_by,
    old_data,
    new_data,
    source,
    changed_at,
    actor_user_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    entity_label,
    severity,
    metadata,
    created_at
  )
  VALUES (
    v_entity_type,
    COALESCE(v_record_id, gen_random_uuid()),
    v_actor,
    NULL,
    COALESCE(p_metadata, '{}'::jsonb),
    'app_rpc',
    now(),
    v_actor,
    v_email,
    v_role,
    COALESCE(NULLIF(p_action, ''), 'unknown'),
    v_entity_type,
    p_entity_id,
    p_entity_label,
    v_severity,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


--
-- Name: is_editor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_editor() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'editor'
  );
END;
$$;


--
-- Name: visible_person_ids(); Type: FUNCTION; Schema: public; Owner: -
--
-- Tra ve tap person_id ma user hien tai (auth.uid()) duoc phep xem, dung
-- cho RLS branch-scoping. Mo phong logic trong
-- utils/permissions/visiblePersons.ts (JS).
--

CREATE FUNCTION public.visible_person_ids() RETURNS TABLE(visible_id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role text;
  v_viewer_person_id uuid;
BEGIN
  SELECT role::text, person_id
  INTO v_role, v_viewer_person_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role = 'admin' THEN
    RETURN QUERY SELECT p.id FROM public.persons p WHERE p.deleted_at IS NULL;
    RETURN;
  END IF;

  IF v_viewer_person_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.persons p
    WHERE p.id = v_viewer_person_id AND p.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  parent_child_edges AS (
    SELECT r.person_a AS parent_id, r.person_b AS child_id
    FROM public.relationships r
    WHERE r.deleted_at IS NULL
      AND r.type IN ('biological_child', 'adopted_child')
      AND EXISTS (SELECT 1 FROM public.persons pa WHERE pa.id = r.person_a AND pa.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pb WHERE pb.id = r.person_b AND pb.deleted_at IS NULL)

    UNION

    SELECT fp.person_id AS parent_id, fc.person_id AS child_id
    FROM public.family_parents fp
    JOIN public.family_children fc ON fc.family_id = fp.family_id
    WHERE EXISTS (SELECT 1 FROM public.families f WHERE f.id = fp.family_id AND f.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pp WHERE pp.id = fp.person_id AND pp.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pc WHERE pc.id = fc.person_id AND pc.deleted_at IS NULL)
  ),
  spouse_edges AS (
    SELECT r.person_a AS a, r.person_b AS b
    FROM public.relationships r
    WHERE r.deleted_at IS NULL AND r.type = 'marriage'
      AND EXISTS (SELECT 1 FROM public.persons pa WHERE pa.id = r.person_a AND pa.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pb WHERE pb.id = r.person_b AND pb.deleted_at IS NULL)
    UNION
    SELECT r.person_b AS a, r.person_a AS b
    FROM public.relationships r
    WHERE r.deleted_at IS NULL AND r.type = 'marriage'
      AND EXISTS (SELECT 1 FROM public.persons pa WHERE pa.id = r.person_a AND pa.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons pb WHERE pb.id = r.person_b AND pb.deleted_at IS NULL)
    UNION
    SELECT fp1.person_id AS a, fp2.person_id AS b
    FROM public.family_parents fp1
    JOIN public.family_parents fp2
      ON fp2.family_id = fp1.family_id AND fp2.person_id <> fp1.person_id
    WHERE EXISTS (SELECT 1 FROM public.families f WHERE f.id = fp1.family_id AND f.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons p1 WHERE p1.id = fp1.person_id AND p1.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM public.persons p2 WHERE p2.id = fp2.person_id AND p2.deleted_at IS NULL)
  ),
  ancestors AS (
    SELECT v_viewer_person_id AS id
    UNION
    SELECT pce.parent_id
    FROM parent_child_edges pce
    JOIN ancestors a ON a.id = pce.child_id
  ),
  lineage_scope AS (
    SELECT id FROM ancestors
    UNION
    SELECT pce.child_id
    FROM parent_child_edges pce
    JOIN lineage_scope ls ON ls.id = pce.parent_id
  ),
  viewer_spouses AS (
    SELECT b AS id FROM spouse_edges WHERE a = v_viewer_person_id
  ),
  spouse_ancestors AS (
    SELECT vs.id FROM viewer_spouses vs
    UNION
    SELECT pce.parent_id
    FROM parent_child_edges pce
    JOIN spouse_ancestors sa ON sa.id = pce.child_id
  ),
  spouse_lineage_scope AS (
    SELECT id FROM spouse_ancestors
    UNION
    SELECT pce.child_id
    FROM parent_child_edges pce
    JOIN spouse_lineage_scope sls ON sls.id = pce.parent_id
  )
  SELECT DISTINCT v.id
  FROM (
    SELECT v_viewer_person_id AS id
    UNION SELECT id FROM lineage_scope
    UNION SELECT se.b FROM spouse_edges se JOIN lineage_scope ls ON ls.id = se.a
    UNION SELECT id FROM viewer_spouses
    UNION SELECT id FROM spouse_lineage_scope
    UNION SELECT se.b FROM spouse_edges se JOIN spouse_lineage_scope sls ON sls.id = se.a
  ) v
  JOIN public.persons p ON p.id = v.id AND p.deleted_at IS NULL;
END;
$$;


--
-- Name: visible_family_ids(); Type: FUNCTION; Schema: public; Owner: -
--
-- Tra ve tap family_id co it nhat 1 thanh vien (cha/me hoac con) thuoc
-- nhanh nhin thay duoc cua user hien tai. Tinh 1 lan duy nhat cho ca cau
-- truy van (khong nhan tham so theo dong) de tranh bi goi lap lai gay cham.
--

CREATE FUNCTION public.visible_family_ids() RETURNS TABLE(visible_family_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT fp.family_id
  FROM public.family_parents fp
  WHERE fp.person_id IN (SELECT visible_id FROM public.visible_person_ids())

  UNION

  SELECT DISTINCT fc.family_id
  FROM public.family_children fc
  WHERE fc.person_id IN (SELECT visible_id FROM public.visible_person_ids())
$$;


--
-- Name: log_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, changed_by, old_data, new_data, source)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'UPDATE' THEN 'UPDATE' ELSE 'DELETE' END,
    auth.uid(),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    COALESCE(NULLIF(current_setting('app.source', true), ''), 'app')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: normalize_vietnamese_search(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_vietnamese_search(input text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT lower(
    regexp_replace(
      unaccent(coalesce(input, '')),
      '\s+',
      ' ',
      'g'
    )
  );
$$;


--
-- Name: prevent_hard_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_hard_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard delete bị chặn trên bảng %. Hãy dùng soft delete.', TG_TABLE_NAME;
END;
$$;


--
-- Name: prevent_hard_delete_core(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_hard_delete_core() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'Hard delete is blocked on table %. Use soft delete via deleted_at instead.',
    TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;


--
-- Name: repair_events_missing_person_links(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repair_events_missing_person_links() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row RECORD;
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_role public.event_role_enum;
BEGIN
  FOR v_row IN
    SELECT
      e.id AS event_id,
      e.legacy_person_id AS person_id,
      e.type
    FROM public.events e
    WHERE e.deleted_at IS NULL
      AND e.legacy_person_id IS NOT NULL
      AND e.type IN ('birth', 'death')
      AND NOT EXISTS (
        SELECT 1
        FROM public.person_events pe
        WHERE pe.event_id = e.id
          AND pe.person_id = e.legacy_person_id
      )
  LOOP
    BEGIN
      v_role :=
        CASE
          WHEN v_row.type = 'death'
          THEN 'deceased'::public.event_role_enum
          ELSE 'principal'::public.event_role_enum
        END;

      INSERT INTO public.person_events (
        person_id,
        event_id,
        role
      )
      VALUES (
        v_row.person_id,
        v_row.event_id,
        v_role
      )
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object(
          'event_id', v_row.event_id,
          'person_id', v_row.person_id,
          'error', SQLERRM,
          'code', SQLSTATE
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;


--
-- Name: search_persons_unaccent(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_persons_unaccent(search_text text, exclude_person_id uuid DEFAULT NULL::uuid, limit_count integer DEFAULT 20) RETURNS TABLE(id uuid, full_name text, gender text, birth_year integer, death_year integer, avatar_url text, generation integer, is_in_law boolean)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.id,
    p.full_name,
    p.gender,
    p.birth_year,
    p.death_year,
    p.avatar_url,
    p.generation,
    p.is_in_law
  FROM public.persons_active p
  WHERE
    (exclude_person_id IS NULL OR p.id <> exclude_person_id)
    AND public.normalize_vietnamese_search(p.full_name)
      LIKE '%' || public.normalize_vietnamese_search(search_text) || '%'
  ORDER BY
    p.birth_year NULLS LAST,
    p.full_name ASC
  LIMIT greatest(1, least(coalesce(limit_count, 20), 100));
$$;


--
-- Name: set_places_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_places_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_user_active_status(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_active_status(target_user_id uuid, new_status boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    UPDATE public.profiles
    SET is_active = new_status
    WHERE id = target_user_id;
END;
$$;


--
-- Name: set_user_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_role(target_user_id uuid, new_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    UPDATE public.profiles
    SET role = new_role::public.user_role_enum
    WHERE id = target_user_id;
END;
$$;


--
-- Name: soft_delete_duplicate_birth_death_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_duplicate_birth_death_events() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: soft_delete_empty_families(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_empty_families() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  UPDATE public.families f
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE f.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.family_parents fp
      WHERE fp.family_id = f.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.family_children fc
      WHERE fc.family_id = f.id
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'soft_deleted', v_deleted
  );
END;
$$;


--
-- Name: soft_delete_source_cascade(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_source_cascade(input_source_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.sources s
       WHERE s.id = input_source_id
         AND s.created_by = auth.uid()
         AND s.deleted_at IS NULL
     )
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.person_source_links
  SET deleted_at = now()
  WHERE source_id = input_source_id
    AND deleted_at IS NULL;

  UPDATE public.event_source_links
  SET deleted_at = now()
  WHERE source_id = input_source_id
    AND deleted_at IS NULL;

  UPDATE public.sources
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE id = input_source_id
    AND deleted_at IS NULL;
END;
$$;


--
-- Name: soft_delete_source_link(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_source_link(link_table text, link_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF link_table = 'person_source_links' THEN
    UPDATE public.person_source_links
    SET deleted_at = now()
    WHERE id = link_id
      AND deleted_at IS NULL;

    RETURN;
  END IF;

  IF link_table = 'event_source_links' THEN
    UPDATE public.event_source_links
    SET deleted_at = now()
    WHERE id = link_id
      AND deleted_at IS NULL;

    RETURN;
  END IF;

  RAISE EXCEPTION 'Unsupported source link table: %', link_table;
END;
$$;


--
-- Name: sync_deleted_child_relationship(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_deleted_child_relationship() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin

  if old.deleted_at is null
     and new.deleted_at is not null
     and new.type in ('biological_child','adopted_child')
  then

    delete from family_children
    where person_id = new.person_b;

  end if;

  return new;
end;
$$;


--
-- Name: sync_marriage_to_family(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_marriage_to_family() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin

  if new.type <> 'marriage' then
    return new;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  perform ensure_family_model_marriage(
    new.person_a,
    new.person_b
  );

  return new;
end;
$$;


--
-- Name: sync_relationship_child_to_family(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_relationship_child_to_family() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  spouse_id uuid;
begin

  if new.type not in ('biological_child','adopted_child') then
    return new;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  ------------------------------------------------------------------
  -- tìm vợ/chồng của parent
  ------------------------------------------------------------------

  select case
           when person_a = new.person_a then person_b
           else person_a
         end
  into spouse_id
  from relationships
  where type='marriage'
    and deleted_at is null
    and (
      person_a = new.person_a
      or person_b = new.person_a
    )
  limit 1;

  perform ensure_family_model_child(
    new.person_a,
    new.person_b,
    spouse_id
  );

  return new;
end;
$$;


--
-- Name: touch_user_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_user_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL,
    default_tree_root_id uuid,
    default_dual_ancestry_root_id uuid,
    default_in_law_root_id uuid,
    default_mindmap_root_id uuid,
    default_bubble_root_id uuid,
    default_stats_root_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: upsert_user_root_preferences(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_root_preferences(target_user_id uuid, p_default_tree_root_id uuid DEFAULT NULL::uuid, p_default_dual_ancestry_root_id uuid DEFAULT NULL::uuid, p_default_in_law_root_id uuid DEFAULT NULL::uuid, p_default_stats_root_id uuid DEFAULT NULL::uuid) RETURNS public.user_preferences
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_row public.user_preferences;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_active = TRUE
  ) INTO v_is_admin;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user_id <> auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.user_preferences (
    user_id,
    default_tree_root_id,
    default_dual_ancestry_root_id,
    default_in_law_root_id,
    default_stats_root_id
  )
  VALUES (
    target_user_id,
    p_default_tree_root_id,
    p_default_dual_ancestry_root_id,
    p_default_in_law_root_id,
    p_default_stats_root_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    default_tree_root_id = EXCLUDED.default_tree_root_id,
    default_dual_ancestry_root_id = EXCLUDED.default_dual_ancestry_root_id,
    default_in_law_root_id = EXCLUDED.default_in_law_root_id,
    default_stats_root_id = EXCLUDED.default_stats_root_id,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text DEFAULT 'system'::text,
    record_id uuid DEFAULT gen_random_uuid(),
    action text DEFAULT 'unknown'::text NOT NULL,
    changed_by uuid,
    old_data jsonb,
    new_data jsonb,
    source text DEFAULT 'app'::text,
    changed_at timestamp with time zone DEFAULT now(),
    actor_user_id uuid,
    actor_email text,
    actor_role text,
    entity_type text DEFAULT 'system'::text NOT NULL,
    entity_id text,
    entity_label text,
    severity text DEFAULT 'info'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_logs_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'danger'::text]))),
    CONSTRAINT audit_logs_source_check CHECK ((source = ANY (ARRAY['app'::text, 'migration'::text, 'import'::text])))
);


--
-- Name: custom_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    content text,
    event_date date NOT NULL,
    location text,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: event_source_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_source_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    source_id uuid NOT NULL,
    citation_text text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.event_type_enum NOT NULL,
    title text,
    start_date date,
    end_date date,
    sort_date date,
    date_precision public.date_precision_enum DEFAULT 'unknown'::public.date_precision_enum,
    date_modifier public.date_modifier_enum DEFAULT 'unknown'::public.date_modifier_enum,
    canonical_calendar public.calendar_type_enum DEFAULT 'unknown'::public.calendar_type_enum,
    date_original_text text,
    date_phrase text,
    lunar_year integer,
    lunar_month integer,
    lunar_day integer,
    lunar_is_leap_month boolean DEFAULT false,
    place_id uuid,
    place_text text,
    description text,
    family_id uuid,
    legacy_person_id uuid,
    legacy_source text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    migration_confidence text DEFAULT 'certain'::text,
    CONSTRAINT events_canonical_calendar_check CHECK ((canonical_calendar = ANY (ARRAY['gregorian'::public.calendar_type_enum, 'lunar'::public.calendar_type_enum]))),
    CONSTRAINT events_migration_confidence_check CHECK ((migration_confidence = ANY (ARRAY['certain'::text, 'review'::text, 'manual'::text])))
);


--
-- Name: COLUMN events.place_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.place_id IS 'Optional structured place reference. events.place_text remains legacy/free-text fallback.';


--
-- Name: events_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.events_active AS
 SELECT id,
    type,
    title,
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
    place_id,
    place_text,
    description,
    family_id,
    legacy_person_id,
    legacy_source,
    deleted_at,
    deleted_by,
    version,
    created_at,
    updated_at
   FROM public.events
  WHERE (deleted_at IS NULL);


--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.family_type_enum DEFAULT 'marriage'::public.family_type_enum NOT NULL,
    status public.family_status_enum DEFAULT 'active'::public.family_status_enum NOT NULL,
    start_year integer,
    end_year integer,
    note text,
    legacy_relationship_id uuid,
    version integer DEFAULT 1 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: family_children; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_children (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    person_id uuid NOT NULL,
    relationship_type public.child_type_enum DEFAULT 'biological'::public.child_type_enum NOT NULL,
    sort_order integer DEFAULT 0,
    legacy_relationship_id uuid,
    migration_confidence text DEFAULT 'review'::text,
    CONSTRAINT family_children_migration_confidence_check CHECK ((migration_confidence = ANY (ARRAY['certain'::text, 'review'::text, 'manual'::text])))
);


--
-- Name: family_parents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_parents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role public.parent_role_enum NOT NULL,
    sort_order integer DEFAULT 0
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: home_assistant_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_assistant_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Home Assistant'::text NOT NULL,
    token_hash text NOT NULL,
    token_prefix text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: import_merge_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_merge_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    suggestion_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    matched_person_id uuid,
    matched_person_name text,
    source_record_id uuid,
    source_external_id text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text,
    created_by uuid DEFAULT auth.uid(),
    committed_by uuid,
    committed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT import_merge_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'skipped'::text, 'rejected'::text, 'committed'::text]))),
    CONSTRAINT import_merge_suggestions_type_check CHECK ((suggestion_type = ANY (ARRAY['create_event'::text, 'create_person_event'::text])))
);


--
-- Name: import_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text DEFAULT 'gedcom'::text NOT NULL,
    file_name text,
    file_size bigint,
    file_hash text,
    status text DEFAULT 'parsed'::text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    committed_by uuid,
    committed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT import_sessions_source_type_check CHECK ((source_type = ANY (ARRAY['gedcom'::text, 'json'::text, 'csv'::text, 'manual'::text]))),
    CONSTRAINT import_sessions_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'parsed'::text, 'reviewing'::text, 'ready_to_commit'::text, 'committing'::text, 'committed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: import_staging_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_staging_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    record_type text NOT NULL,
    external_id text,
    parent_external_id text,
    action text DEFAULT 'create'::text NOT NULL,
    confidence text DEFAULT 'review'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    normalized_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    matched_table text,
    matched_id uuid,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT import_staging_records_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'match'::text, 'skip'::text, 'warning'::text, 'error'::text]))),
    CONSTRAINT import_staging_records_confidence_check CHECK ((confidence = ANY (ARRAY['certain'::text, 'review'::text, 'low'::text, 'manual'::text]))),
    CONSTRAINT import_staging_records_record_type_check CHECK ((record_type = ANY (ARRAY['person'::text, 'name'::text, 'family'::text, 'family_parent'::text, 'family_child'::text, 'event'::text, 'person_event'::text, 'note'::text, 'source'::text, 'media'::text, 'warning'::text, 'unknown'::text]))),
    CONSTRAINT import_staging_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'skipped'::text, 'rejected'::text, 'committed'::text])))
);


--
-- Name: migration_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    rows_read integer,
    rows_written integer,
    rows_skipped integer,
    rows_review integer,
    error text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    run_by uuid,
    CONSTRAINT migration_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'failed'::text, 'rolled_back'::text])))
);


--
-- Name: migration_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_review (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    migration_name text NOT NULL,
    entity_type text NOT NULL,
    child_id uuid,
    parent_id uuid,
    candidate_families jsonb DEFAULT '[]'::jsonb,
    reason text NOT NULL,
    suggested_family_id uuid,
    status text DEFAULT 'pending'::text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT migration_review_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text, 'skipped'::text])))
);


--
-- Name: person_details_private; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_details_private (
    person_id uuid NOT NULL,
    phone_number text,
    occupation text,
    current_residence text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_place_id uuid
);


--
-- Name: COLUMN person_details_private.current_place_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person_details_private.current_place_id IS 'Structured current residence place. Text current_residence remains fallback.';


--
-- Name: person_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    event_id uuid NOT NULL,
    role public.event_role_enum DEFAULT 'principal'::public.event_role_enum
);


--
-- Name: person_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_names (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    type public.name_type_enum DEFAULT 'birth'::public.name_type_enum NOT NULL,
    full_text text NOT NULL,
    surname text,
    given_name text,
    language text DEFAULT 'vi'::text,
    is_primary boolean DEFAULT false,
    note text,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: person_source_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_source_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    source_id uuid NOT NULL,
    citation_text text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    gender public.gender_enum NOT NULL,
    birth_year integer,
    birth_month integer,
    birth_day integer,
    death_year integer,
    death_month integer,
    death_day integer,
    death_lunar_year integer,
    death_lunar_month integer,
    death_lunar_day integer,
    is_deceased boolean DEFAULT false NOT NULL,
    is_in_law boolean DEFAULT false NOT NULL,
    birth_order integer,
    generation integer,
    other_names text,
    avatar_url text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: persons_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.persons_active AS
 SELECT id,
    full_name,
    gender,
    birth_year,
    birth_month,
    birth_day,
    death_year,
    death_month,
    death_day,
    death_lunar_year,
    death_lunar_month,
    death_lunar_day,
    is_deceased,
    is_in_law,
    birth_order,
    generation,
    other_names,
    avatar_url,
    note,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
   FROM public.persons
  WHERE (deleted_at IS NULL);


--
-- Name: places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    province text,
    commune text,
    address_detail text,
    old_province text,
    old_district text,
    old_commune text,
    latitude double precision,
    longitude double precision,
    google_maps_url text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE places; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.places IS 'Reusable places for genealogy events/person facts. Uses current Vietnamese 2-level administration: province + commune.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role public.user_role_enum DEFAULT 'member'::public.user_role_enum NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    person_id uuid,
    username text,
    CONSTRAINT profiles_username_format_check CHECK (((username IS NULL) OR (username = ''::text) OR ((username = lower(username)) AND ((char_length(username) >= 3) AND (char_length(username) <= 32)) AND (username ~ '^[a-z0-9._]+$'::text) AND (username !~ '^\.'::text) AND (username !~ '\.$'::text) AND (username !~ '\.\.'::text))))
);


--
-- Name: relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.relationship_type_enum NOT NULL,
    person_a uuid NOT NULL,
    person_b uuid NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    status text DEFAULT 'active'::text NOT NULL,
    ended_at timestamp with time zone,
    divorce_note text,
    CONSTRAINT no_self_relationship CHECK ((person_a <> person_b)),
    CONSTRAINT relationships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'divorced'::text, 'separated'::text])))
);


--
-- Name: relationships_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.relationships_active AS
 SELECT id,
    type,
    person_a,
    person_b,
    note,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
   FROM public.relationships
  WHERE (deleted_at IS NULL);


--
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    source_type public.source_type DEFAULT 'other'::public.source_type NOT NULL,
    author text,
    publisher text,
    publication_date text,
    repository text,
    call_number text,
    url text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: custom_events custom_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_events
    ADD CONSTRAINT custom_events_pkey PRIMARY KEY (id);


--
-- Name: event_source_links event_source_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_source_links
    ADD CONSTRAINT event_source_links_pkey PRIMARY KEY (id);


--
-- Name: event_source_links event_source_links_unique_active; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_source_links
    ADD CONSTRAINT event_source_links_unique_active UNIQUE NULLS NOT DISTINCT (event_id, source_id, deleted_at);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: family_children family_children_family_id_person_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_children
    ADD CONSTRAINT family_children_family_id_person_id_key UNIQUE (family_id, person_id);


--
-- Name: family_children family_children_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_children
    ADD CONSTRAINT family_children_pkey PRIMARY KEY (id);


--
-- Name: family_parents family_parents_family_id_person_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_parents
    ADD CONSTRAINT family_parents_family_id_person_id_key UNIQUE (family_id, person_id);


--
-- Name: family_parents family_parents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_parents
    ADD CONSTRAINT family_parents_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);


--
-- Name: home_assistant_tokens home_assistant_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_assistant_tokens
    ADD CONSTRAINT home_assistant_tokens_pkey PRIMARY KEY (id);


--
-- Name: home_assistant_tokens home_assistant_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_assistant_tokens
    ADD CONSTRAINT home_assistant_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: import_merge_suggestions import_merge_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_merge_suggestions
    ADD CONSTRAINT import_merge_suggestions_pkey PRIMARY KEY (id);


--
-- Name: import_sessions import_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_sessions
    ADD CONSTRAINT import_sessions_pkey PRIMARY KEY (id);


--
-- Name: import_staging_records import_staging_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_staging_records
    ADD CONSTRAINT import_staging_records_pkey PRIMARY KEY (id);


--
-- Name: migration_log migration_log_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT migration_log_name_key UNIQUE (name);


--
-- Name: migration_log migration_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT migration_log_pkey PRIMARY KEY (id);


--
-- Name: migration_review migration_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_review
    ADD CONSTRAINT migration_review_pkey PRIMARY KEY (id);


--
-- Name: person_details_private person_details_private_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_details_private
    ADD CONSTRAINT person_details_private_pkey PRIMARY KEY (person_id);


--
-- Name: person_events person_events_person_id_event_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_events
    ADD CONSTRAINT person_events_person_id_event_id_role_key UNIQUE (person_id, event_id, role);


--
-- Name: person_events person_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_events
    ADD CONSTRAINT person_events_pkey PRIMARY KEY (id);


--
-- Name: person_names person_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_names
    ADD CONSTRAINT person_names_pkey PRIMARY KEY (id);


--
-- Name: person_source_links person_source_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_source_links
    ADD CONSTRAINT person_source_links_pkey PRIMARY KEY (id);


--
-- Name: person_source_links person_source_links_unique_active; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_source_links
    ADD CONSTRAINT person_source_links_unique_active UNIQUE NULLS NOT DISTINCT (person_id, source_id, deleted_at);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: relationships relationships_person_a_person_b_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_person_a_person_b_type_key UNIQUE (person_a, person_b, type);


--
-- Name: relationships relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_pkey PRIMARY KEY (id);


--
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: audit_logs_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_changed_at ON public.audit_logs USING btree (changed_at DESC);


--
-- Name: audit_logs_table_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_table_record ON public.audit_logs USING btree (table_name, record_id);


--
-- Name: events_family_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_family_id_idx ON public.events USING btree (family_id) WHERE (deleted_at IS NULL);


--
-- Name: events_legacy_person_type_source_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX events_legacy_person_type_source_uidx ON public.events USING btree (legacy_person_id, type, legacy_source) WHERE ((deleted_at IS NULL) AND (legacy_person_id IS NOT NULL) AND (legacy_source IS NOT NULL));


--
-- Name: events_type_sort_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_type_sort_date_idx ON public.events USING btree (type, sort_date);


--
-- Name: families_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX families_status_idx ON public.families USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: home_assistant_tokens_active_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_assistant_tokens_active_hash_idx ON public.home_assistant_tokens USING btree (token_hash) WHERE ((is_active = true) AND (revoked_at IS NULL));


--
-- Name: home_assistant_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_assistant_tokens_user_id_idx ON public.home_assistant_tokens USING btree (user_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor_user_id ON public.audit_logs USING btree (actor_user_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_custom_events_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_events_created_by ON public.custom_events USING btree (created_by);


--
-- Name: idx_custom_events_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_events_date ON public.custom_events USING btree (event_date);


--
-- Name: idx_custom_events_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_events_deleted_at ON public.custom_events USING btree (deleted_at);


--
-- Name: idx_event_source_links_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_source_links_event_id ON public.event_source_links USING btree (event_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_event_source_links_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_source_links_source_id ON public.event_source_links USING btree (source_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_events_place_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_place_id ON public.events USING btree (place_id) WHERE ((deleted_at IS NULL) AND (place_id IS NOT NULL));


--
-- Name: idx_import_merge_suggestions_dedupe_create_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_import_merge_suggestions_dedupe_create_event ON public.import_merge_suggestions USING btree (session_id, suggestion_type, matched_person_id, source_external_id) WHERE (suggestion_type = 'create_event'::text);


--
-- Name: idx_import_merge_suggestions_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_merge_suggestions_person ON public.import_merge_suggestions USING btree (matched_person_id);


--
-- Name: idx_import_merge_suggestions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_merge_suggestions_session ON public.import_merge_suggestions USING btree (session_id);


--
-- Name: idx_import_merge_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_merge_suggestions_status ON public.import_merge_suggestions USING btree (status);


--
-- Name: idx_person_details_private_current_place_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_details_private_current_place_id ON public.person_details_private USING btree (current_place_id) WHERE (current_place_id IS NOT NULL);


--
-- Name: idx_person_names_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_person_names_primary ON public.person_names USING btree (person_id) WHERE ((is_primary = true) AND (deleted_at IS NULL));


--
-- Name: idx_person_source_links_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_source_links_person_id ON public.person_source_links USING btree (person_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_person_source_links_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_source_links_source_id ON public.person_source_links USING btree (source_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_persons_birth_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_birth_year ON public.persons USING btree (birth_year);


--
-- Name: idx_persons_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_full_name ON public.persons USING btree (full_name);


--
-- Name: idx_persons_gender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_gender ON public.persons USING btree (gender);


--
-- Name: idx_persons_generation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_generation ON public.persons USING btree (generation);


--
-- Name: idx_persons_is_deceased; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_is_deceased ON public.persons USING btree (is_deceased);


--
-- Name: idx_places_active_google_maps_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_places_active_google_maps_url ON public.places USING btree (google_maps_url) WHERE ((deleted_at IS NULL) AND (google_maps_url IS NOT NULL));


--
-- Name: idx_places_active_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_places_active_name ON public.places USING btree (lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: idx_places_active_province_commune; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_places_active_province_commune ON public.places USING btree (lower(province), lower(commune)) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_is_active ON public.profiles USING btree (is_active);


--
-- Name: idx_profiles_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_person_id ON public.profiles USING btree (person_id);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_relationships_person_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_person_a ON public.relationships USING btree (person_a);


--
-- Name: idx_relationships_person_b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_person_b ON public.relationships USING btree (person_b);


--
-- Name: idx_relationships_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_type ON public.relationships USING btree (type);


--
-- Name: idx_sources_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_deleted_at ON public.sources USING btree (deleted_at);


--
-- Name: idx_sources_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_type ON public.sources USING btree (source_type);


--
-- Name: import_staging_records_external_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_staging_records_external_id_idx ON public.import_staging_records USING btree (session_id, external_id);


--
-- Name: import_staging_records_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_staging_records_session_id_idx ON public.import_staging_records USING btree (session_id);


--
-- Name: import_staging_records_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_staging_records_status_idx ON public.import_staging_records USING btree (session_id, status);


--
-- Name: import_staging_records_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_staging_records_type_idx ON public.import_staging_records USING btree (session_id, record_type);


--
-- Name: person_events_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX person_events_event_id_idx ON public.person_events USING btree (event_id);


--
-- Name: person_events_person_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX person_events_person_id_idx ON public.person_events USING btree (person_id);


--
-- Name: profiles_username_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_username_unique_idx ON public.profiles USING btree (lower(username)) WHERE ((username IS NOT NULL) AND (username <> ''::text));


--
-- Name: relationships_marriage_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relationships_marriage_status_idx ON public.relationships USING btree (type, status) WHERE (deleted_at IS NULL);


--
-- Name: events block_delete_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_delete_events BEFORE DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();


--
-- Name: events events_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_version BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: persons persons_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER persons_version BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: places places_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER places_set_updated_at BEFORE UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.set_places_updated_at();


--
-- Name: custom_events tr_custom_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_custom_events_updated_at BEFORE UPDATE ON public.custom_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: person_details_private tr_person_details_private_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_person_details_private_updated_at BEFORE UPDATE ON public.person_details_private FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: persons tr_persons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_persons_updated_at BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles tr_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: relationships tr_relationships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_relationships_updated_at BEFORE UPDATE ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: family_parents trg_family_parent_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_family_parent_limit BEFORE INSERT ON public.family_parents FOR EACH ROW EXECUTE FUNCTION public.check_family_parent_limit();


--
-- Name: relationships trg_marriage_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_marriage_sync AFTER INSERT ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.sync_marriage_to_family();


--
-- Name: events trg_prevent_hard_delete_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_hard_delete_events BEFORE DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete_core();


--
-- Name: families trg_prevent_hard_delete_families; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_hard_delete_families BEFORE DELETE ON public.families FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete_core();


--
-- Name: persons trg_prevent_hard_delete_persons; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_hard_delete_persons BEFORE DELETE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete_core();


--
-- Name: relationships trg_prevent_hard_delete_relationships; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_hard_delete_relationships BEFORE DELETE ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete_core();


--
-- Name: relationships trg_relationship_child_delete_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_relationship_child_delete_sync AFTER UPDATE ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.sync_deleted_child_relationship();


--
-- Name: relationships trg_relationship_child_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_relationship_child_sync AFTER INSERT ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.sync_relationship_child_to_family();


--
-- Name: user_preferences trg_touch_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_user_preferences_updated_at();


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);


--
-- Name: custom_events custom_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_events
    ADD CONSTRAINT custom_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: event_source_links event_source_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_source_links
    ADD CONSTRAINT event_source_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: event_source_links event_source_links_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_source_links
    ADD CONSTRAINT event_source_links_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_source_links event_source_links_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_source_links
    ADD CONSTRAINT event_source_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: events events_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id);


--
-- Name: events events_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);


--
-- Name: families families_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id);


--
-- Name: family_children family_children_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_children
    ADD CONSTRAINT family_children_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;


--
-- Name: family_children family_children_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_children
    ADD CONSTRAINT family_children_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: family_parents family_parents_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_parents
    ADD CONSTRAINT family_parents_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;


--
-- Name: family_parents family_parents_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_parents
    ADD CONSTRAINT family_parents_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: feature_flags feature_flags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: home_assistant_tokens home_assistant_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_assistant_tokens
    ADD CONSTRAINT home_assistant_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: import_merge_suggestions import_merge_suggestions_matched_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_merge_suggestions
    ADD CONSTRAINT import_merge_suggestions_matched_person_id_fkey FOREIGN KEY (matched_person_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: import_merge_suggestions import_merge_suggestions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_merge_suggestions
    ADD CONSTRAINT import_merge_suggestions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.import_sessions(id) ON DELETE CASCADE;


--
-- Name: import_merge_suggestions import_merge_suggestions_source_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_merge_suggestions
    ADD CONSTRAINT import_merge_suggestions_source_record_id_fkey FOREIGN KEY (source_record_id) REFERENCES public.import_staging_records(id) ON DELETE SET NULL;


--
-- Name: import_sessions import_sessions_committed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_sessions
    ADD CONSTRAINT import_sessions_committed_by_fkey FOREIGN KEY (committed_by) REFERENCES public.profiles(id);


--
-- Name: import_sessions import_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_sessions
    ADD CONSTRAINT import_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: import_staging_records import_staging_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_staging_records
    ADD CONSTRAINT import_staging_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.import_sessions(id) ON DELETE CASCADE;


--
-- Name: migration_log migration_log_run_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT migration_log_run_by_fkey FOREIGN KEY (run_by) REFERENCES public.profiles(id);


--
-- Name: migration_review migration_review_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_review
    ADD CONSTRAINT migration_review_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id);


--
-- Name: person_details_private person_details_private_current_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_details_private
    ADD CONSTRAINT person_details_private_current_place_id_fkey FOREIGN KEY (current_place_id) REFERENCES public.places(id) ON DELETE SET NULL;


--
-- Name: person_details_private person_details_private_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_details_private
    ADD CONSTRAINT person_details_private_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_events person_events_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_events
    ADD CONSTRAINT person_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: person_events person_events_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_events
    ADD CONSTRAINT person_events_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_names person_names_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_names
    ADD CONSTRAINT person_names_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_source_links person_source_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_source_links
    ADD CONSTRAINT person_source_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: person_source_links person_source_links_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_source_links
    ADD CONSTRAINT person_source_links_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_source_links person_source_links_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_source_links
    ADD CONSTRAINT person_source_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: persons persons_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id);


--
-- Name: places places_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: relationships relationships_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id);


--
-- Name: relationships relationships_person_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_person_a_fkey FOREIGN KEY (person_a) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: relationships relationships_person_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_person_b_fkey FOREIGN KEY (person_b) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: sources sources_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_default_bubble_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_bubble_root_id_fkey FOREIGN KEY (default_bubble_root_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_default_dual_ancestry_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_dual_ancestry_root_id_fkey FOREIGN KEY (default_dual_ancestry_root_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_default_in_law_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_in_law_root_id_fkey FOREIGN KEY (default_in_law_root_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_default_mindmap_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_mindmap_root_id_fkey FOREIGN KEY (default_mindmap_root_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_default_stats_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_stats_root_id_fkey FOREIGN KEY (default_stats_root_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_default_tree_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_tree_root_id_fkey FOREIGN KEY (default_tree_root_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: persons Admins and Editors can delete persons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "persons_delete_branch_scoped" ON public.persons FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (id IN (SELECT visible_id FROM public.visible_person_ids())))));


--
-- Name: relationships Admins and Editors can delete relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "relationships_delete_branch_scoped" ON public.relationships FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_a IN (SELECT visible_id FROM public.visible_person_ids())) AND (person_b IN (SELECT visible_id FROM public.visible_person_ids())))));


--
-- Name: persons Admins and Editors can insert persons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Editors can insert persons" ON public.persons FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_editor()));


--
-- Name: relationships Admins and Editors can insert relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "relationships_insert_branch_scoped" ON public.relationships FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR (public.is_editor() AND ((person_a IN (SELECT visible_id FROM public.visible_person_ids())) OR (person_b IN (SELECT visible_id FROM public.visible_person_ids()))))));


--
-- Name: persons Admins and Editors can update persons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "persons_update_branch_scoped" ON public.persons FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (id IN (SELECT visible_id FROM public.visible_person_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (id IN (SELECT visible_id FROM public.visible_person_ids())))));


--
-- Name: relationships Admins and Editors can update relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "relationships_update_branch_scoped" ON public.relationships FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_a IN (SELECT visible_id FROM public.visible_person_ids())) AND (person_b IN (SELECT visible_id FROM public.visible_person_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_a IN (SELECT visible_id FROM public.visible_person_ids())) AND (person_b IN (SELECT visible_id FROM public.visible_person_ids())))));


--
-- Name: import_merge_suggestions Admins and editors can manage import merge suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and editors can manage import merge suggestions" ON public.import_merge_suggestions USING ((public.is_admin() OR public.is_editor())) WITH CHECK ((public.is_admin() OR public.is_editor()));


--
-- Name: person_details_private Admins can manage private details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage private details" ON public.person_details_private TO authenticated USING (public.is_admin());


--
-- Name: audit_logs Admins can read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role_enum)))));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: person_details_private Admins can view private details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view private details" ON public.person_details_private FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: migration_log Admins manage migration_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage migration_log" ON public.migration_log USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: migration_review Admins manage migration_review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage migration_review" ON public.migration_review USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: audit_logs Admins read audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read audit_logs" ON public.audit_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role_enum)))));


--
-- Name: migration_log Admins read migration_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read migration_log" ON public.migration_log FOR SELECT USING (public.is_admin());


--
-- Name: custom_events Authenticated users can insert custom events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert custom events" ON public.custom_events FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: audit_logs Authenticated users can insert own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert own audit logs" ON public.audit_logs FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND ((actor_user_id IS NULL) OR (actor_user_id = auth.uid()))));


--
-- Name: feature_flags Authenticated users can read feature_flags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read feature_flags" ON public.feature_flags FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: events Editors manage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "events_insert_admin_editor" ON public.events FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_editor()));
CREATE POLICY "events_update_branch_scoped" ON public.events FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids())) OR (events.family_id IS NOT NULL AND events.family_id IN (SELECT visible_family_id FROM public.visible_family_ids())))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids())) OR (events.family_id IS NOT NULL AND events.family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))))));
CREATE POLICY "events_delete_branch_scoped" ON public.events FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids())) OR (events.family_id IS NOT NULL AND events.family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))))));
CREATE POLICY "events_select_branch_scoped" ON public.events FOR SELECT TO authenticated USING (
  (
    (deleted_at IS NULL) AND (
      EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = events.id AND pe.person_id IN (SELECT visible_id FROM public.visible_person_ids()))
      OR (events.family_id IS NOT NULL AND events.family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))
      OR (
        (public.is_admin() OR public.is_editor())
        AND events.family_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.person_events pe2 WHERE pe2.event_id = events.id)
      )
    )
  )
  OR (deleted_at IS NOT NULL AND (public.is_admin() OR public.is_editor()))
);


--
-- Name: families Editors manage families; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "families_insert_admin_editor" ON public.families FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_editor()));
CREATE POLICY "families_update_branch_scoped" ON public.families FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (id IN (SELECT visible_family_id FROM public.visible_family_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (id IN (SELECT visible_family_id FROM public.visible_family_ids())))));
CREATE POLICY "families_delete_branch_scoped" ON public.families FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (id IN (SELECT visible_family_id FROM public.visible_family_ids())))));
CREATE POLICY "families_select_branch_scoped" ON public.families FOR SELECT TO authenticated USING (
  (
    (deleted_at IS NULL) AND (
      (id IN (SELECT visible_family_id FROM public.visible_family_ids()))
      OR (
        (public.is_admin() OR public.is_editor())
        AND NOT EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.family_id = families.id)
        AND NOT EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.family_id = families.id)
      )
    )
  )
  OR (deleted_at IS NOT NULL AND (public.is_admin() OR public.is_editor()))
);


--
-- Name: family_children Editors manage family_children; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "family_children_insert_branch_scoped" ON public.family_children FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR (public.is_editor() AND ((person_id IN (SELECT visible_id FROM public.visible_person_ids())) OR (family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))))));
CREATE POLICY "family_children_update_branch_scoped" ON public.family_children FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "family_children_delete_branch_scoped" ON public.family_children FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "family_children_select_branch_scoped" ON public.family_children FOR SELECT TO authenticated USING (
  (person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  OR (family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))
);


--
-- Name: family_parents Editors manage family_parents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "family_parents_insert_branch_scoped" ON public.family_parents FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR (public.is_editor() AND ((person_id IN (SELECT visible_id FROM public.visible_person_ids())) OR (family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))))));
CREATE POLICY "family_parents_update_branch_scoped" ON public.family_parents FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "family_parents_delete_branch_scoped" ON public.family_parents FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "family_parents_select_branch_scoped" ON public.family_parents FOR SELECT TO authenticated USING (
  (person_id IN (SELECT visible_id FROM public.visible_person_ids()))
  OR (family_id IN (SELECT visible_family_id FROM public.visible_family_ids()))
);


--
-- Name: import_sessions Editors manage import sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editors manage import sessions" ON public.import_sessions USING ((public.is_admin() OR public.is_editor())) WITH CHECK ((public.is_admin() OR public.is_editor()));


--
-- Name: import_staging_records Editors manage import staging records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editors manage import staging records" ON public.import_staging_records USING ((public.is_admin() OR public.is_editor())) WITH CHECK ((public.is_admin() OR public.is_editor()));


--
-- Name: person_events Editors manage person_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "person_events_insert_branch_scoped" ON public.person_events FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "person_events_update_branch_scoped" ON public.person_events FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "person_events_delete_branch_scoped" ON public.person_events FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "person_events_select_branch_scoped" ON public.person_events FOR SELECT TO authenticated USING (person_id IN (SELECT visible_id FROM public.visible_person_ids()));


--
-- Name: person_names Editors manage person_names; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "person_names_insert_branch_scoped" ON public.person_names FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "person_names_update_branch_scoped" ON public.person_names FOR UPDATE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids()))))) WITH CHECK ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));
CREATE POLICY "person_names_delete_branch_scoped" ON public.person_names FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_editor() AND (person_id IN (SELECT visible_id FROM public.visible_person_ids())))));


--
-- Name: custom_events Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for authenticated users" ON public.custom_events FOR SELECT TO authenticated USING (true);


--
-- Name: persons Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "persons_select_branch_scoped" ON public.persons FOR SELECT TO authenticated USING (
  (
    (deleted_at IS NULL) AND (
      (id IN (SELECT visible_id FROM public.visible_person_ids()))
      OR (
        (public.is_admin() OR public.is_editor())
        AND NOT EXISTS (SELECT 1 FROM public.relationships r WHERE (r.person_a = persons.id OR r.person_b = persons.id) AND r.deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM public.family_parents fp WHERE fp.person_id = persons.id)
        AND NOT EXISTS (SELECT 1 FROM public.family_children fc WHERE fc.person_id = persons.id)
      )
    )
  )
  OR (deleted_at IS NOT NULL AND (public.is_admin() OR public.is_editor()))
);


--
-- Name: relationships Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "relationships_select_branch_scoped" ON public.relationships FOR SELECT TO authenticated USING (
  (
    (deleted_at IS NULL)
    AND (
      (
        (person_a IN (SELECT visible_id FROM public.visible_person_ids()))
        AND (person_b IN (SELECT visible_id FROM public.visible_person_ids()))
      )
      OR (
        (public.is_admin() OR public.is_editor())
        AND (
          (person_a IN (SELECT visible_id FROM public.visible_person_ids()))
          OR (person_b IN (SELECT visible_id FROM public.visible_person_ids()))
        )
      )
    )
  )
  OR (deleted_at IS NOT NULL AND (public.is_admin() OR public.is_editor()))
);


--
-- Name: feature_flags Only admins manage feature_flags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins manage feature_flags" ON public.feature_flags USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: events Read events; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: families Read families; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: family_children Read family_children; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: family_parents Read family_parents; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: import_sessions Read import sessions; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: import_staging_records Read import staging records; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: person_events Read person_events; Type: POLICY; Schema: public; Owner: -
--


--
-- Name: person_names Read person_names; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "person_names_select_branch_scoped" ON public.person_names FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND (person_id IN (SELECT visible_id FROM public.visible_person_ids()))));


--
-- Name: home_assistant_tokens Service role can manage HA tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage HA tokens" ON public.home_assistant_tokens USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: audit_logs Service role can manage audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage audit logs" ON public.audit_logs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: home_assistant_tokens Users can create own HA tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own HA tokens" ON public.home_assistant_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: custom_events Users can delete own custom events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own custom events" ON public.custom_events FOR DELETE TO authenticated USING (((auth.uid() = created_by) OR public.is_admin()));


--
-- Name: user_preferences Users can insert own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: home_assistant_tokens Users can read own HA tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own HA tokens" ON public.home_assistant_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users can read own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own preferences" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: home_assistant_tokens Users can revoke own HA tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can revoke own HA tokens" ON public.home_assistant_tokens FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: custom_events Users can update own custom events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own custom events" ON public.custom_events FOR UPDATE TO authenticated USING (((auth.uid() = created_by) OR public.is_admin()));


--
-- Name: user_preferences Users can update own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_events ENABLE ROW LEVEL SECURITY;

--
-- Name: event_source_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_source_links ENABLE ROW LEVEL SECURITY;

--
-- Name: event_source_links event_source_links_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_source_links_insert_own ON public.event_source_links FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) OR (created_by IS NULL)));


--
-- Name: event_source_links event_source_links_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_source_links_select_authenticated ON public.event_source_links FOR SELECT TO authenticated USING ((deleted_at IS NULL));


--
-- Name: event_source_links event_source_links_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_source_links_update_own_or_admin ON public.event_source_links FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR public.is_admin())) WITH CHECK (((created_by = auth.uid()) OR public.is_admin()));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: families; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

--
-- Name: family_children; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.family_children ENABLE ROW LEVEL SECURITY;

--
-- Name: family_parents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.family_parents ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: home_assistant_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_assistant_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: import_merge_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_merge_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: import_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: import_staging_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_staging_records ENABLE ROW LEVEL SECURITY;

--
-- Name: migration_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.migration_log ENABLE ROW LEVEL SECURITY;

--
-- Name: migration_review; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.migration_review ENABLE ROW LEVEL SECURITY;

--
-- Name: person_details_private; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_details_private ENABLE ROW LEVEL SECURITY;

--
-- Name: person_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_events ENABLE ROW LEVEL SECURITY;

--
-- Name: person_names; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_names ENABLE ROW LEVEL SECURITY;

--
-- Name: person_source_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_source_links ENABLE ROW LEVEL SECURITY;

--
-- Name: person_source_links person_source_links_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY person_source_links_insert_own ON public.person_source_links FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) OR (created_by IS NULL)));


--
-- Name: person_source_links person_source_links_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY person_source_links_select_authenticated ON public.person_source_links FOR SELECT TO authenticated USING ((deleted_at IS NULL));


--
-- Name: person_source_links person_source_links_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY person_source_links_update_own_or_admin ON public.person_source_links FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR public.is_admin())) WITH CHECK (((created_by = auth.uid()) OR public.is_admin()));


--
-- Name: persons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

--
-- Name: places; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

--
-- Name: places places_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY places_insert_admin_editor ON public.places FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_editor()));


--
-- Name: places places_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY places_select_authenticated ON public.places FOR SELECT TO authenticated USING ((deleted_at IS NULL));


--
-- Name: places places_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY places_update_admin_editor ON public.places FOR UPDATE TO authenticated USING ((public.is_admin() OR public.is_editor())) WITH CHECK ((public.is_admin() OR public.is_editor()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

--
-- Name: sources sources_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sources_insert_own ON public.sources FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) OR (created_by IS NULL)));


--
-- Name: sources sources_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sources_select_authenticated ON public.sources FOR SELECT TO authenticated USING ((deleted_at IS NULL));


--
-- Name: sources sources_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sources_update_own_or_admin ON public.sources FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role_enum)))))) WITH CHECK (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role_enum))))));


--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

