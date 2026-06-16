-- 049_soft_delete_source_cascade.sql
-- Soft-delete a source and all active source links using SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.soft_delete_source_cascade(
  input_source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
