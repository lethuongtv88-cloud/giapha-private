-- 046_sources_citations.sql
-- Source/Citation model cho dữ liệu gia phả.
-- Additive, không đụng dữ liệu cũ.

DO $$
BEGIN
  CREATE TYPE public.source_type AS ENUM (
    'document',
    'photo',
    'oral_history',
    'book',
    'website',
    'archive',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title text NOT NULL,
  source_type public.source_type NOT NULL DEFAULT 'other',

  author text,
  publisher text,
  publication_date text,
  repository text,
  call_number text,
  url text,

  note text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.person_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,

  citation_text text,
  note text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT person_source_links_unique_active
    UNIQUE NULLS NOT DISTINCT (person_id, source_id, deleted_at)
);

CREATE TABLE IF NOT EXISTS public.event_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,

  citation_text text,
  note text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT event_source_links_unique_active
    UNIQUE NULLS NOT DISTINCT (event_id, source_id, deleted_at)
);

CREATE INDEX IF NOT EXISTS idx_sources_deleted_at
ON public.sources(deleted_at);

CREATE INDEX IF NOT EXISTS idx_sources_type
ON public.sources(source_type);

CREATE INDEX IF NOT EXISTS idx_person_source_links_person_id
ON public.person_source_links(person_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_person_source_links_source_id
ON public.person_source_links(source_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_source_links_event_id
ON public.event_source_links(event_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_source_links_source_id
ON public.event_source_links(source_id)
WHERE deleted_at IS NULL;

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_source_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sources_select_authenticated" ON public.sources;
CREATE POLICY "sources_select_authenticated"
ON public.sources
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "sources_insert_authenticated" ON public.sources;
CREATE POLICY "sources_insert_authenticated"
ON public.sources
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "sources_update_own_or_admin" ON public.sources;
CREATE POLICY "sources_update_own_or_admin"
ON public.sources
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "person_source_links_select_authenticated" ON public.person_source_links;
CREATE POLICY "person_source_links_select_authenticated"
ON public.person_source_links
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "person_source_links_insert_authenticated" ON public.person_source_links;
CREATE POLICY "person_source_links_insert_authenticated"
ON public.person_source_links
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "person_source_links_update_own_or_admin" ON public.person_source_links;
CREATE POLICY "person_source_links_update_own_or_admin"
ON public.person_source_links
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "event_source_links_select_authenticated" ON public.event_source_links;
CREATE POLICY "event_source_links_select_authenticated"
ON public.event_source_links
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "event_source_links_insert_authenticated" ON public.event_source_links;
CREATE POLICY "event_source_links_insert_authenticated"
ON public.event_source_links
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "event_source_links_update_own_or_admin" ON public.event_source_links;
CREATE POLICY "event_source_links_update_own_or_admin"
ON public.event_source_links
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);
