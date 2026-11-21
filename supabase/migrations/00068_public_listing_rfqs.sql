-- Public RFQ listings copied from other B2B marketplaces, kept apart from RFQs posted by BulkSkart buyers.
--
-- A public listing has no BulkSkart buyer: suppliers contact the buyer on the original page (source_url),
-- so it never takes quotations here and never starts BulkSkart's supplier matching.
-- Fields the source page does not show stay NULL (quantity and unit included).

ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'bulkskart',
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_listing_id text,
  ADD COLUMN IF NOT EXISTS source_category text,
  ADD COLUMN IF NOT EXISTS source_subcategory text,
  ADD COLUMN IF NOT EXISTS source_posted_on date,
  ADD COLUMN IF NOT EXISTS source_verified_at timestamptz;

ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_source_type_check;
ALTER TABLE requirements ADD CONSTRAINT requirements_source_type_check
  CHECK (source_type IN ('bulkskart', 'public_listing'));

-- Public listings have no BulkSkart buyer and may not state a quantity or unit.
ALTER TABLE requirements ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE requirements ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE requirements ALTER COLUMN quantity_unit DROP NOT NULL;

-- BulkSkart RFQs keep every rule they had before.
ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_bulkskart_rfq_complete;
ALTER TABLE requirements ADD CONSTRAINT requirements_bulkskart_rfq_complete
  CHECK (source_type <> 'bulkskart' OR (buyer_id IS NOT NULL AND quantity IS NOT NULL AND quantity_unit IS NOT NULL));

-- A public listing always says where it came from, and never has a BulkSkart buyer.
ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_public_listing_sourced;
ALTER TABLE requirements ADD CONSTRAINT requirements_public_listing_sourced
  CHECK (source_type <> 'public_listing' OR (source_url IS NOT NULL AND source_name IS NOT NULL AND buyer_id IS NULL));

-- The same original listing is never imported twice.
CREATE UNIQUE INDEX IF NOT EXISTS requirements_source_url_key ON requirements (source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS requirements_source_type_created_idx ON requirements (source_type, created_at DESC);

-- Supplier matching (and its notifications) only for BulkSkart RFQs.
CREATE OR REPLACE FUNCTION trigger_rfq_matching_on_new_req()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status <> 'active' OR NEW.source_type = 'public_listing' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    'https://ewnftvshvsrhawluloty.supabase.co/functions/v1/run-rfq-matching',
    jsonb_build_object('rfq_id', NEW.id)::text,
    'application/json'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT if EF call fails
  RETURN NEW;
END;
$$;

-- No BulkSkart quotation on a public listing: its buyer is not on BulkSkart and would never see it.
CREATE OR REPLACE FUNCTION reject_quotation_on_public_listing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM requirements r WHERE r.id = NEW.requirement_id AND r.source_type = 'public_listing') THEN
    RAISE EXCEPTION 'This RFQ is a public listing from another website. Contact the buyer on the original listing.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_quotation_on_public_listing ON quotations;
CREATE TRIGGER trg_reject_quotation_on_public_listing
  BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION reject_quotation_on_public_listing();

COMMENT ON COLUMN requirements.source_type IS 'bulkskart = posted by a BulkSkart buyer; public_listing = copied from a public page on another marketplace (see source_url)';
COMMENT ON COLUMN requirements.source_url IS 'Original public listing; shown as VIEW ORIGINAL RFQ';
