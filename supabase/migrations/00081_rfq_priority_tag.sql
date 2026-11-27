-- 00081: optional buyer priority tag on a requirement: urgent, emergency or hot.
-- Existing rows stay NULL (untagged). Public RFQ queries already select requirements.*,
-- so the new column is returned automatically. This does not touch profiles contact
-- columns or the 00080 contact RPCs.

BEGIN;

ALTER TABLE public.requirements
  ADD COLUMN IF NOT EXISTS priority_tag text;

ALTER TABLE public.requirements DROP CONSTRAINT IF EXISTS requirements_priority_tag_check;
ALTER TABLE public.requirements
  ADD CONSTRAINT requirements_priority_tag_check
  CHECK (priority_tag IS NULL OR priority_tag IN ('urgent', 'emergency', 'hot'));

COMMENT ON COLUMN public.requirements.priority_tag IS
  'Optional buyer-chosen tag: urgent, emergency or hot. NULL means untagged.';

-- Fail if the column can store any other value, or if existing rows were backfilled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.requirements
     WHERE priority_tag IS NOT NULL
       AND priority_tag NOT IN ('urgent', 'emergency', 'hot')
  ) THEN
    RAISE EXCEPTION 'priority_tag has unexpected values; nothing was changed';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
