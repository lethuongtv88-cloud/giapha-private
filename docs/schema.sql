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

CREATE SCHEMA public;


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
        WHEN v_payload->>'status' IN ('active', 'divorced', 'separat