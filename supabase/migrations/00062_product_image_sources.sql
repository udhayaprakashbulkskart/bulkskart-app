-- Audit trail and licence credits for product images replaced by scripts/product-images/pipeline.py.
-- One row per product: either the applied image with its source and licence, or a NEEDS REVIEW marker.

CREATE TABLE IF NOT EXISTS public.product_image_sources (
  product_id          uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  status              text NOT NULL CHECK (status IN ('applied', 'needs_review')),
  image_url           text,
  provider            text NOT NULL,
  search_query        text,
  source_page_url     text,
  original_image_url  text,
  title               text,
  creator             text,
  creator_url         text,
  license             text,
  license_version     text,
  license_url         text,
  previous_images     text[],
  batch_no            integer NOT NULL,
  notes               text,
  checked_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_image_sources_status_idx ON public.product_image_sources (status, batch_no);

ALTER TABLE public.product_image_sources ENABLE ROW LEVEL SECURITY;

-- Product pages show the photo credit, so applied rows are public. NEEDS REVIEW rows are not.
DROP POLICY IF EXISTS "Public can read applied image credits" ON public.product_image_sources;
CREATE POLICY "Public can read applied image credits"
  ON public.product_image_sources FOR SELECT
  USING (status = 'applied');

GRANT SELECT ON public.product_image_sources TO anon, authenticated;
GRANT ALL ON public.product_image_sources TO service_role;
