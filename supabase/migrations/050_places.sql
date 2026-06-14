-- 050_places.sql
-- Add reusable places with current 2-level Vietnamese administrative fields.
-- Safe/additive migration: keep events.place_text as legacy/free-text fallback.

CREATE TABLE IF NOT EXISTS public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-friendly name, e.g. "Nhà thờ họ Lê", "Mộ ông Nguyễn Văn A"
  name text NOT NULL,

  -- Current 2-level administration
  province text,
  commune text,
  address_detail text,

  -- Historical / old administration names before merger
  old_province text,
  old_district text,
  old_commune text,

  -- Google Maps / navigation
  latitude double precision,
  longitude double precision,
  google_maps_url text,

  note text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES public.places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_places_active_name
  ON public.places (lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_places_active_province_commune
  ON public.places (lower(province), lower(commune))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_places_active_google_maps_url
  ON public.places (google_maps_url)
  WHERE deleted_at IS NULL
    AND google_maps_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_place_id
  ON public.events (place_id)
  WHERE deleted_at IS NULL
    AND place_id IS NOT NULL;

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "places_select_authenticated" ON public.places;
CREATE POLICY "places_select_authenticated"
ON public.places
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "places_insert_authenticated" ON public.places;
CREATE POLICY "places_insert_authenticated"
ON public.places
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "places_update_authenticated" ON public.places;
CREATE POLICY "places_update_authenticated"
ON public.places
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP TRIGGER IF EXISTS places_set_updated_at ON public.places;

CREATE OR REPLACE FUNCTION public.set_places_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER places_set_updated_at
BEFORE UPDATE ON public.places
FOR EACH ROW
EXECUTE FUNCTION public.set_places_updated_at();

COMMENT ON TABLE public.places IS
  'Reusable places for genealogy events/person facts. Uses current Vietnamese 2-level administration: province + commune.';

COMMENT ON COLUMN public.events.place_id IS
  'Optional structured place reference. events.place_text remains legacy/free-text fallback.';
