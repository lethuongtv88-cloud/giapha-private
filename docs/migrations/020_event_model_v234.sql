DO $$ BEGIN
  CREATE TYPE public.date_precision_enum AS ENUM (
    'day',
    'month',
    'year',
    'decade',
    'range',
    'text',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_type_enum AS ENUM (
    'gregorian',
    'lunar',
    'text',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_role_enum AS ENUM (
    'principal',
    'child',
    'husband',
    'wife',
    'witness',
    'officiant',
    'deceased',
    'participant'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  type public.event_type_enum NOT NULL,
  title TEXT,

  start_date DATE,
  end_date DATE,
  sort_date DATE,

  date_precision public.date_precision_enum DEFAULT 'unknown',
  date_modifier public.date_modifier_enum DEFAULT 'unknown',
  canonical_calendar public.calendar_type_enum DEFAULT 'unknown',

  date_original_text TEXT,
  date_phrase TEXT,

  lunar_year INT,
  lunar_month INT,
  lunar_day INT,
  lunar_is_leap_month BOOLEAN DEFAULT FALSE,

  place_id UUID,
  place_text TEXT,
  description TEXT,

  family_id UUID REFERENCES public.families(id),
  legacy_person_id UUID REFERENCES public.persons(id),
  legacy_family_id UUID REFERENCES public.families(id),
  legacy_source TEXT,

  migration_confidence TEXT DEFAULT 'certain'
    CHECK (migration_confidence IN ('certain','review','manual')),

  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),

  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.person_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,

  role public.event_role_enum DEFAULT 'principal',
  sort_order INT DEFAULT 0,

  UNIQUE(person_id, event_id, role)
);

CREATE UNIQUE INDEX IF NOT EXISTS events_legacy_person_type_source_uidx
ON public.events(legacy_person_id, type, legacy_source)
WHERE deleted_at IS NULL
  AND legacy_person_id IS NOT NULL
  AND legacy_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_type_sort_date_idx
ON public.events(type, sort_date);

CREATE INDEX IF NOT EXISTS events_family_id_idx
ON public.events(family_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS person_events_person_id_idx
ON public.person_events(person_id);

CREATE INDEX IF NOT EXISTS person_events_event_id_idx
ON public.person_events(event_id);

CREATE OR REPLACE VIEW public.events_active AS
SELECT *
FROM public.events
WHERE deleted_at IS NULL;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read events" ON public.events;
CREATE POLICY "Read events" ON public.events
FOR SELECT USING (
  deleted_at IS NULL
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Read person_events" ON public.person_events;
CREATE POLICY "Read person_events" ON public.person_events
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Editors manage events" ON public.events;
CREATE POLICY "Editors manage events" ON public.events
FOR ALL USING (
  public.is_admin() OR public.is_editor()
)
WITH CHECK (
  public.is_admin() OR public.is_editor()
);

DROP POLICY IF EXISTS "Editors manage person_events" ON public.person_events;
CREATE POLICY "Editors manage person_events" ON public.person_events
FOR ALL USING (
  public.is_admin() OR public.is_editor()
)
WITH CHECK (
  public.is_admin() OR public.is_editor()
);

DROP TRIGGER IF EXISTS audit_events ON public.events;
CREATE TRIGGER audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_changes();

DROP TRIGGER IF EXISTS events_version ON public.events;
CREATE TRIGGER events_version
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.increment_version();

DROP TRIGGER IF EXISTS block_delete_events ON public.events;
CREATE TRIGGER block_delete_events
BEFORE DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
