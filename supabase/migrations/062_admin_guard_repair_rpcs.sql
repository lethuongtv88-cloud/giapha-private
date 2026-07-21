-- 062_admin_guard_repair_rpcs.sql
--
-- VULNERABILITY FOUND: repair_events_missing_person_links(),
-- soft_delete_empty_families(), and soft_delete_duplicate_birth_death_events()
-- are SECURITY DEFINER functions granted to the "authenticated" role
-- (see docs/migrations/027, 028, 029) but have NO internal check that the
-- caller is an admin. The Next.js app only checks admin status in the
-- server action (assertAdminAction) BEFORE calling supabase.rpc(...), but
-- that check is client/server-action-side only. Any logged-in user
-- (member/editor) can call these RPCs directly via supabase-js or a raw
-- PostgREST request (e.g. from the browser console) and bypass the app
-- entirely, because PostgREST exposes any granted function regardless of
-- what the Next.js UI does.
--
-- Impact:
--   - soft_delete_empty_families() and soft_delete_duplicate_birth_death_events()
--     can be triggered by any authenticated (non-admin) user, and since they
--     are SECURITY DEFINER they operate across ALL branches, not just the
--     caller's visible scope.
--   - repair_events_missing_person_links() is lower risk (only inserts
--     missing links, does not delete data) but should still be admin-only
--     per the intended design.
--
-- Fix: add the same admin-check pattern already used by set_user_role()
-- and set_user_active_status() at the top of each function.

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_events_missing_person_links()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_role public.event_role_enum;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

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

CREATE OR REPLACE FUNCTION public.soft_delete_empty_families()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

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
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

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

COMMIT;
