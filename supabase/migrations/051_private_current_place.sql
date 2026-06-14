-- 051_private_current_place.sql
-- Add structured current residence place for private person contact details.

ALTER TABLE public.person_details_private
  ADD COLUMN IF NOT EXISTS current_place_id uuid REFERENCES public.places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_person_details_private_current_place_id
  ON public.person_details_private (current_place_id)
  WHERE current_place_id IS NOT NULL;

COMMENT ON COLUMN public.person_details_private.current_place_id IS
  'Structured current residence place. Text current_residence remains fallback.';
