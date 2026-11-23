-- Live Verified Supplier Map
--
-- Buyers find manufacturers on a map. A company is shown ONLY when every one of these holds (checked here, in the
-- database functions the website calls, never only on the page):
--   * its business registration application is approved by an admin (business_verifications.status = 'approved'),
--     and the company's verification_status is 'verified' and it is not blocked;
--   * its owner's account is an active supplier account;
--   * it has at least one active product;
--   * its factory location is verified by an admin (factory_locations.status = 'verified');
--   * it is not one of the template's demo companies;
--   * its approval is less than a year old (recheck_due_at): after that an admin checks it again.
-- Pending, needs-info, rejected and suspended businesses never appear.
--
-- Verification: the manufacturer submits legal details and documents; the database checks the formats; an admin
-- checks the registration (official portals: MCA for CIN/LLPIN, GST taxpayer search, Udyam; for a business registered
-- outside India, that country's official company registry) and approves or rejects. Nothing is approved
-- automatically, and a GSTIN alone never counts as proof of incorporation: a company or LLP is approved only with its
-- CIN/LLPIN checked, and a business registered abroad only with its registration checked in that country's registry.
-- Every status change is written to verification_audit_log.
--
-- Worldwide: buyers search from anywhere, and factories can be anywhere (each location has its country).
--
-- The factory location is the registered factory address, pinned once by the manufacturer and checked by an admin.
-- No live GPS is collected.
--
-- It also makes the business document buckets private again (00033 had opened them to everyone).
--
-- Run by hand in the Supabase SQL editor after 00070. Safe to run again (also over an earlier copy of this file).
-- One transaction.

BEGIN;

-- ── Business registration applications (one current application per company) ──
CREATE TABLE IF NOT EXISTS public.business_verifications (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('private_limited', 'public_limited', 'llp', 'partnership', 'proprietorship', 'other', 'foreign_company')),
  legal_name text NOT NULL,
  cin_llpin text,
  gstin text,
  udyam_number text,
  -- a business registered outside India: the country and its company registry / business licence number
  registration_country text,
  registration_number text,
  registered_address text NOT NULL,
  factory_address text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  -- [{ "kind": "gst" | "incorporation" | "udyam" | "partnership_deed" | "factory" | "other", "path": "<user id>/...", "name": "..." }]
  -- files live in the private verification-docs bucket; admins open them with signed links
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'needs_info', 'approved', 'rejected', 'suspended')),
  gst_verified boolean NOT NULL DEFAULT false,
  cin_verified boolean NOT NULL DEFAULT false,
  udyam_verified boolean NOT NULL DEFAULT false,
  registry_verified boolean NOT NULL DEFAULT false,
  decision_note text,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  recheck_due_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_verifications_status_idx ON public.business_verifications (status, submitted_at DESC);
-- when an earlier copy of this file already created the table
ALTER TABLE public.business_verifications ADD COLUMN IF NOT EXISTS registration_country text;
ALTER TABLE public.business_verifications ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.business_verifications ADD COLUMN IF NOT EXISTS registry_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.business_verifications DROP CONSTRAINT IF EXISTS business_verifications_entity_type_check;
ALTER TABLE public.business_verifications ADD CONSTRAINT business_verifications_entity_type_check
  CHECK (entity_type IN ('private_limited', 'public_limited', 'llp', 'partnership', 'proprietorship', 'other', 'foreign_company'));

-- ── Registered factory location and availability ──
CREATE TABLE IF NOT EXISTS public.factory_locations (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  address text NOT NULL,
  city text,
  state text,
  country text NOT NULL DEFAULT 'India',
  pincode text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  monthly_capacity numeric CHECK (monthly_capacity IS NULL OR monthly_capacity >= 0),
  capacity_unit text,
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days BETWEEN 0 AND 365),
  stock_status text CHECK (stock_status IS NULL OR stock_status IN ('in_stock', 'limited', 'made_to_order', 'out_of_stock')),
  supply_type text CHECK (supply_type IS NULL OR supply_type IN ('bulk', 'contract', 'bulk_contract', 'export')),
  availability_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- distance searches first narrow by a latitude/longitude box, then measure exactly
CREATE INDEX IF NOT EXISTS factory_locations_verified_latlng_idx ON public.factory_locations (latitude, longitude) WHERE status = 'verified';
CREATE INDEX IF NOT EXISTS factory_locations_verified_country_idx ON public.factory_locations (lower(country)) WHERE status = 'verified';

-- ── Audit log of every verification decision ──
CREATE TABLE IF NOT EXISTS public.verification_audit_log (
  id bigserial PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  actor uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (subject IN ('business', 'location')),
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_audit_log_company_idx ON public.verification_audit_log (company_id, created_at DESC);

-- ── A public "something changed" signal for live map updates (no private data in it) ──
CREATE TABLE IF NOT EXISTS public.supplier_map_changes (
  id bigserial PRIMARY KEY,
  company_id uuid,
  kind text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_map_changes_at_idx ON public.supplier_map_changes (changed_at);

-- ── Access: applications, locations and the audit log are read by the owner and admins only; all writes go through
--    the functions below (no direct insert/update/delete from the website) ──
ALTER TABLE public.business_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_map_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_verifications_owner_admin_select ON public.business_verifications;
CREATE POLICY business_verifications_owner_admin_select ON public.business_verifications FOR SELECT
  USING (public.owns_company(company_id) OR public.is_admin());
DROP POLICY IF EXISTS factory_locations_owner_admin_select ON public.factory_locations;
CREATE POLICY factory_locations_owner_admin_select ON public.factory_locations FOR SELECT
  USING (public.owns_company(company_id) OR public.is_admin());
DROP POLICY IF EXISTS verification_audit_log_admin_select ON public.verification_audit_log;
CREATE POLICY verification_audit_log_admin_select ON public.verification_audit_log FOR SELECT
  USING (public.is_admin() OR public.owns_company(company_id));
DROP POLICY IF EXISTS supplier_map_changes_public_select ON public.supplier_map_changes;
CREATE POLICY supplier_map_changes_public_select ON public.supplier_map_changes FOR SELECT USING (true);
-- Supabase grants every new table to anon and authenticated by default; take back all but reading
REVOKE ALL ON public.business_verifications, public.factory_locations, public.verification_audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.business_verifications, public.factory_locations, public.verification_audit_log, public.supplier_map_changes FROM anon, authenticated;
GRANT SELECT ON public.business_verifications, public.factory_locations, public.verification_audit_log TO authenticated;
GRANT SELECT ON public.supplier_map_changes TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'supplier_map_changes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_map_changes;
  END IF;
END $$;

-- ── Business documents are private ──
-- 00033 made the verification-docs bucket public and let anyone read and upload to it. GST, PAN, incorporation and
-- bank documents must not be public: the bucket goes back to private, any rule that opens a document bucket to
-- everyone is removed, and only the owner (their own folder) and admins can reach the files. Pages open them through
-- signed links that expire. The same for business-docs, which the setup wizard and sign-up upload to.
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;
  UPDATE storage.buckets SET public = false WHERE id IN ('verification-docs', 'business-docs');
  -- rules for one document bucket that check neither the owner nor an admin (i.e. open to everyone)
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~ '(verification-docs|business-docs)'
       AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) !~ '(auth\.uid|is_admin|get_my_role|product-images|company-assets|avatars|rfq-images|attachments|chat-files|dispute-evidence|quotation-pdfs)'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
  EXECUTE 'DROP POLICY IF EXISTS doc_buckets_owner_folder ON storage.objects';
  EXECUTE $p$CREATE POLICY doc_buckets_owner_folder ON storage.objects FOR ALL TO authenticated
    USING (bucket_id IN ('verification-docs', 'business-docs') AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id IN ('verification-docs', 'business-docs') AND (storage.foldername(name))[1] = auth.uid()::text)$p$;
  EXECUTE 'DROP POLICY IF EXISTS doc_buckets_admin_read ON storage.objects';
  EXECUTE $p$CREATE POLICY doc_buckets_admin_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id IN ('verification-docs', 'business-docs') AND public.is_admin())$p$;
END $$;

-- ── Companies cannot mark themselves verified any more ──
-- (until now an owner could set verification_status = 'verified' on their own company)
CREATE OR REPLACE FUNCTION public.guard_company_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.verification_status IS DISTINCT FROM 'unverified' AND NEW.verification_status IS DISTINCT FROM 'pending' THEN
      NEW.verification_status := 'unverified';
    END IF;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    RETURN NEW;
  END IF;
  -- an owner may only move between "not submitted" and "waiting for review" (or re-apply after a rejection);
  -- verified and rejected are set by admins only
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NOT (NEW.verification_status IN ('unverified', 'pending') AND OLD.verification_status IN ('unverified', 'pending', 'rejected')) THEN
    NEW.verification_status := OLD.verification_status;
  END IF;
  NEW.verified_at := OLD.verified_at;
  NEW.verified_by := OLD.verified_by;
  NEW.verification_expiry_at := OLD.verification_expiry_at;
  NEW.rejection_reason := OLD.rejection_reason;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_company_verification_fields ON public.companies;
CREATE TRIGGER trg_guard_company_verification_fields
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_company_verification_fields();

-- ── Audit and live-change triggers ──
CREATE OR REPLACE FUNCTION public.log_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text := CASE TG_TABLE_NAME WHEN 'business_verifications' THEN 'business' ELSE 'location' END;
  v_note text := COALESCE(to_jsonb(NEW)->>'decision_note', to_jsonb(NEW)->>'review_note');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.verification_audit_log (company_id, actor, subject, action, from_status, to_status, note)
    VALUES (NEW.company_id, auth.uid(), v_subject, 'submitted', NULL, NEW.status, NULL);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.verification_audit_log (company_id, actor, subject, action, from_status, to_status, note)
    VALUES (NEW.company_id, auth.uid(), v_subject, 'status', OLD.status, NEW.status, v_note);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_business_verification ON public.business_verifications;
CREATE TRIGGER trg_log_business_verification AFTER INSERT OR UPDATE ON public.business_verifications
  FOR EACH ROW EXECUTE FUNCTION public.log_verification_change();
DROP TRIGGER IF EXISTS trg_log_factory_location ON public.factory_locations;
CREATE TRIGGER trg_log_factory_location AFTER INSERT OR UPDATE ON public.factory_locations
  FOR EACH ROW EXECUTE FUNCTION public.log_verification_change();

CREATE OR REPLACE FUNCTION public.signal_supplier_map_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_row jsonb := to_jsonb(COALESCE(NEW, OLD));
BEGIN
  v_company := (CASE TG_TABLE_NAME WHEN 'companies' THEN v_row->>'id' ELSE v_row->>'company_id' END)::uuid;
  INSERT INTO public.supplier_map_changes (company_id, kind) VALUES (v_company, TG_TABLE_NAME);
  DELETE FROM public.supplier_map_changes WHERE changed_at < now() - interval '2 days';
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_map_change_business ON public.business_verifications;
CREATE TRIGGER trg_map_change_business AFTER INSERT OR UPDATE OR DELETE ON public.business_verifications
  FOR EACH ROW EXECUTE FUNCTION public.signal_supplier_map_change();
DROP TRIGGER IF EXISTS trg_map_change_location ON public.factory_locations;
CREATE TRIGGER trg_map_change_location AFTER INSERT OR UPDATE OR DELETE ON public.factory_locations
  FOR EACH ROW EXECUTE FUNCTION public.signal_supplier_map_change();
DROP TRIGGER IF EXISTS trg_map_change_products ON public.products;
CREATE TRIGGER trg_map_change_products AFTER INSERT OR UPDATE OF is_active, name, moq, moq_unit, price_min, price_max, images OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.signal_supplier_map_change();
DROP TRIGGER IF EXISTS trg_map_change_companies ON public.companies;
CREATE TRIGGER trg_map_change_companies AFTER UPDATE OF verification_status, is_blocked, company_name, logo_url, cover_url ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.signal_supplier_map_change();

-- ── Which companies may appear on the map (the one place the display rules live) ──
CREATE OR REPLACE FUNCTION public.map_visible_company_ids()
RETURNS TABLE (company_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
    FROM public.companies c
    -- an approval lasts a year; after that the company is off the map until an admin checks it again
    JOIN public.business_verifications bv ON bv.company_id = c.id AND bv.status = 'approved'
         AND (bv.recheck_due_at IS NULL OR bv.recheck_due_at > now())
    JOIN public.factory_locations fl ON fl.company_id = c.id AND fl.status = 'verified'
    JOIN public.profiles p ON p.id = c.owner_id AND p.status = 'active' AND p.role = 'supplier'
   WHERE c.verification_status = 'verified'
     AND NOT COALESCE(c.is_blocked, false)
     AND c.owner_id <> '00000000-0000-0000-0000-000000000001'::uuid
     AND c.id::text NOT LIKE 'e1000001-0000-0000-0000-%'
     AND EXISTS (SELECT 1 FROM public.products pr WHERE pr.company_id = c.id AND pr.is_active);
$$;
REVOKE ALL ON FUNCTION public.map_visible_company_ids() FROM PUBLIC, anon, authenticated;

-- great-circle distance in km
CREATE OR REPLACE FUNCTION public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ── Search: verified manufacturers, optionally by product, around a point, in a map viewport, anywhere in the world ──
-- (the earlier signature, without p_country, is replaced)
DROP FUNCTION IF EXISTS public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text);
CREATE FUNCTION public.map_search_suppliers(
  p_query text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_max_moq numeric DEFAULT NULL,
  p_min_capacity numeric DEFAULT NULL,
  p_supplier_type text DEFAULT NULL,
  p_require_gst boolean DEFAULT false,
  p_require_cin boolean DEFAULT false,
  p_require_udyam boolean DEFAULT false,
  p_south double precision DEFAULT NULL,
  p_west double precision DEFAULT NULL,
  p_north double precision DEFAULT NULL,
  p_east double precision DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_country text DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid, company_name text, slug text, business_type text, city text, state text, country text,
  latitude double precision, longitude double precision, distance_km double precision,
  rating numeric, review_count integer, logo_url text, cover_url text,
  gst_verified boolean, cin_verified boolean, udyam_verified boolean, registry_verified boolean, verified_since timestamptz,
  matched_products jsonb, product_count integer, min_moq numeric, moq_unit text,
  monthly_capacity numeric, capacity_unit text, lead_time_days integer, stock_status text, supply_type text,
  availability_updated_at timestamptz, total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT NULLIF(btrim(p_query), '') AS term,
           NULLIF(btrim(p_category), '') AS cat,
           NULLIF(btrim(p_country), '') AS country,
           -- longitude half-width of the radius box (wide near the poles)
           CASE WHEN p_radius_km IS NULL OR p_lat IS NULL THEN NULL
                ELSE p_radius_km / (111.0 * GREATEST(cos(radians(p_lat)), 0.01)) END AS dlng,
           LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200) AS lim,
           GREATEST(COALESCE(p_offset, 0), 0) AS off
  ),
  base AS (
    SELECT c.id, c.company_name, c.slug, c.business_type, c.rating_avg, c.review_count, c.logo_url, c.cover_url,
           c.key_products, fl.latitude, fl.longitude, fl.city, fl.state, fl.country, fl.monthly_capacity, fl.capacity_unit,
           fl.lead_time_days, fl.stock_status, fl.supply_type, fl.availability_updated_at,
           bv.gst_verified, bv.cin_verified, bv.udyam_verified, bv.registry_verified, bv.decided_at,
           CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
                ELSE public.km_between(p_lat, p_lng, fl.latitude, fl.longitude) END AS dist
      FROM public.map_visible_company_ids() v
      JOIN public.companies c ON c.id = v.company_id
      JOIN public.factory_locations fl ON fl.company_id = c.id
      JOIN public.business_verifications bv ON bv.company_id = c.id, q
     WHERE (p_south IS NULL OR fl.latitude BETWEEN p_south AND p_north)
       -- a viewport that crosses the 180th meridian comes as west > east
       AND (p_west IS NULL OR p_east IS NULL OR CASE WHEN p_west <= p_east THEN fl.longitude BETWEEN p_west AND p_east
                                                     ELSE fl.longitude >= p_west OR fl.longitude <= p_east END)
       AND (q.country IS NULL OR lower(fl.country) = lower(q.country))
       -- a box around the point first, so the exact distance is only measured for nearby factories
       AND (p_radius_km IS NULL OR p_lat IS NULL OR p_lng IS NULL OR (
             fl.latitude BETWEEN p_lat - p_radius_km / 111.0 AND p_lat + p_radius_km / 111.0
             AND (q.dlng >= 180 OR abs(fl.longitude - p_lng) <= q.dlng OR abs(fl.longitude - p_lng) >= 360 - q.dlng)))
       AND (NOT p_require_gst OR bv.gst_verified)
       AND (NOT p_require_cin OR bv.cin_verified)
       AND (NOT p_require_udyam OR bv.udyam_verified)
       AND (p_supplier_type IS NULL OR c.business_type ILIKE '%' || p_supplier_type || '%' OR c.trade_type ILIKE '%' || p_supplier_type || '%')
       AND (p_min_capacity IS NULL OR fl.monthly_capacity >= p_min_capacity)
  ),
  prods AS (
    SELECT b.id AS company_id, pr.id, pr.name, pr.slug, pr.moq, pr.moq_unit, pr.price_min, pr.price_max, pr.price_currency,
           (pr.images)[1] AS image, cat.name AS category
      FROM base b
      JOIN public.products pr ON pr.company_id = b.id AND pr.is_active
      LEFT JOIN public.categories cat ON cat.id = pr.category_id, q
     WHERE (q.term IS NULL OR pr.name ILIKE '%' || q.term || '%' OR cat.name ILIKE '%' || q.term || '%'
            OR array_to_string(pr.tags, ' ') ILIKE '%' || q.term || '%')
       AND (q.cat IS NULL OR cat.slug = q.cat OR cat.name ILIKE q.cat)
       AND (p_max_moq IS NULL OR pr.moq IS NULL OR pr.moq <= p_max_moq)
  ),
  agg AS (
    SELECT company_id,
           jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug, 'moq', moq, 'moq_unit', moq_unit,
                     'price_min', price_min, 'price_max', price_max, 'currency', price_currency, 'image', image, 'category', category)
                     ORDER BY moq NULLS LAST) AS items,
           count(*)::int AS n,
           min(moq)::numeric AS min_moq,
           (array_agg(moq_unit ORDER BY moq NULLS LAST))[1] AS unit
      FROM prods
     GROUP BY company_id
  ),
  matched AS (
    SELECT b.*, a.items, a.n, a.min_moq, a.unit
      FROM base b
      JOIN agg a ON a.company_id = b.id
    UNION ALL
    -- a search for the company's name or its listed key products also counts
    SELECT b.*, '[]'::jsonb, 0, NULL::numeric, NULL::text
      FROM base b, q
     WHERE q.term IS NOT NULL AND q.cat IS NULL AND p_max_moq IS NULL
       AND NOT EXISTS (SELECT 1 FROM agg a WHERE a.company_id = b.id)
       AND (b.company_name ILIKE '%' || q.term || '%' OR array_to_string(b.key_products, ' ') ILIKE '%' || q.term || '%')
  ),
  ranged AS (
    SELECT * FROM matched WHERE p_radius_km IS NULL OR dist IS NULL OR dist <= p_radius_km
  )
  SELECT r.id, r.company_name, r.slug, r.business_type, r.city, r.state, r.country, r.latitude, r.longitude, round(r.dist::numeric, 1)::double precision,
         r.rating_avg, r.review_count, r.logo_url, r.cover_url, r.gst_verified, r.cin_verified, r.udyam_verified, r.registry_verified, r.decided_at,
         (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(r.items) e LIMIT 6) s),
         r.n, r.min_moq, r.unit, r.monthly_capacity, r.capacity_unit, r.lead_time_days, r.stock_status, r.supply_type,
         r.availability_updated_at, count(*) OVER ()
    FROM ranged r, q
   ORDER BY r.dist NULLS LAST, r.rating_avg DESC NULLS LAST, r.company_name
   LIMIT (SELECT lim FROM q) OFFSET (SELECT off FROM q);
$$;

-- ── One supplier's card (same display rules) ──
CREATE OR REPLACE FUNCTION public.map_supplier_detail(p_company_id uuid, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'company_id', c.id, 'company_name', c.company_name, 'slug', c.slug, 'business_type', c.business_type,
    'description', c.description, 'year_established', c.year_established, 'logo_url', c.logo_url,
    'cover_url', c.cover_url, 'banner_url', c.banner_url, 'gallery_images', COALESCE(to_jsonb(c.gallery_images), '[]'::jsonb),
    'rating', c.rating_avg, 'review_count', c.review_count,
    'production_capacity_text', c.production_capacity,
    'city', fl.city, 'state', fl.state, 'country', fl.country, 'factory_address', fl.address,
    'latitude', fl.latitude, 'longitude', fl.longitude,
    'distance_km', CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL ELSE round(public.km_between(p_lat, p_lng, fl.latitude, fl.longitude)::numeric, 1) END,
    'monthly_capacity', fl.monthly_capacity, 'capacity_unit', fl.capacity_unit, 'lead_time_days', fl.lead_time_days,
    'stock_status', fl.stock_status, 'supply_type', fl.supply_type, 'availability_updated_at', fl.availability_updated_at,
    'gst_verified', bv.gst_verified, 'cin_verified', bv.cin_verified, 'udyam_verified', bv.udyam_verified,
    'registry_verified', bv.registry_verified, 'registration_country', bv.registration_country,
    'entity_type', bv.entity_type, 'verified_since', bv.decided_at,
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'slug', pr.slug, 'moq', pr.moq, 'moq_unit', pr.moq_unit,
               'price_min', pr.price_min, 'price_max', pr.price_max, 'currency', pr.price_currency, 'image', (pr.images)[1])
               ORDER BY pr.updated_at DESC NULLS LAST)
        FROM (SELECT * FROM public.products WHERE company_id = c.id AND is_active ORDER BY updated_at DESC NULLS LAST LIMIT 12) pr
    ), '[]'::jsonb)
  )
    FROM public.map_visible_company_ids() v
    JOIN public.companies c ON c.id = v.company_id
    JOIN public.factory_locations fl ON fl.company_id = c.id
    JOIN public.business_verifications bv ON bv.company_id = c.id
   WHERE c.id = p_company_id;
$$;

-- ── Format checks (the same rules as the website) ──
CREATE OR REPLACE FUNCTION public.valid_gstin(v text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v ~ '^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$';
$$;
CREATE OR REPLACE FUNCTION public.valid_cin(v text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v ~ '^[LU][0-9]{5}[A-Z]{2}[0-9]{4}(PLC|PTC|GOI|SGC|FTC|GAP|GAT|NPL|ULL|ULT|OPC|FLC)[0-9]{6}$';
$$;
CREATE OR REPLACE FUNCTION public.valid_llpin(v text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v ~ '^(AA[A-Z]-[0-9]{4}|FLLP-[0-9]{4})$';
$$;
CREATE OR REPLACE FUNCTION public.valid_udyam(v text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v ~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$';
$$;

-- the caller's own company (suppliers have one)
CREATE OR REPLACE FUNCTION public.my_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.companies WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1;
$$;

-- ── Manufacturer: submit or update the registration application ──
CREATE OR REPLACE FUNCTION public.supplier_submit_business_verification(p jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.my_company_id();
  v_type text := p->>'entity_type';
  v_cin text := NULLIF(upper(btrim(COALESCE(p->>'cin_llpin', ''))), '');
  v_gst text := NULLIF(upper(btrim(COALESCE(p->>'gstin', ''))), '');
  v_udyam text := NULLIF(upper(btrim(COALESCE(p->>'udyam_number', ''))), '');
  v_reg_country text := NULLIF(btrim(COALESCE(p->>'registration_country', '')), '');
  v_reg_number text := NULLIF(upper(btrim(COALESCE(p->>'registration_number', ''))), '');
  v_old public.business_verifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF v_company IS NULL THEN RAISE EXCEPTION 'company_required' USING ERRCODE = '42501'; END IF;
  IF v_type IS NULL OR v_type NOT IN ('private_limited', 'public_limited', 'llp', 'partnership', 'proprietorship', 'other', 'foreign_company') THEN
    RAISE EXCEPTION 'invalid_entity_type' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(btrim(p->>'legal_name'), '') = '' OR COALESCE(btrim(p->>'registered_address'), '') = '' OR COALESCE(btrim(p->>'factory_address'), '') = ''
     OR COALESCE(btrim(p->>'contact_name'), '') = '' OR COALESCE(btrim(p->>'contact_phone'), '') = '' OR COALESCE(btrim(p->>'contact_email'), '') = '' THEN
    RAISE EXCEPTION 'missing_details' USING ERRCODE = '22023';
  END IF;
  -- registered outside India: the country and its registry number (Indian numbers do not apply)
  IF v_type = 'foreign_company' THEN
    IF v_reg_country IS NULL OR lower(v_reg_country) = 'india' THEN
      RAISE EXCEPTION 'registration_country_required' USING ERRCODE = '22023';
    END IF;
    IF v_reg_number IS NULL OR v_reg_number !~ '^[A-Z0-9][A-Z0-9 ./-]{2,49}$' THEN
      RAISE EXCEPTION 'registration_number_required' USING ERRCODE = '22023';
    END IF;
    v_cin := NULL; v_gst := NULL; v_udyam := NULL;
  ELSE
    v_reg_country := NULL; v_reg_number := NULL;
  END IF;
  -- companies need their CIN, LLPs their LLPIN; other Indian businesses need a GSTIN or Udyam number
  IF v_type IN ('private_limited', 'public_limited') AND (v_cin IS NULL OR NOT public.valid_cin(v_cin)) THEN
    RAISE EXCEPTION 'cin_required' USING ERRCODE = '22023';
  END IF;
  IF v_type = 'llp' AND (v_cin IS NULL OR NOT public.valid_llpin(v_cin)) THEN
    RAISE EXCEPTION 'llpin_required' USING ERRCODE = '22023';
  END IF;
  IF v_gst IS NOT NULL AND NOT public.valid_gstin(v_gst) THEN RAISE EXCEPTION 'invalid_gstin' USING ERRCODE = '22023'; END IF;
  IF v_udyam IS NOT NULL AND NOT public.valid_udyam(v_udyam) THEN RAISE EXCEPTION 'invalid_udyam' USING ERRCODE = '22023'; END IF;
  IF v_type NOT IN ('private_limited', 'public_limited', 'llp', 'foreign_company') AND v_gst IS NULL AND v_udyam IS NULL THEN
    RAISE EXCEPTION 'gst_or_udyam_required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p->'documents', '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p->'documents', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'documents_required' USING ERRCODE = '22023';
  END IF;
  -- documents must be in the caller's own folder of the private bucket
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'documents') d WHERE split_part(d->>'path', '/', 1) <> auth.uid()::text) THEN
    RAISE EXCEPTION 'invalid_document_path' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.business_verifications WHERE company_id = v_company;
  IF FOUND AND v_old.status = 'suspended' THEN
    RAISE EXCEPTION 'suspended_contact_support' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.business_verifications AS bv (
    company_id, entity_type, legal_name, cin_llpin, gstin, udyam_number, registration_country, registration_number,
    registered_address, factory_address, contact_name, contact_phone, contact_email, documents, status,
    gst_verified, cin_verified, udyam_verified, registry_verified,
    decision_note, submitted_by, submitted_at, decided_by, decided_at, updated_at)
  VALUES (v_company, v_type, btrim(p->>'legal_name'), v_cin, v_gst, v_udyam, v_reg_country, v_reg_number,
    btrim(p->>'registered_address'), btrim(p->>'factory_address'),
    btrim(p->>'contact_name'), btrim(p->>'contact_phone'), lower(btrim(p->>'contact_email')), p->'documents', 'pending',
    false, false, false, false,
    NULL, auth.uid(), now(), NULL, NULL, now())
  ON CONFLICT (company_id) DO UPDATE SET
    entity_type = EXCLUDED.entity_type, legal_name = EXCLUDED.legal_name, cin_llpin = EXCLUDED.cin_llpin, gstin = EXCLUDED.gstin,
    udyam_number = EXCLUDED.udyam_number, registration_country = EXCLUDED.registration_country, registration_number = EXCLUDED.registration_number,
    registered_address = EXCLUDED.registered_address, factory_address = EXCLUDED.factory_address,
    contact_name = EXCLUDED.contact_name, contact_phone = EXCLUDED.contact_phone, contact_email = EXCLUDED.contact_email,
    documents = EXCLUDED.documents,
    -- any change is reviewed again: an approved business goes back to pending (and off the map) until re-approved
    status = 'pending', gst_verified = false, cin_verified = false, udyam_verified = false, registry_verified = false,
    submitted_by = EXCLUDED.submitted_by, submitted_at = now(), updated_at = now();

  UPDATE public.companies SET verification_status = 'pending' WHERE id = v_company AND verification_status IN ('unverified', 'rejected');
  RETURN 'pending';
END;
$$;

-- ── Manufacturer: pin the registered factory location (reviewed again on every change) ──
CREATE OR REPLACE FUNCTION public.supplier_save_factory_location(
  p_lat double precision, p_lng double precision, p_address text, p_city text DEFAULT NULL, p_state text DEFAULT NULL,
  p_country text DEFAULT 'India', p_pincode text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.my_company_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF v_company IS NULL THEN RAISE EXCEPTION 'company_required' USING ERRCODE = '42501'; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(btrim(p_address), '') = '' THEN RAISE EXCEPTION 'address_required' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.factory_locations AS fl (company_id, latitude, longitude, address, city, state, country, pincode, status, updated_at)
  VALUES (v_company, p_lat, p_lng, btrim(p_address), NULLIF(btrim(p_city), ''), NULLIF(btrim(p_state), ''), COALESCE(NULLIF(btrim(p_country), ''), 'India'), NULLIF(btrim(p_pincode), ''), 'pending', now())
  ON CONFLICT (company_id) DO UPDATE SET
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, address = EXCLUDED.address, city = EXCLUDED.city,
    state = EXCLUDED.state, country = EXCLUDED.country, pincode = EXCLUDED.pincode,
    status = CASE WHEN fl.latitude = EXCLUDED.latitude AND fl.longitude = EXCLUDED.longitude AND fl.address = EXCLUDED.address
                  THEN fl.status ELSE 'pending' END,
    review_note = CASE WHEN fl.latitude = EXCLUDED.latitude AND fl.longitude = EXCLUDED.longitude AND fl.address = EXCLUDED.address
                  THEN fl.review_note ELSE NULL END,
    updated_at = now();
  RETURN (SELECT status FROM public.factory_locations WHERE company_id = v_company);
END;
$$;

-- ── Manufacturer: availability (no review needed; shown with its date) ──
CREATE OR REPLACE FUNCTION public.supplier_update_availability(
  p_monthly_capacity numeric, p_capacity_unit text, p_lead_time_days integer, p_stock_status text, p_supply_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.my_company_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.factory_locations
     SET monthly_capacity = p_monthly_capacity, capacity_unit = NULLIF(btrim(p_capacity_unit), ''),
         lead_time_days = p_lead_time_days, stock_status = NULLIF(p_stock_status, ''), supply_type = NULLIF(p_supply_type, ''),
         availability_updated_at = now(), updated_at = now()
   WHERE company_id = v_company;
  IF NOT FOUND THEN RAISE EXCEPTION 'location_first' USING ERRCODE = 'P0002'; END IF;
END;
$$;

-- ── Manufacturer: what is still missing before the company shows on the map ──
CREATE OR REPLACE FUNCTION public.supplier_map_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT public.my_company_id() AS id)
  SELECT jsonb_build_object(
    'company_id', me.id,
    'company_verification', c.verification_status,
    'blocked', COALESCE(c.is_blocked, false),
    'business', (SELECT to_jsonb(bv) FROM public.business_verifications bv WHERE bv.company_id = me.id),
    'location', (SELECT to_jsonb(fl) FROM public.factory_locations fl WHERE fl.company_id = me.id),
    'active_products', (SELECT count(*) FROM public.products pr WHERE pr.company_id = me.id AND pr.is_active),
    'account_active', EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active' AND p.role = 'supplier'),
    'on_map', EXISTS (SELECT 1 FROM public.map_visible_company_ids() v WHERE v.company_id = me.id)
  )
    FROM me LEFT JOIN public.companies c ON c.id = me.id;
$$;

-- ── Admin: applications, decisions, locations, history ──
DROP FUNCTION IF EXISTS public.admin_list_business_verifications(text);
CREATE FUNCTION public.admin_list_business_verifications(p_status text DEFAULT 'pending')
RETURNS TABLE (
  company_id uuid, company_name text, owner_email text, entity_type text, legal_name text, cin_llpin text, gstin text,
  udyam_number text, registration_country text, registration_number text, registered_address text, factory_address text, contact_name text, contact_phone text, contact_email text,
  documents jsonb, status text, gst_verified boolean, cin_verified boolean, udyam_verified boolean, registry_verified boolean, decision_note text,
  submitted_at timestamptz, decided_at timestamptz, recheck_due_at timestamptz,
  location jsonb, active_products bigint, on_map boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT bv.company_id, c.company_name::text, p.email::text, bv.entity_type, bv.legal_name, bv.cin_llpin, bv.gstin, bv.udyam_number,
           bv.registration_country, bv.registration_number,
           bv.registered_address, bv.factory_address, bv.contact_name, bv.contact_phone, bv.contact_email, bv.documents, bv.status,
           bv.gst_verified, bv.cin_verified, bv.udyam_verified, bv.registry_verified, bv.decision_note, bv.submitted_at, bv.decided_at, bv.recheck_due_at,
           (SELECT to_jsonb(fl) FROM public.factory_locations fl WHERE fl.company_id = bv.company_id),
           (SELECT count(*) FROM public.products pr WHERE pr.company_id = bv.company_id AND pr.is_active),
           EXISTS (SELECT 1 FROM public.map_visible_company_ids() v WHERE v.company_id = bv.company_id)
      FROM public.business_verifications bv
      JOIN public.companies c ON c.id = bv.company_id
      LEFT JOIN public.profiles p ON p.id = c.owner_id
     WHERE p_status IS NULL OR p_status = 'all' OR bv.status = p_status
        OR (p_status = 'locations' AND EXISTS (SELECT 1 FROM public.factory_locations fl WHERE fl.company_id = bv.company_id AND fl.status = 'pending'))
        -- approvals whose yearly recheck is due within 30 days or overdue
        OR (p_status = 'recheck_due' AND bv.status = 'approved' AND bv.recheck_due_at < now() + interval '30 days')
     ORDER BY bv.submitted_at DESC
     LIMIT 200;
END;
$$;

-- p_decision: approve | reject | needs_info | suspend | recheck
-- (the earlier signature, without p_registry_verified, is replaced)
DROP FUNCTION IF EXISTS public.admin_decide_business_verification(uuid, text, text, boolean, boolean, boolean);
CREATE OR REPLACE FUNCTION public.admin_decide_business_verification(
  p_company uuid, p_decision text, p_note text DEFAULT NULL,
  p_gst_verified boolean DEFAULT NULL, p_cin_verified boolean DEFAULT NULL, p_udyam_verified boolean DEFAULT NULL,
  p_registry_verified boolean DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.business_verifications;
  v_gst boolean; v_cin boolean; v_udyam boolean; v_reg boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.business_verifications WHERE company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002'; END IF;
  v_gst := COALESCE(p_gst_verified, v.gst_verified) AND v.gstin IS NOT NULL;
  v_cin := COALESCE(p_cin_verified, v.cin_verified) AND v.cin_llpin IS NOT NULL;
  v_udyam := COALESCE(p_udyam_verified, v.udyam_verified) AND v.udyam_number IS NOT NULL;
  v_reg := COALESCE(p_registry_verified, v.registry_verified) AND v.registration_number IS NOT NULL;

  IF p_decision = 'approve' THEN
    -- a company or LLP is approved only with its CIN/LLPIN checked (a GSTIN does not prove incorporation);
    -- a business registered abroad only with its registration checked in that country's registry;
    -- other Indian businesses need a checked GSTIN or Udyam registration
    IF v.entity_type IN ('private_limited', 'public_limited', 'llp') AND NOT v_cin THEN
      RAISE EXCEPTION 'cin_not_verified' USING ERRCODE = '22023';
    END IF;
    IF v.entity_type = 'foreign_company' AND NOT v_reg THEN
      RAISE EXCEPTION 'registry_not_verified' USING ERRCODE = '22023';
    END IF;
    IF v.entity_type NOT IN ('private_limited', 'public_limited', 'llp', 'foreign_company') AND NOT (v_gst OR v_udyam) THEN
      RAISE EXCEPTION 'registration_not_verified' USING ERRCODE = '22023';
    END IF;
    UPDATE public.business_verifications SET status = 'approved', gst_verified = v_gst, cin_verified = v_cin, udyam_verified = v_udyam,
           registry_verified = v_reg,
           decision_note = p_note, decided_by = auth.uid(), decided_at = now(), recheck_due_at = now() + interval '1 year', updated_at = now()
     WHERE company_id = p_company;
    UPDATE public.companies SET verification_status = 'verified', is_verified = true, verified_at = now(), verified_by = auth.uid(),
           verification_expiry_at = now() + interval '1 year', rejection_reason = NULL
     WHERE id = p_company;
  ELSIF p_decision IN ('reject', 'needs_info', 'suspend') THEN
    IF COALESCE(btrim(p_note), '') = '' THEN RAISE EXCEPTION 'note_required' USING ERRCODE = '22023'; END IF;
    UPDATE public.business_verifications
       SET status = CASE p_decision WHEN 'reject' THEN 'rejected' WHEN 'needs_info' THEN 'needs_info' ELSE 'suspended' END,
           gst_verified = v_gst, cin_verified = v_cin, udyam_verified = v_udyam, registry_verified = v_reg,
           decision_note = p_note, decided_by = auth.uid(), decided_at = now(), updated_at = now()
     WHERE company_id = p_company;
    IF p_decision IN ('reject', 'suspend') THEN
      UPDATE public.companies SET verification_status = 'rejected', is_verified = false,
             rejection_reason = CASE p_decision WHEN 'suspend' THEN 'Suspended: ' || p_note ELSE p_note END
       WHERE id = p_company;
    END IF;
  ELSIF p_decision = 'recheck' THEN
    -- back to review: off the map until approved again
    UPDATE public.business_verifications SET status = 'pending', decision_note = p_note, decided_by = auth.uid(), decided_at = now(), updated_at = now()
     WHERE company_id = p_company;
    UPDATE public.companies SET verification_status = 'pending' WHERE id = p_company;
  ELSE
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;
  RETURN (SELECT status FROM public.business_verifications WHERE company_id = p_company);
END;
$$;

-- p_decision: verify | reject
CREATE OR REPLACE FUNCTION public.admin_decide_factory_location(p_company uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501'; END IF;
  IF p_decision NOT IN ('verify', 'reject') THEN RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023'; END IF;
  IF p_decision = 'reject' AND COALESCE(btrim(p_note), '') = '' THEN RAISE EXCEPTION 'note_required' USING ERRCODE = '22023'; END IF;
  UPDATE public.factory_locations
     SET status = CASE p_decision WHEN 'verify' THEN 'verified' ELSE 'rejected' END,
         review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   WHERE company_id = p_company;
  IF NOT FOUND THEN RAISE EXCEPTION 'location_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN (SELECT status FROM public.factory_locations WHERE company_id = p_company);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verification_history(p_company uuid DEFAULT NULL)
RETURNS TABLE (created_at timestamptz, company_name text, actor_email text, subject text, action text, from_status text, to_status text, note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT l.created_at, c.company_name::text, p.email::text, l.subject, l.action, l.from_status, l.to_status, l.note
      FROM public.verification_audit_log l
      LEFT JOIN public.companies c ON c.id = l.company_id
      LEFT JOIN public.profiles p ON p.id = l.actor
     WHERE p_company IS NULL OR l.company_id = p_company
     ORDER BY l.created_at DESC
     LIMIT 200;
END;
$$;

-- ── Who may call what ──
REVOKE ALL ON FUNCTION public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.map_supplier_detail(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_supplier_detail(uuid, double precision, double precision) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.supplier_submit_business_verification(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supplier_save_factory_location(double precision, double precision, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supplier_update_availability(numeric, text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supplier_map_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_business_verifications(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decide_business_verification(uuid, text, text, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decide_factory_location(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_verification_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_submit_business_verification(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supplier_save_factory_location(double precision, double precision, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supplier_update_availability(numeric, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supplier_map_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_business_verifications(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_decide_business_verification(uuid, text, text, boolean, boolean, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_decide_factory_location(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_verification_history(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_company_id() TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
