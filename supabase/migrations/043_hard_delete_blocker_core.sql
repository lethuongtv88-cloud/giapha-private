-- 043_hard_delete_blocker_core.sql
-- Chặn hard delete trên các bảng lõi.
-- App chỉ được soft delete bằng deleted_at.
-- Nếu thật sự cần hard delete trong maintenance/restore có kiểm soát,
-- session phải set: SET LOCAL app.allow_hard_delete = 'true';

CREATE OR REPLACE FUNCTION public.prevent_hard_delete_core()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_persons ON public.persons;
CREATE TRIGGER trg_prevent_hard_delete_persons
BEFORE DELETE ON public.persons
FOR EACH ROW
EXECUTE FUNCTION public.prevent_hard_delete_core();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_relationships ON public.relationships;
CREATE TRIGGER trg_prevent_hard_delete_relationships
BEFORE DELETE ON public.relationships
FOR EACH ROW
EXECUTE FUNCTION public.prevent_hard_delete_core();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_families ON public.families;
CREATE TRIGGER trg_prevent_hard_delete_families
BEFORE DELETE ON public.families
FOR EACH ROW
EXECUTE FUNCTION public.prevent_hard_delete_core();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_events ON public.events;
CREATE TRIGGER trg_prevent_hard_delete_events
BEFORE DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_hard_delete_core();
