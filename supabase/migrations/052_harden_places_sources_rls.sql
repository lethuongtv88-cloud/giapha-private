-- 052_harden_places_sources_rls.sql
-- Harden Places/Sources RLS after feature stabilization.

-- Places: authenticated users may read active places, but only admin/editor can write.
DROP POLICY IF EXISTS "places_select_authenticated" ON public.places;
CREATE POLICY "places_select_authenticated"
ON public.places
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "places_insert_authenticated" ON public.places;
CREATE POLICY "places_insert_admin_editor"
ON public.places
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_editor());

DROP POLICY IF EXISTS "places_update_authenticated" ON public.places;
CREATE POLICY "places_update_admin_editor"
ON public.places
FOR UPDATE
TO authenticated
USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

-- Source links: revert broad update policies to owner/admin.
DROP POLICY IF EXISTS person_source_links_update_authenticated
ON public.person_source_links;

CREATE POLICY person_source_links_update_own_or_admin
ON public.person_source_links
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS event_source_links_update_authenticated
ON public.event_source_links;

CREATE POLICY event_source_links_update_own_or_admin
ON public.event_source_links
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin()
);

-- Source cascade soft delete: only admin or source owner may soft-delete a source.
CREATE OR REPLACE FUNCTION public.soft_delete_source_cascade(
  input_source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.soft_delete_source_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_source_cascade(uuid) TO authenticated;
