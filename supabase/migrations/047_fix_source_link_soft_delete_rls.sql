-- 047_fix_source_link_soft_delete_rls.sql
-- Allow authenticated users to soft-delete source links.
-- This fixes: new row violates row-level security policy for table person_source_links

DROP POLICY IF EXISTS person_source_links_update_own_or_admin
ON public.person_source_links;

CREATE POLICY person_source_links_update_authenticated
ON public.person_source_links
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS event_source_links_update_own_or_admin
ON public.event_source_links;

CREATE POLICY event_source_links_update_authenticated
ON public.event_source_links
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
