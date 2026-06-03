-- GIAPHA-OS v2.3.5 — Divorce / separated relationship status
-- Additive migration. Không xóa relationship/family khi ly hôn.

ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'divorced', 'separated')),
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS divorce_note TEXT;

CREATE INDEX IF NOT EXISTS relationships_marriage_status_idx
ON public.relationships(type, status)
WHERE deleted_at IS NULL;

-- Family Model đã có status ở các bản migration trước.
-- Các dòng dưới đây giúp chạy an toàn nếu database nào chưa có cột này.
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'divorced', 'separated')),
  ADD COLUMN IF NOT EXISTS end_year INT;

CREATE INDEX IF NOT EXISTS families_status_idx
ON public.families(status)
WHERE deleted_at IS NULL;
