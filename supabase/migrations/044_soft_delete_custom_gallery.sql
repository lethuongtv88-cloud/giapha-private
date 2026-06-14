-- 044_soft_delete_custom_gallery.sql
-- Thêm soft delete cho custom_events và gallery_items nếu bảng tồn tại.
-- Hiện production có thể chưa có gallery_items, nên migration phải an toàn.

DO $$
BEGIN
  IF to_regclass('public.custom_events') IS NOT NULL THEN
    ALTER TABLE public.custom_events
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_custom_events_deleted_at
    ON public.custom_events(deleted_at);
  END IF;

  IF to_regclass('public.gallery_items') IS NOT NULL THEN
    ALTER TABLE public.gallery_items
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_gallery_items_deleted_at
    ON public.gallery_items(deleted_at);
  END IF;
END $$;
