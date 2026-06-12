-- v2.6.5: Add explicit death anniversary / ngày giỗ event type.
-- Death events remain in the person's timeline, but event notifications should use death_anniversary only.

DO $$
BEGIN
  IF to_regtype('public.event_type_enum') IS NOT NULL THEN
    ALTER TYPE public.event_type_enum ADD VALUE IF NOT EXISTS 'death_anniversary';
  END IF;
END $$;

-- Compatibility for older databases that used public.event_type instead of public.event_type_enum.
DO $$
BEGIN
  IF to_regtype('public.event_type') IS NOT NULL THEN
    ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'death_anniversary';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_death_anniversary_person_idx
ON public.events(legacy_person_id, type, sort_date)
WHERE deleted_at IS NULL
  AND type::text = 'death_anniversary';


-- Store which calendar should drive recurring reminders.
-- For death_anniversary this must be lunar; death itself remains historical only.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS canonical_calendar TEXT DEFAULT 'gregorian';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_canonical_calendar_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_canonical_calendar_check
  CHECK (canonical_calendar IN ('gregorian', 'lunar'));

UPDATE public.events
SET canonical_calendar = 'lunar'
WHERE type::text = 'death_anniversary'
  AND deleted_at IS NULL;
