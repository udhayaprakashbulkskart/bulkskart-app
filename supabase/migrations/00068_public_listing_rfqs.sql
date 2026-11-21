-- Public Requirements: buyer requirements collected from publicly accessible pages on other B2B websites,
-- kept apart from RFQs posted by BulkSkart buyers.
--
-- * The requirement itself (product, quantity, location, dates) is in `requirements` with source_type 'public_listing'.
-- * Where it came from (source website, original URL, verification) is in `public_listing_sources`, readable by
--   admins only, for auditing. Customers never see the source or get sent to it.
-- * These buyers are not on BulkSkart and have not authorised BulkSkart to forward quotations, so no quotation can
--   be sent on them, and supplier matching never runs for them.
-- * A public requirement shows only when an admin has approved it (review_status) and until it expires (expires_at,
--   30 days after it was posted).

ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'bulkskart',
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS listing_category text;

ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_source_type_check;
ALTER TABLE requirements ADD CONSTRAINT requirements_source_type_check
  CHECK (source_type IN ('bulkskart', 'public_listing'));

ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_review_status_check;
ALTER TABLE requirements ADD CONSTRAINT requirements_review_status_check
  CHECK (review_status IS NULL OR review_status IN ('pending', 'approved', 'rejected'));

-- Public requirements have no BulkSkart buyer and may not state a quantity or unit.
ALTER TABLE requirements ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE requirements ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE requirements ALTER COLUMN quantity_unit DROP NOT NULL;

-- BulkSkart RFQs keep every rule they had before.
ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_bulkskart_rfq_complete;
ALTER TABLE requirements ADD CONSTRAINT requirements_bulkskart_rfq_complete
  CHECK (source_type <> 'bulkskart' OR (buyer_id IS NOT NULL AND quantity IS NOT NULL AND quantity_unit IS NOT NULL));

-- A public requirement never has a BulkSkart buyer, always has a review state and always expires.
ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_public_listing_rules;
ALTER TABLE requirements ADD CONSTRAINT requirements_public_listing_rules
  CHECK (source_type <> 'public_listing' OR (buyer_id IS NULL AND review_status IS NOT NULL AND expires_at IS NOT NULL));

CREATE INDEX IF NOT EXISTS requirements_public_listing_idx
  ON requirements (review_status, expires_at DESC) WHERE source_type = 'public_listing';

-- Audit trail for each public requirement (admins only).
CREATE TABLE IF NOT EXISTS public_listing_sources (
  requirement_id uuid PRIMARY KEY REFERENCES requirements(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text NOT NULL UNIQUE,              -- the same original listing is never imported twice
  source_listing_id text,
  source_category text,
  source_subcategory text,
  source_posted_on date,
  collected_at timestamptz,
  verified_at timestamptz,
  verified_http_status integer,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public_listing_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_listing_sources_admin_select ON public_listing_sources;
CREATE POLICY public_listing_sources_admin_select ON public_listing_sources FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS public_listing_sources_admin_update ON public_listing_sources;
CREATE POLICY public_listing_sources_admin_update ON public_listing_sources FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS public_listing_sources_admin_delete ON public_listing_sources;
CREATE POLICY public_listing_sources_admin_delete ON public_listing_sources FOR DELETE USING (is_admin());

-- (Existing policies already let only admins change a public requirement: it has no buyer_id.)

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

-- No quotation on a public requirement: its buyer is not on BulkSkart and would never receive it.
CREATE OR REPLACE FUNCTION reject_quotation_on_public_listing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM requirements r WHERE r.id = NEW.requirement_id AND r.source_type = 'public_listing') THEN
    RAISE EXCEPTION 'Quotations are not available for public requirements: the buyer is not on BulkSkart.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_quotation_on_public_listing ON quotations;
CREATE TRIGGER trg_reject_quotation_on_public_listing
  BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION reject_quotation_on_public_listing();

COMMENT ON COLUMN requirements.source_type IS 'bulkskart = posted by a BulkSkart buyer; public_listing = collected from a public page elsewhere (source in public_listing_sources)';
COMMENT ON TABLE public_listing_sources IS 'Where each public requirement came from and how it was verified. Admins only.';
