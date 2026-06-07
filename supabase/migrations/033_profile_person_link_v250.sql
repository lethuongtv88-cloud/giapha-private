-- v2.5.0: Link application users to persons for branch-based permissions.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_person_id
ON public.profiles(person_id);
