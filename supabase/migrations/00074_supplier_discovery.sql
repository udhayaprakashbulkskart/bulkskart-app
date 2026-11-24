-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 00074: Supplier & product discovery engine
--
-- Real manufacturers and products are found on public business websites (via a permitted search API or URLs an
-- admin gives). Each record keeps the page it came from and its evidence. Only records that pass the verification
-- rules are published, in a separate public directory.
--
-- Everything internal lives in the schema `discovery`, which the website's API does not expose:
--   discovery.suppliers, supplier_verification, products, product_sources, verification_logs, discovery_jobs,
--   plus settings (the publishing rules), suppressions (removal requests) and gst_states (official state codes).
-- Access is only through the functions at the end:
--   * discovery_worker_*   the scheduled worker (service role only)
--   * admin_discovery_*    the admin dashboard (admins only)
--   * directory_*          the public directory: published, verified records, without contacts or source links
--
-- Verification ("verified") always needs an ACTIVE GST registration, confirmed by an authorised source: a GST
-- Suvidha Provider API, or an admin who checked the official GST portal. A search listing alone never verifies.
--
-- Contains no business records. Safe to run again.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS discovery;
REVOKE ALL ON SCHEMA discovery FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON SCHEMA discovery FROM %I', r); END IF;
  END LOOP;
END $$;

-- ── Reference: official GST state codes (first two digits of a GSTIN) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery.gst_states (code text PRIMARY KEY, name text NOT NULL);
INSERT INTO discovery.gst_states (code, name) VALUES
  ('01', 'Jammu and Kashmir'), ('02', 'Himachal Pradesh'), ('03', 'Punjab'), ('04', 'Chandigarh'), ('05', 'Uttarakhand'),
  ('06', 'Haryana'), ('07', 'Delhi'), ('08', 'Rajasthan'), ('09', 'Uttar Pradesh'), ('10', 'Bihar'), ('11', 'Sikkim'),
  ('12', 'Arunachal Pradesh'), ('13', 'Nagaland'), ('14', 'Manipur'), ('15', 'Mizoram'), ('16', 'Tripura'), ('17', 'Meghalaya'),
  ('18', 'Assam'), ('19', 'West Bengal'), ('20', 'Jharkhand'), ('21', 'Odisha'), ('22', 'Chhattisgarh'), ('23', 'Madhya Pradesh'),
  ('24', 'Gujarat'), ('25', 'Daman and Diu'), ('26', 'Dadra and Nagar Haveli and Daman and Diu'), ('27', 'Maharashtra'),
  ('28', 'Andhra Pradesh'), ('29', 'Karnataka'), ('30', 'Goa'), ('31', 'Lakshadweep'), ('32', 'Kerala'), ('33', 'Tamil Nadu'),
  ('34', 'Puducherry'), ('35', 'Andaman and Nicobar Islands'), ('36', 'Telangana'), ('37', 'Andhra Pradesh'), ('38', 'Ladakh')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION discovery.norm_text(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(replace(coalesce(t, ''), '&', ' and ')), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- a company name without legal suffixes and filler words, for matching ("M/s ABC Polymers Pvt. Ltd." -> "abc polymers")
CREATE OR REPLACE FUNCTION discovery.norm_name(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(regexp_replace(discovery.norm_text(t), '^m s ', ''),
      '\m(private|pvt|limited|ltd|llp|inc|incorporated|company|corporation|corp|co|the|and)\M', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION discovery.norm_state(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE x WHEN 'orissa' THEN 'odisha' WHEN 'pondicherry' THEN 'puducherry' WHEN 'uttaranchal' THEN 'uttarakhand'
                WHEN 'new delhi' THEN 'delhi' WHEN 'nct of delhi' THEN 'delhi' WHEN 'j and k' THEN 'jammu and kashmir' ELSE x END
  FROM (SELECT discovery.norm_text(t) AS x) s;
$$;

-- "https://www.Example.co.in/about?x" -> "example.co.in"
CREATE OR REPLACE FUNCTION discovery.host_of(url text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(regexp_replace(lower(substring(coalesce(url, '') from '^[A-Za-z][A-Za-z0-9+.-]*://([^/:?#@]+)')), '^www\.', ''), '');
$$;

-- share of the shorter name's words found in the other name (0..1)
CREATE OR REPLACE FUNCTION discovery.name_match(a text, b text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  WITH x AS (
    SELECT ARRAY(SELECT DISTINCT w FROM unnest(string_to_array(discovery.norm_name(a), ' ')) w WHERE length(w) > 1) AS ta,
           ARRAY(SELECT DISTINCT w FROM unnest(string_to_array(discovery.norm_name(b), ' ')) w WHERE length(w) > 1) AS tb)
  SELECT CASE WHEN cardinality(ta) = 0 OR cardinality(tb) = 0 THEN 0::numeric
              ELSE round((SELECT count(*) FROM unnest(ta) w WHERE w = ANY (tb))::numeric / least(cardinality(ta), cardinality(tb)), 2) END
  FROM x;
$$;

-- a GSTIN of the right shape whose 15th character is the correct check character
CREATE OR REPLACE FUNCTION discovery.gstin_ok(g text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; total int := 0; p int; i int;
BEGIN
  IF g IS NULL OR g !~ '^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN RETURN false; END IF;
  FOR i IN 1..14 LOOP
    p := (position(substr(g, i, 1) IN alphabet) - 1) * (CASE WHEN i % 2 = 1 THEN 1 ELSE 2 END);
    total := total + p / 36 + p % 36;
  END LOOP;
  RETURN substr(g, 15, 1) = substr(alphabet, ((36 - total % 36) % 36) + 1, 1);
END $$;

CREATE OR REPLACE FUNCTION discovery.touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- ── Tables ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery.settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_publish boolean NOT NULL DEFAULT true,               -- publish suppliers the moment they pass every rule
  require_name_match boolean NOT NULL DEFAULT true,         -- website name must match the GST legal or trade name
  require_state_match boolean NOT NULL DEFAULT true,        -- website address state must match the GSTIN's state
  min_published_products integer NOT NULL DEFAULT 1 CHECK (min_published_products BETWEEN 0 AND 50),
  publish_product_images boolean NOT NULL DEFAULT false,    -- product photos belong to the company; off until permitted
  recheck_days integer NOT NULL DEFAULT 30 CHECK (recheck_days BETWEEN 1 AND 365),
  gst_recheck_days integer NOT NULL DEFAULT 90 CHECK (gst_recheck_days BETWEEN 1 AND 365),
  max_pages_per_site integer NOT NULL DEFAULT 25 CHECK (max_pages_per_site BETWEEN 3 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO discovery.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS discovery.discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('search', 'seed_urls')),
  query text,
  location text,
  category_slug text,
  seed_urls text[] NOT NULL DEFAULT '{}',
  max_results integer NOT NULL DEFAULT 20 CHECK (max_results BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  source_type text,                                         -- search provider used, or 'seed_urls'
  requested_by uuid,
  attempts integer NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_jobs_search_query CHECK (kind <> 'search' OR coalesce(btrim(query), '') <> ''),
  CONSTRAINT discovery_jobs_seed_urls CHECK (kind <> 'seed_urls' OR cardinality(seed_urls) BETWEEN 1 AND 50)
);
CREATE INDEX IF NOT EXISTS discovery_jobs_status_idx ON discovery.discovery_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS discovery.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_host text NOT NULL UNIQUE,                        -- the company's own site, e.g. example.co.in
  website_url text NOT NULL,
  name_on_site text NOT NULL,
  normalized_name text NOT NULL,
  gstin text UNIQUE CHECK (gstin IS NULL OR discovery.gstin_ok(gstin)),
  gst_legal_name text,                                      -- from the latest successful GST check
  gst_trade_name text,
  gst_status text,
  gst_state text,
  gst_registered_on date,
  address text,
  city text,
  state text,
  pincode text CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$'),
  country text NOT NULL DEFAULT 'India',
  public_phones text[] NOT NULL DEFAULT '{}',               -- as published on the website; admin-only, never public
  public_emails text[] NOT NULL DEFAULT '{}',
  category_slugs text[] NOT NULL DEFAULT '{}',
  source_url text NOT NULL,                                 -- the page the company was found on
  source_type text NOT NULL DEFAULT 'official_website' CHECK (source_type IN ('official_website', 'manufacturer_directory')),
  found_via text,                                           -- 'search:brave', 'search:google_cse', 'seed_url'
  discovered_by_job uuid REFERENCES discovery.discovery_jobs(id) ON DELETE SET NULL,
  verification_status text NOT NULL DEFAULT 'discovered'
    CHECK (verification_status IN ('discovered', 'needs_review', 'verified', 'rejected', 'suspended')),
  status_reason text,
  status_set_by text NOT NULL DEFAULT 'system' CHECK (status_set_by IN ('system', 'admin')),
  publish_status text NOT NULL DEFAULT 'internal' CHECK (publish_status IN ('internal', 'published', 'withheld')),
  published_at timestamptz,
  duplicate_of uuid REFERENCES discovery.suppliers(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_fetched_at timestamptz,
  last_verified_at timestamptz,
  next_recheck_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_published_is_verified CHECK (publish_status <> 'published' OR verification_status = 'verified')
);
CREATE INDEX IF NOT EXISTS discovery_suppliers_status_idx ON discovery.suppliers (verification_status, publish_status);
CREATE INDEX IF NOT EXISTS discovery_suppliers_name_idx ON discovery.suppliers (normalized_name);
CREATE INDEX IF NOT EXISTS discovery_suppliers_recheck_idx ON discovery.suppliers (next_recheck_at);

CREATE TABLE IF NOT EXISTS discovery.supplier_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES discovery.suppliers(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('gst_api', 'gst_portal_manual')),
  provider text,
  gstin text NOT NULL,
  result text NOT NULL CHECK (result IN ('found', 'not_found', 'error', 'not_configured')),
  gst_status text,
  legal_name text,
  trade_name text,
  registered_state text,
  registered_pincode text,
  registered_on date,
  cancelled_on date,
  name_score numeric,                                       -- worked out by the database when the check is saved
  state_match boolean,
  pincode_match boolean,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_by uuid,                                          -- the admin, for a portal check; null for the API
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discovery_verification_supplier_idx ON discovery.supplier_verification (supplier_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS discovery.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES discovery.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  category_slug text,
  manufacturer text,
  description_source text,                                  -- the text as found on the page
  description text,                                         -- what is shown: the source text, or a rewrite of it
  description_generated boolean NOT NULL DEFAULT false,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(specifications) = 'object'),
  image_source_url text,
  price_text text,                                          -- only words printed on the page; never worked out
  moq_text text,
  source_url text NOT NULL UNIQUE,
  source_type text NOT NULL DEFAULT 'official_website' CHECK (source_type IN ('official_website', 'manufacturer_directory')),
  verification_status text NOT NULL DEFAULT 'discovered'
    CHECK (verification_status IN ('discovered', 'needs_review', 'verified', 'rejected', 'suspended')),
  status_reason text,
  status_set_by text NOT NULL DEFAULT 'system' CHECK (status_set_by IN ('system', 'admin')),
  publish_status text NOT NULL DEFAULT 'internal' CHECK (publish_status IN ('internal', 'published', 'withheld')),
  published_at timestamptz,
  duplicate_of uuid REFERENCES discovery.products(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_fetched_at timestamptz,
  last_verified_at timestamptz,
  next_recheck_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, normalized_name),
  CONSTRAINT products_published_is_verified CHECK (publish_status <> 'published' OR verification_status = 'verified')
);
CREATE INDEX IF NOT EXISTS discovery_products_status_idx ON discovery.products (verification_status, publish_status);

CREATE TABLE IF NOT EXISTS discovery.product_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES discovery.products(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'official_website',
  http_status integer,
  content_hash text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, source_url)
);

CREATE TABLE IF NOT EXISTS discovery.verification_logs (
  id bigserial PRIMARY KEY,
  entity text NOT NULL CHECK (entity IN ('supplier', 'product', 'job', 'settings')),
  entity_id uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,                                               -- the admin; null when the worker or a rule acted
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discovery_logs_entity_idx ON discovery.verification_logs (entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS discovery_logs_action_idx ON discovery.verification_logs (action, created_at DESC);

-- a company that asked not to be listed: never stored, crawled or published again
CREATE TABLE IF NOT EXISTS discovery.suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('domain', 'gstin')),
  value text NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

DROP TRIGGER IF EXISTS trg_touch ON discovery.discovery_jobs;
CREATE TRIGGER trg_touch BEFORE UPDATE ON discovery.discovery_jobs FOR EACH ROW EXECUTE FUNCTION discovery.touch();
DROP TRIGGER IF EXISTS trg_touch ON discovery.suppliers;
CREATE TRIGGER trg_touch BEFORE UPDATE ON discovery.suppliers FOR EACH ROW EXECUTE FUNCTION discovery.touch();
DROP TRIGGER IF EXISTS trg_touch ON discovery.products;
CREATE TRIGGER trg_touch BEFORE UPDATE ON discovery.products FOR EACH ROW EXECUTE FUNCTION discovery.touch();

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA discovery FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA discovery FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA discovery FROM %I', r);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA discovery FROM PUBLIC;

-- ── Logging ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION discovery.log(p_entity text, p_id uuid, p_action text, p_from text, p_to text, p_detail jsonb, p_actor uuid)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO discovery.verification_logs (entity, entity_id, action, from_status, to_status, detail, actor)
  VALUES (p_entity, p_id, p_action, p_from, p_to, coalesce(p_detail, '{}'::jsonb), p_actor);
$$;

-- ── GST check: work out name/state/pincode agreement when a check is saved ─────────────────────────────────
CREATE OR REPLACE FUNCTION discovery.verification_fill() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s discovery.suppliers%ROWTYPE; reg_state text;
BEGIN
  SELECT * INTO s FROM discovery.suppliers WHERE id = NEW.supplier_id;
  NEW.gstin := upper(btrim(NEW.gstin));
  IF NEW.result = 'found' THEN
    NEW.name_score := greatest(discovery.name_match(NEW.legal_name, s.name_on_site), discovery.name_match(NEW.trade_name, s.name_on_site));
    reg_state := coalesce(nullif(btrim(NEW.registered_state), ''), (SELECT name FROM discovery.gst_states WHERE code = left(NEW.gstin, 2)));
    NEW.registered_state := reg_state;
    NEW.state_match := CASE WHEN s.state IS NULL OR reg_state IS NULL THEN NULL
                            ELSE discovery.norm_state(s.state) = discovery.norm_state(reg_state)
                              -- Andhra Pradesh has two codes; Dadra/Daman were merged
                              OR (discovery.norm_state(reg_state) LIKE '%' || discovery.norm_state(s.state) || '%' AND length(discovery.norm_state(s.state)) > 3) END;
    NEW.pincode_match := CASE WHEN s.pincode IS NULL OR NEW.registered_pincode IS NULL THEN NULL ELSE s.pincode = btrim(NEW.registered_pincode) END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_verification_fill ON discovery.supplier_verification;
CREATE TRIGGER trg_verification_fill BEFORE INSERT ON discovery.supplier_verification FOR EACH ROW EXECUTE FUNCTION discovery.verification_fill();

-- ── The rules: what a supplier and its products are, and whether they are published ─────────────────────────
CREATE OR REPLACE FUNCTION discovery.evaluate_supplier(p_id uuid, p_actor uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  cfg discovery.settings%ROWTYPE;
  s discovery.suppliers%ROWTYPE;
  v discovery.supplier_verification%ROWTYPE;
  has_check boolean := false;
  st text; why text; pub text; pub_at timestamptz; verified_at timestamptz; ok_products int;
BEGIN
  SELECT * INTO cfg FROM discovery.settings WHERE id = 1;
  SELECT * INTO s FROM discovery.suppliers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  st := s.verification_status; why := s.status_reason; verified_at := s.last_verified_at;

  IF s.gstin IS NOT NULL THEN
    SELECT * INTO v FROM discovery.supplier_verification WHERE supplier_id = s.id AND gstin = s.gstin ORDER BY checked_at DESC LIMIT 1;
    has_check := FOUND;
  END IF;

  IF s.status_set_by = 'admin' AND s.verification_status IN ('rejected', 'suspended') THEN
    NULL;                                                   -- an admin's decision stands until an admin restores it
  ELSIF s.duplicate_of IS NOT NULL THEN
    st := 'rejected'; why := 'Duplicate of another supplier record';
  ELSIF EXISTS (SELECT 1 FROM discovery.suppressions x WHERE (x.kind = 'domain' AND x.value = s.website_host) OR (x.kind = 'gstin' AND x.value = s.gstin)) THEN
    st := 'rejected'; why := 'The company asked not to be listed';
  ELSIF s.status_set_by = 'system' AND s.verification_status = 'suspended' AND s.consecutive_failures > 0 THEN
    NULL;                                                   -- website down: stays suspended until a recheck succeeds
  ELSIF s.gstin IS NULL THEN
    st := CASE WHEN s.verification_status = 'verified' THEN 'suspended' ELSE 'needs_review' END;
    why := 'No valid GSTIN is published on the company website';
  ELSIF NOT has_check OR v.result = 'not_configured' THEN
    st := 'needs_review'; why := 'GSTIN not yet checked with an authorised GST source';
  ELSIF v.result = 'error' THEN
    IF s.verification_status <> 'verified' THEN st := 'needs_review'; why := 'The GST check failed; it will be tried again'; END IF;
  ELSIF v.result = 'not_found' THEN
    st := CASE WHEN s.verification_status = 'verified' THEN 'suspended' ELSE 'rejected' END;
    why := 'GSTIN not found in the GST register';
  ELSIF coalesce(v.gst_status, '') !~* '^active' THEN
    st := CASE WHEN s.verification_status = 'verified' THEN 'suspended' ELSE 'rejected' END;
    why := 'GST registration is ' || coalesce(nullif(v.gst_status, ''), 'not active');
  ELSIF cfg.require_name_match AND coalesce(v.name_score, 0) < 0.6 THEN
    st := 'needs_review'; why := 'The name on the website does not match the GST legal or trade name';
  ELSIF cfg.require_state_match AND v.state_match IS DISTINCT FROM true THEN
    st := 'needs_review';
    why := CASE WHEN v.state_match IS NULL THEN 'No state found in the website address to match the GST registration'
                ELSE 'The website address is not in the GST registration state' END;
  ELSE
    st := 'verified'; why := NULL; verified_at := v.checked_at;
  END IF;

  -- products follow their supplier, and must come from the supplier's own website
  UPDATE discovery.products p SET
    verification_status = x.st, status_reason = x.why,
    publish_status = CASE WHEN x.st <> 'verified' AND p.publish_status = 'published' THEN 'internal' ELSE p.publish_status END,
    published_at = CASE WHEN x.st <> 'verified' THEN NULL ELSE p.published_at END
  FROM (
    SELECT p2.id,
      CASE WHEN p2.status_set_by = 'admin' AND p2.verification_status IN ('rejected', 'suspended') THEN p2.verification_status
           WHEN p2.duplicate_of IS NOT NULL THEN 'rejected'
           WHEN p2.status_set_by = 'system' AND p2.verification_status = 'suspended' AND p2.consecutive_failures > 0 THEN 'suspended'
           WHEN NOT (discovery.host_of(p2.source_url) = s.website_host OR discovery.host_of(p2.source_url) LIKE '%.' || s.website_host) THEN 'needs_review'
           WHEN st = 'verified' THEN 'verified'
           WHEN st IN ('rejected', 'suspended') THEN 'suspended'
           ELSE 'needs_review' END AS st,
      CASE WHEN p2.status_set_by = 'admin' AND p2.verification_status IN ('rejected', 'suspended') THEN p2.status_reason
           WHEN p2.duplicate_of IS NOT NULL THEN 'Duplicate of another product'
           WHEN p2.status_set_by = 'system' AND p2.verification_status = 'suspended' AND p2.consecutive_failures > 0 THEN p2.status_reason
           WHEN NOT (discovery.host_of(p2.source_url) = s.website_host OR discovery.host_of(p2.source_url) LIKE '%.' || s.website_host)
             THEN 'The product page is not on the company''s own website'
           WHEN st = 'verified' THEN NULL
           ELSE 'The supplier is not verified' END AS why
    FROM discovery.products p2 WHERE p2.supplier_id = s.id
  ) x
  WHERE p.id = x.id AND (p.verification_status IS DISTINCT FROM x.st OR p.status_reason IS DISTINCT FROM x.why);

  UPDATE discovery.products SET last_verified_at = verified_at WHERE supplier_id = s.id AND verification_status = 'verified' AND st = 'verified';

  SELECT count(*) INTO ok_products FROM discovery.products
   WHERE supplier_id = s.id AND verification_status = 'verified' AND publish_status <> 'withheld';

  pub := s.publish_status;
  IF st <> 'verified' THEN
    pub := CASE WHEN s.publish_status = 'withheld' THEN 'withheld' ELSE 'internal' END;
  ELSIF s.publish_status = 'withheld' THEN
    NULL;
  ELSIF ok_products < cfg.min_published_products THEN
    pub := 'internal';
  ELSIF s.publish_status = 'published' OR cfg.auto_publish THEN
    pub := 'published';
  END IF;
  pub_at := CASE WHEN pub = 'published' THEN coalesce(CASE WHEN s.publish_status = 'published' THEN s.published_at END, now()) END;

  UPDATE discovery.suppliers SET
    verification_status = st,
    status_reason = why,
    status_set_by = CASE WHEN st IS DISTINCT FROM s.verification_status THEN 'system' ELSE s.status_set_by END,
    publish_status = pub,
    published_at = pub_at,
    last_verified_at = verified_at,
    gst_legal_name = CASE WHEN has_check AND v.result = 'found' THEN v.legal_name ELSE s.gst_legal_name END,
    gst_trade_name = CASE WHEN has_check AND v.result = 'found' THEN v.trade_name ELSE s.gst_trade_name END,
    gst_status = CASE WHEN has_check AND v.result IN ('found', 'not_found') THEN coalesce(v.gst_status, 'Not found') ELSE s.gst_status END,
    gst_state = CASE WHEN has_check AND v.result = 'found' THEN v.registered_state ELSE s.gst_state END,
    gst_registered_on = CASE WHEN has_check AND v.result = 'found' THEN v.registered_on ELSE s.gst_registered_on END
  WHERE id = s.id;

  -- products are published only with a published supplier
  UPDATE discovery.products p SET
    publish_status = CASE WHEN p.publish_status = 'withheld' THEN 'withheld'
                          WHEN pub = 'published' AND p.verification_status = 'verified' THEN 'published' ELSE 'internal' END,
    published_at = CASE WHEN pub = 'published' AND p.verification_status = 'verified' AND p.publish_status <> 'withheld'
                        THEN coalesce(CASE WHEN p.publish_status = 'published' THEN p.published_at END, now()) END
  WHERE p.supplier_id = s.id;

  IF st IS DISTINCT FROM s.verification_status THEN
    PERFORM discovery.log('supplier', s.id, 'status_' || st, s.verification_status, st, jsonb_build_object('reason', why), p_actor);
  END IF;
  IF pub IS DISTINCT FROM s.publish_status THEN
    PERFORM discovery.log('supplier', s.id, CASE WHEN pub = 'published' THEN 'published' ELSE 'unpublished' END, s.publish_status, pub,
      jsonb_build_object('verified_products', ok_products), p_actor);
  END IF;
  RETURN st;
END $$;

-- ══ Worker functions (service role only) ════════════════════════════════════════════════════════════════════

-- next queued job, with the rules and the suppressed domains; jobs stuck for 3 hours are put back (3 tries)
CREATE OR REPLACE FUNCTION public.discovery_worker_claim_job() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j discovery.discovery_jobs%ROWTYPE; stale record;
BEGIN
  FOR stale IN
    UPDATE discovery.discovery_jobs
       SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
           error = CASE WHEN attempts >= 3 THEN 'Stopped after 3 attempts' ELSE error END,
           finished_at = CASE WHEN attempts >= 3 THEN now() END
     WHERE status = 'running' AND started_at < now() - interval '3 hours'
    RETURNING id, status, attempts
  LOOP
    PERFORM discovery.log('job', stale.id, CASE WHEN stale.status = 'failed' THEN 'job_failed' ELSE 'job_requeued' END, 'running', stale.status,
      jsonb_build_object('attempts', stale.attempts, 'reason', 'No progress for 3 hours'), NULL);
  END LOOP;

  SELECT * INTO j FROM discovery.discovery_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE discovery.discovery_jobs SET status = 'running', started_at = now(), attempts = attempts + 1, error = NULL
   WHERE id = j.id RETURNING * INTO j;
  PERFORM discovery.log('job', j.id, 'job_started', 'queued', 'running', jsonb_build_object('attempt', j.attempts), NULL);
  RETURN jsonb_build_object(
    'job', to_jsonb(j),
    'settings', (SELECT to_jsonb(s) FROM discovery.settings s WHERE id = 1),
    'suppressed_domains', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM discovery.suppressions WHERE kind = 'domain'));
END $$;

CREATE OR REPLACE FUNCTION public.discovery_worker_settings() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object('settings', (SELECT to_jsonb(s) FROM discovery.settings s WHERE id = 1),
    'suppressed_domains', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM discovery.suppressions WHERE kind = 'domain'));
$$;

CREATE OR REPLACE FUNCTION public.discovery_worker_finish_job(p_job uuid, p_status text, p_stats jsonb, p_error text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE prev text;
BEGIN
  IF p_status NOT IN ('done', 'failed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT status INTO prev FROM discovery.discovery_jobs WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF prev = 'cancelled' THEN RETURN; END IF;
  UPDATE discovery.discovery_jobs
     SET status = p_status, stats = coalesce(p_stats, '{}'::jsonb), error = left(p_error, 2000), finished_at = now(),
         source_type = coalesce(p_stats->>'source_type', source_type)
   WHERE id = p_job;
  PERFORM discovery.log('job', p_job, 'job_' || p_status, prev, p_status,
    jsonb_strip_nulls(jsonb_build_object('stats', p_stats, 'error', left(p_error, 500))), NULL);
END $$;

-- a company found on its own website; matched against existing records by website, GSTIN, then name + pincode
CREATE OR REPLACE FUNCTION public.discovery_worker_upsert_supplier(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  cfg discovery.settings%ROWTYPE;
  v_host text := discovery.host_of(p->>'website_url');
  v_name text := left(btrim(regexp_replace(coalesce(p->>'name_on_site', ''), '\s+', ' ', 'g')), 200);
  v_gstin text := upper(nullif(btrim(coalesce(p->>'gstin', '')), ''));
  v_pin text := nullif(btrim(coalesce(p->>'pincode', '')), '');
  s discovery.suppliers%ROWTYPE;
  dup uuid;
  created boolean := false;
  latest discovery.supplier_verification%ROWTYPE;
  st text;
BEGIN
  IF v_host IS NULL OR coalesce(p->>'source_url', '') !~* '^https?://' THEN RAISE EXCEPTION 'website_and_source_required'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  SELECT * INTO cfg FROM discovery.settings WHERE id = 1;
  IF v_gstin IS NOT NULL AND NOT discovery.gstin_ok(v_gstin) THEN v_gstin := NULL; END IF;
  IF v_pin IS NOT NULL AND v_pin !~ '^[1-9][0-9]{5}$' THEN v_pin := NULL; END IF;
  IF EXISTS (SELECT 1 FROM discovery.suppressions x WHERE (x.kind = 'domain' AND (x.value = v_host OR v_host LIKE '%.' || x.value))
                                                      OR (x.kind = 'gstin' AND x.value = v_gstin)) THEN
    RETURN jsonb_build_object('skipped', 'suppressed');
  END IF;

  SELECT * INTO s FROM discovery.suppliers WHERE website_host = v_host FOR UPDATE;
  IF FOUND THEN
    -- a GSTIN is only ever added once; a different one on a later visit is kept as evidence for an admin
    IF v_gstin IS NOT NULL AND s.gstin IS NOT NULL AND v_gstin <> s.gstin THEN
      PERFORM discovery.log('supplier', s.id, 'gstin_conflict', NULL, NULL, jsonb_build_object('stored', s.gstin, 'seen', v_gstin, 'url', p->>'source_url'), NULL);
      v_gstin := s.gstin;
    ELSIF v_gstin IS NOT NULL AND s.gstin IS NULL AND EXISTS (SELECT 1 FROM discovery.suppliers WHERE gstin = v_gstin AND id <> s.id) THEN
      PERFORM discovery.log('supplier', s.id, 'duplicate_gstin', NULL, NULL, jsonb_build_object('gstin', v_gstin), NULL);
      v_gstin := NULL;
    END IF;
    UPDATE discovery.suppliers SET
      website_url = coalesce(nullif(p->>'website_url', ''), website_url),
      name_on_site = v_name, normalized_name = discovery.norm_name(v_name),
      gstin = coalesce(s.gstin, v_gstin),
      address = coalesce(nullif(left(p->>'address', 500), ''), address),
      city = coalesce(nullif(left(p->>'city', 80), ''), city),
      state = coalesce(nullif(left(p->>'state', 80), ''), state),
      pincode = coalesce(v_pin, pincode),
      public_phones = CASE WHEN jsonb_typeof(p->'phones') = 'array' AND jsonb_array_length(p->'phones') > 0
                           THEN ARRAY(SELECT left(x, 40) FROM jsonb_array_elements_text(p->'phones') x LIMIT 5) ELSE public_phones END,
      public_emails = CASE WHEN jsonb_typeof(p->'emails') = 'array' AND jsonb_array_length(p->'emails') > 0
                           THEN ARRAY(SELECT left(x, 120) FROM jsonb_array_elements_text(p->'emails') x LIMIT 5) ELSE public_emails END,
      category_slugs = CASE WHEN jsonb_typeof(p->'category_slugs') = 'array'
                            THEN ARRAY(SELECT DISTINCT x FROM (SELECT unnest(category_slugs) x UNION SELECT jsonb_array_elements_text(p->'category_slugs')) y)
                            ELSE category_slugs END,
      evidence = coalesce(p->'evidence', evidence),
      content_hash = coalesce(p->>'content_hash', content_hash),
      consecutive_failures = 0,
      last_fetched_at = now(),
      next_recheck_at = now() + make_interval(days => cfg.recheck_days)
    WHERE id = s.id;
    PERFORM discovery.log('supplier', s.id, 'refreshed', NULL, NULL, jsonb_build_object('url', p->>'source_url', 'job', p->>'job_id'), NULL);
  ELSE
    IF v_gstin IS NOT NULL THEN SELECT id INTO dup FROM discovery.suppliers WHERE gstin = v_gstin; END IF;
    IF dup IS NULL AND v_pin IS NOT NULL THEN
      SELECT id INTO dup FROM discovery.suppliers
       WHERE pincode = v_pin AND duplicate_of IS NULL AND discovery.name_match(name_on_site, v_name) >= 0.9 LIMIT 1;
    END IF;
    INSERT INTO discovery.suppliers (website_host, website_url, name_on_site, normalized_name, gstin, address, city, state, pincode,
      public_phones, public_emails, category_slugs, source_url, source_type, found_via, discovered_by_job, duplicate_of,
      evidence, content_hash, last_fetched_at, next_recheck_at)
    VALUES (v_host, coalesce(nullif(p->>'website_url', ''), 'https://' || v_host), v_name, discovery.norm_name(v_name),
      CASE WHEN dup IS NULL THEN v_gstin END,
      nullif(left(p->>'address', 500), ''), nullif(left(p->>'city', 80), ''), nullif(left(p->>'state', 80), ''), v_pin,
      CASE WHEN jsonb_typeof(p->'phones') = 'array' THEN ARRAY(SELECT left(x, 40) FROM jsonb_array_elements_text(p->'phones') x LIMIT 5) ELSE '{}' END,
      CASE WHEN jsonb_typeof(p->'emails') = 'array' THEN ARRAY(SELECT left(x, 120) FROM jsonb_array_elements_text(p->'emails') x LIMIT 5) ELSE '{}' END,
      CASE WHEN jsonb_typeof(p->'category_slugs') = 'array' THEN ARRAY(SELECT DISTINCT jsonb_array_elements_text(p->'category_slugs')) ELSE '{}' END,
      p->>'source_url', coalesce(p->>'source_type', 'official_website'), nullif(p->>'found_via', ''),
      CASE WHEN p->>'job_id' ~ '^[0-9a-f-]{36}$' THEN (p->>'job_id')::uuid END, dup,
      coalesce(p->'evidence', '{}'::jsonb) || CASE WHEN dup IS NOT NULL AND v_gstin IS NOT NULL THEN jsonb_build_object('gstin_seen', v_gstin) ELSE '{}'::jsonb END,
      p->>'content_hash', now(), now() + make_interval(days => cfg.recheck_days))
    RETURNING * INTO s;
    created := true;
    PERFORM discovery.log('supplier', s.id, 'discovered', NULL, 'discovered',
      jsonb_build_object('url', p->>'source_url', 'found_via', p->>'found_via', 'job', p->>'job_id'), NULL);
    IF dup IS NOT NULL THEN
      PERFORM discovery.log('supplier', s.id, 'duplicate', NULL, NULL, jsonb_build_object('duplicate_of', dup), NULL);
    END IF;
  END IF;

  st := discovery.evaluate_supplier(s.id);
  SELECT * INTO s FROM discovery.suppliers WHERE id = s.id;
  IF s.gstin IS NOT NULL THEN
    SELECT * INTO latest FROM discovery.supplier_verification WHERE supplier_id = s.id AND gstin = s.gstin ORDER BY checked_at DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'id', s.id, 'created', created, 'duplicate_of', s.duplicate_of, 'verification_status', s.verification_status,
    'publish_status', s.publish_status, 'gstin', s.gstin,
    'needs_gst_check', s.gstin IS NOT NULL AND s.duplicate_of IS NULL AND (latest.id IS NULL OR latest.result IN ('error', 'not_configured')
                       OR latest.checked_at < now() - make_interval(days => cfg.gst_recheck_days)));
END $$;

-- the result of a GST check by an authorised provider (GST Suvidha Provider API)
CREATE OR REPLACE FUNCTION public.discovery_worker_record_gst(p_supplier uuid, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s discovery.suppliers%ROWTYPE; v discovery.supplier_verification%ROWTYPE; st text;
BEGIN
  SELECT * INTO s FROM discovery.suppliers WHERE id = p_supplier;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier_not_found'; END IF;
  IF s.gstin IS NULL OR upper(coalesce(p->>'gstin', '')) <> s.gstin THEN RAISE EXCEPTION 'gstin_mismatch'; END IF;
  IF coalesce(p->>'result', '') NOT IN ('found', 'not_found', 'error', 'not_configured') THEN RAISE EXCEPTION 'invalid_result'; END IF;
  INSERT INTO discovery.supplier_verification (supplier_id, method, provider, gstin, result, gst_status, legal_name, trade_name,
    registered_state, registered_pincode, registered_on, cancelled_on, evidence)
  VALUES (s.id, 'gst_api', nullif(p->>'provider', ''), s.gstin, p->>'result', nullif(left(p->>'gst_status', 40), ''),
    nullif(left(p->>'legal_name', 200), ''), nullif(left(p->>'trade_name', 200), ''), nullif(left(p->>'registered_state', 80), ''),
    nullif(left(p->>'registered_pincode', 10), ''),
    CASE WHEN p->>'registered_on' ~ '^\d{4}-\d{2}-\d{2}$' THEN (p->>'registered_on')::date END,
    CASE WHEN p->>'cancelled_on' ~ '^\d{4}-\d{2}-\d{2}$' THEN (p->>'cancelled_on')::date END,
    coalesce(p->'evidence', '{}'::jsonb))
  RETURNING * INTO v;
  PERFORM discovery.log('supplier', s.id, CASE WHEN v.result IN ('error', 'not_configured') THEN 'gst_check_' || v.result ELSE 'gst_checked' END,
    NULL, NULL, jsonb_strip_nulls(jsonb_build_object('provider', v.provider, 'result', v.result, 'gst_status', v.gst_status,
      'name_score', v.name_score, 'state_match', v.state_match, 'error', p->'evidence'->>'error')), NULL);
  st := discovery.evaluate_supplier(s.id);
  RETURN jsonb_build_object('verification_status', st, 'name_score', v.name_score, 'state_match', v.state_match);
END $$;

-- a product from the supplier's own catalogue; the same product seen again at another address becomes a second source
CREATE OR REPLACE FUNCTION public.discovery_worker_upsert_product(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  cfg discovery.settings%ROWTYPE;
  s discovery.suppliers%ROWTYPE;
  v_name text := left(btrim(regexp_replace(coalesce(p->>'name', ''), '\s+', ' ', 'g')), 200);
  v_norm text;
  v_url text := btrim(coalesce(p->>'source_url', ''));
  v_specs jsonb := CASE WHEN jsonb_typeof(p->'specifications') = 'object' THEN p->'specifications' ELSE '{}'::jsonb END;
  existing discovery.products%ROWTYPE;
  other uuid;
BEGIN
  SELECT * INTO cfg FROM discovery.settings WHERE id = 1;
  SELECT * INTO s FROM discovery.suppliers WHERE id = (p->>'supplier_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier_not_found'; END IF;
  IF s.duplicate_of IS NOT NULL THEN RETURN jsonb_build_object('skipped', 'supplier_is_duplicate'); END IF;
  IF v_name = '' OR v_url !~* '^https?://' THEN RAISE EXCEPTION 'name_and_source_required'; END IF;
  v_norm := discovery.norm_text(v_name);
  -- keep at most 60 specification rows, each value at most 300 characters
  v_specs := (SELECT coalesce(jsonb_object_agg(left(k, 80), left(val, 300)), '{}'::jsonb)
                FROM (SELECT key AS k, CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' ELSE value::text END AS val
                        FROM jsonb_each(v_specs) LIMIT 60) e WHERE btrim(val) <> '');

  SELECT id INTO other FROM discovery.products WHERE source_url = v_url AND supplier_id <> s.id;
  IF other IS NOT NULL THEN RETURN jsonb_build_object('skipped', 'source_belongs_to_another_supplier', 'product_id', other); END IF;

  SELECT * INTO existing FROM discovery.products WHERE supplier_id = s.id AND (source_url = v_url OR normalized_name = v_norm)
   ORDER BY (source_url = v_url) DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND existing.source_url <> v_url THEN
    INSERT INTO discovery.product_sources (product_id, source_url, http_status, content_hash, evidence)
    VALUES (existing.id, v_url, nullif(p->>'http_status', '')::int, p->>'content_hash', coalesce(p->'evidence', '{}'::jsonb))
    ON CONFLICT (product_id, source_url) DO UPDATE SET fetched_at = now(), http_status = EXCLUDED.http_status, content_hash = EXCLUDED.content_hash;
    UPDATE discovery.products SET specifications = v_specs || specifications WHERE id = existing.id;
    PERFORM discovery.log('product', existing.id, 'duplicate_source', NULL, NULL, jsonb_build_object('url', v_url), NULL);
    RETURN jsonb_build_object('id', existing.id, 'created', false, 'duplicate', true);
  ELSIF FOUND THEN
    UPDATE discovery.products SET
      name = v_name, normalized_name = v_norm,
      category_slug = coalesce(nullif(p->>'category_slug', ''), category_slug),
      manufacturer = coalesce(nullif(left(p->>'manufacturer', 200), ''), manufacturer),
      description_source = coalesce(nullif(left(p->>'description_source', 4000), ''), description_source),
      description = coalesce(nullif(left(p->>'description', 4000), ''), description),
      description_generated = CASE WHEN nullif(p->>'description', '') IS NOT NULL THEN coalesce((p->>'description_generated')::boolean, false) ELSE description_generated END,
      specifications = v_specs,
      image_source_url = coalesce(nullif(p->>'image_source_url', ''), image_source_url),
      price_text = nullif(left(p->>'price_text', 200), ''),
      moq_text = nullif(left(p->>'moq_text', 200), ''),
      evidence = coalesce(p->'evidence', evidence),
      content_hash = coalesce(p->>'content_hash', content_hash),
      consecutive_failures = 0, last_fetched_at = now(), next_recheck_at = now() + make_interval(days => cfg.recheck_days)
    WHERE id = existing.id;
    INSERT INTO discovery.product_sources (product_id, source_url, http_status, content_hash, evidence)
    VALUES (existing.id, v_url, nullif(p->>'http_status', '')::int, p->>'content_hash', coalesce(p->'evidence', '{}'::jsonb))
    ON CONFLICT (product_id, source_url) DO UPDATE SET fetched_at = now(), http_status = EXCLUDED.http_status, content_hash = EXCLUDED.content_hash;
    RETURN jsonb_build_object('id', existing.id, 'created', false, 'duplicate', false);
  END IF;

  INSERT INTO discovery.products (supplier_id, name, normalized_name, category_slug, manufacturer, description_source, description,
    description_generated, specifications, image_source_url, price_text, moq_text, source_url, source_type, evidence, content_hash,
    last_fetched_at, next_recheck_at)
  VALUES (s.id, v_name, v_norm, nullif(p->>'category_slug', ''), nullif(left(p->>'manufacturer', 200), ''),
    nullif(left(p->>'description_source', 4000), ''), nullif(left(p->>'description', 4000), ''),
    coalesce((p->>'description_generated')::boolean, false) AND nullif(p->>'description', '') IS NOT NULL,
    v_specs, nullif(p->>'image_source_url', ''), nullif(left(p->>'price_text', 200), ''), nullif(left(p->>'moq_text', 200), ''),
    v_url, coalesce(p->>'source_type', 'official_website'), coalesce(p->'evidence', '{}'::jsonb), p->>'content_hash',
    now(), now() + make_interval(days => cfg.recheck_days))
  RETURNING * INTO existing;
  INSERT INTO discovery.product_sources (product_id, source_url, http_status, content_hash, evidence)
  VALUES (existing.id, v_url, nullif(p->>'http_status', '')::int, p->>'content_hash', coalesce(p->'evidence', '{}'::jsonb));
  PERFORM discovery.log('product', existing.id, 'discovered', NULL, 'discovered', jsonb_build_object('url', v_url, 'supplier', s.id), NULL);
  RETURN jsonb_build_object('id', existing.id, 'created', true, 'duplicate', false);
END $$;

-- after a supplier's pages were read: apply the rules to it and its products
CREATE OR REPLACE FUNCTION public.discovery_worker_evaluate(p_supplier uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE st text;
BEGIN
  st := discovery.evaluate_supplier(p_supplier);
  RETURN (SELECT jsonb_build_object('verification_status', verification_status, 'publish_status', publish_status, 'reason', status_reason)
            FROM discovery.suppliers WHERE id = p_supplier);
END $$;

-- suppliers whose website (and published product pages) are due to be read again, and whether the GST check is due
CREATE OR REPLACE FUNCTION public.discovery_worker_due_rechecks(p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH cfg AS (SELECT * FROM discovery.settings WHERE id = 1)
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT s.id, s.website_url, s.source_url, s.gstin, s.verification_status, s.publish_status,
      (s.gstin IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM discovery.supplier_verification v
          WHERE v.supplier_id = s.id AND v.gstin = s.gstin AND v.result IN ('found', 'not_found')
            AND v.checked_at > now() - make_interval(days => (SELECT gst_recheck_days FROM cfg)))) AS gst_due,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'source_url', p.source_url)), '[]'::jsonb)
         FROM discovery.products p WHERE p.supplier_id = s.id AND p.verification_status IN ('verified', 'needs_review', 'suspended')
          AND p.duplicate_of IS NULL AND NOT (p.status_set_by = 'admin' AND p.verification_status = 'suspended')) AS products
    FROM discovery.suppliers s
    WHERE s.next_recheck_at <= now() AND s.duplicate_of IS NULL
      AND NOT (s.status_set_by = 'admin' AND s.verification_status IN ('rejected', 'suspended'))
      AND s.verification_status <> 'rejected'
    ORDER BY s.next_recheck_at
    LIMIT greatest(1, least(coalesce(p_limit, 20), 200))
  ) t;
$$;

-- the outcome of reading a supplier's website or a product page again.
-- gone (404/410, site removed) suspends at once; other failures suspend after 3 in a row; success restores.
CREATE OR REPLACE FUNCTION public.discovery_worker_record_recheck(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  cfg discovery.settings%ROWTYPE;
  v_id uuid := (p->>'id')::uuid;
  v_ok boolean := coalesce((p->>'ok')::boolean, false);
  v_gone boolean := coalesce((p->>'gone')::boolean, false);
  v_detail jsonb := jsonb_strip_nulls(jsonb_build_object('http_status', p->'http_status', 'error', p->>'error', 'url', p->>'url'));
  s discovery.suppliers%ROWTYPE;
  pr discovery.products%ROWTYPE;
  fails int;
BEGIN
  SELECT * INTO cfg FROM discovery.settings WHERE id = 1;
  IF p->>'entity' = 'supplier' THEN
    SELECT * INTO s FROM discovery.suppliers WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'supplier_not_found'; END IF;
    IF v_ok THEN
      UPDATE discovery.suppliers SET consecutive_failures = 0, last_fetched_at = now(),
        content_hash = coalesce(p->>'content_hash', content_hash), next_recheck_at = now() + make_interval(days => cfg.recheck_days),
        verification_status = CASE WHEN status_set_by = 'system' AND verification_status = 'suspended' AND consecutive_failures > 0 THEN 'needs_review' ELSE verification_status END
      WHERE id = v_id;
      PERFORM discovery.log('supplier', v_id, 'recheck_ok', NULL, NULL, v_detail, NULL);
    ELSE
      fails := s.consecutive_failures + 1;
      UPDATE discovery.suppliers SET consecutive_failures = fails, next_recheck_at = now() + interval '1 day' WHERE id = v_id;
      PERFORM discovery.log('supplier', v_id, 'recheck_failed', NULL, NULL, v_detail || jsonb_build_object('failures', fails, 'gone', v_gone), NULL);
      IF (v_gone OR fails >= 3) AND NOT (s.status_set_by = 'admin' AND s.verification_status IN ('rejected', 'suspended')) THEN
        UPDATE discovery.suppliers SET verification_status = 'suspended', status_set_by = 'system',
          publish_status = CASE WHEN publish_status = 'published' THEN 'internal' ELSE publish_status END, published_at = NULL,
          status_reason = 'The company website could not be read' || CASE WHEN p ? 'http_status' THEN ' (HTTP ' || (p->>'http_status') || ')' ELSE '' END
        WHERE id = v_id;
        PERFORM discovery.log('supplier', v_id, 'status_suspended', s.verification_status, 'suspended', v_detail, NULL);
      END IF;
    END IF;
    PERFORM discovery.evaluate_supplier(v_id);
    RETURN (SELECT jsonb_build_object('verification_status', verification_status, 'publish_status', publish_status) FROM discovery.suppliers WHERE id = v_id);
  ELSIF p->>'entity' = 'product' THEN
    SELECT * INTO pr FROM discovery.products WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
    IF v_ok THEN
      UPDATE discovery.products SET consecutive_failures = 0, last_fetched_at = now(), content_hash = coalesce(p->>'content_hash', content_hash),
        next_recheck_at = now() + make_interval(days => cfg.recheck_days),
        verification_status = CASE WHEN status_set_by = 'system' AND verification_status = 'suspended' AND consecutive_failures > 0 THEN 'needs_review' ELSE verification_status END
      WHERE id = v_id;
      UPDATE discovery.product_sources SET fetched_at = now(), http_status = nullif(p->>'http_status', '')::int
       WHERE product_id = v_id AND source_url = pr.source_url;
      PERFORM discovery.log('product', v_id, 'recheck_ok', NULL, NULL, v_detail, NULL);
    ELSE
      fails := pr.consecutive_failures + 1;
      UPDATE discovery.products SET consecutive_failures = fails WHERE id = v_id;
      PERFORM discovery.log('product', v_id, 'recheck_failed', NULL, NULL, v_detail || jsonb_build_object('failures', fails, 'gone', v_gone), NULL);
      IF (v_gone OR fails >= 3) AND NOT (pr.status_set_by = 'admin' AND pr.verification_status IN ('rejected', 'suspended')) THEN
        UPDATE discovery.products SET verification_status = 'suspended', status_set_by = 'system', publish_status = CASE WHEN publish_status = 'withheld' THEN 'withheld' ELSE 'internal' END,
          status_reason = 'The product page is no longer available' || CASE WHEN p ? 'http_status' THEN ' (HTTP ' || (p->>'http_status') || ')' ELSE '' END
        WHERE id = v_id;
        PERFORM discovery.log('product', v_id, 'status_suspended', pr.verification_status, 'suspended', v_detail, NULL);
      END IF;
    END IF;
    PERFORM discovery.evaluate_supplier(pr.supplier_id);
    RETURN (SELECT jsonb_build_object('verification_status', verification_status, 'publish_status', publish_status) FROM discovery.products WHERE id = v_id);
  END IF;
  RAISE EXCEPTION 'invalid_entity';
END $$;

-- an error the worker hit while reading a site (kept for the admin's Failures tab)
CREATE OR REPLACE FUNCTION public.discovery_worker_log_error(p_job uuid, p_url text, p_error text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT discovery.log('job', p_job, 'fetch_failed', NULL, NULL, jsonb_build_object('url', left(p_url, 500), 'error', left(p_error, 500)), NULL);
$$;

-- ══ Admin functions ═════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION discovery.require_admin() RETURNS uuid LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION discovery.supplier_row(s discovery.suppliers) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT to_jsonb(s) || jsonb_build_object(
    'product_count', (SELECT count(*) FROM discovery.products p WHERE p.supplier_id = s.id),
    'published_products', (SELECT count(*) FROM discovery.products p WHERE p.supplier_id = s.id AND p.publish_status = 'published'),
    'latest_gst_check', (SELECT to_jsonb(v) - 'evidence' FROM discovery.supplier_verification v WHERE v.supplier_id = s.id ORDER BY v.checked_at DESC LIMIT 1),
    'duplicate_of_name', (SELECT d.name_on_site FROM discovery.suppliers d WHERE d.id = s.duplicate_of));
$$;

CREATE OR REPLACE FUNCTION public.admin_discovery_overview() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM discovery.require_admin();
  RETURN jsonb_build_object(
    'suppliers', (SELECT jsonb_build_object(
        'new', count(*) FILTER (WHERE created_at > now() - interval '7 days' AND duplicate_of IS NULL),
        'needs_review', count(*) FILTER (WHERE verification_status IN ('discovered', 'needs_review') AND duplicate_of IS NULL),
        'verified', count(*) FILTER (WHERE verification_status = 'verified'),
        'published', count(*) FILTER (WHERE publish_status = 'published'),
        'rejected', count(*) FILTER (WHERE verification_status = 'rejected' AND duplicate_of IS NULL),
        'suspended', count(*) FILTER (WHERE verification_status = 'suspended'),
        'duplicates', count(*) FILTER (WHERE duplicate_of IS NOT NULL),
        'total', count(*)) FROM discovery.suppliers),
    'products', (SELECT jsonb_build_object(
        'total', count(*),
        'verified', count(*) FILTER (WHERE verification_status = 'verified'),
        'published', count(*) FILTER (WHERE publish_status = 'published'),
        'needs_review', count(*) FILTER (WHERE verification_status IN ('discovered', 'needs_review')),
        'duplicates', (SELECT count(DISTINCT product_id) FROM discovery.product_sources ps
                        WHERE (SELECT count(*) FROM discovery.product_sources x WHERE x.product_id = ps.product_id) > 1)
                      + count(*) FILTER (WHERE duplicate_of IS NOT NULL)) FROM discovery.products),
    'failures_7d', (SELECT count(*) FROM discovery.verification_logs
                     WHERE created_at > now() - interval '7 days' AND action IN ('fetch_failed', 'recheck_failed', 'gst_check_error', 'job_failed')),
    'jobs', (SELECT jsonb_build_object('queued', count(*) FILTER (WHERE status = 'queued'), 'running', count(*) FILTER (WHERE status = 'running'),
        'failed', count(*) FILTER (WHERE status = 'failed'), 'last_finished_at', max(finished_at)) FROM discovery.discovery_jobs),
    'settings', (SELECT to_jsonb(s) FROM discovery.settings s WHERE id = 1));
END $$;

-- tabs: new, needs_review, verified, published, rejected, suspended, duplicates, all
CREATE OR REPLACE FUNCTION public.admin_discovery_suppliers(p_tab text DEFAULT 'new', p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE q text := '%' || coalesce(nullif(btrim(p_search), ''), '') || '%'; res jsonb;
BEGIN
  PERFORM discovery.require_admin();
  WITH f AS (
    SELECT s.* FROM discovery.suppliers s
    WHERE CASE coalesce(p_tab, 'new')
            WHEN 'new' THEN s.created_at > now() - interval '7 days' AND s.duplicate_of IS NULL
            WHEN 'needs_review' THEN s.verification_status IN ('discovered', 'needs_review') AND s.duplicate_of IS NULL
            WHEN 'verified' THEN s.verification_status = 'verified'
            WHEN 'published' THEN s.publish_status = 'published'
            WHEN 'rejected' THEN s.verification_status = 'rejected' AND s.duplicate_of IS NULL
            WHEN 'suspended' THEN s.verification_status = 'suspended'
            WHEN 'duplicates' THEN s.duplicate_of IS NOT NULL
            ELSE true END
      AND (p_search IS NULL OR btrim(p_search) = '' OR s.name_on_site ILIKE q OR s.website_host ILIKE q OR coalesce(s.gstin, '') ILIKE q
           OR coalesce(s.city, '') ILIKE q OR coalesce(s.gst_legal_name, '') ILIKE q)
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
    'rows', coalesce((SELECT jsonb_agg(discovery.supplier_row(x) ORDER BY x.created_at DESC)
                        FROM discovery.suppliers x
                        WHERE x.id IN (SELECT id FROM f ORDER BY created_at DESC LIMIT least(greatest(coalesce(p_limit, 50), 1), 200) OFFSET greatest(coalesce(p_offset, 0), 0))), '[]'::jsonb))
  INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_discovery_supplier_detail(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s discovery.suppliers%ROWTYPE;
BEGIN
  PERFORM discovery.require_admin();
  SELECT * INTO s FROM discovery.suppliers WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object(
    'supplier', discovery.supplier_row(s),
    'gst_checks', (SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.checked_at DESC), '[]'::jsonb) FROM discovery.supplier_verification v WHERE v.supplier_id = s.id),
    'products', (SELECT coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('sources',
                   (SELECT coalesce(jsonb_agg(jsonb_build_object('source_url', ps.source_url, 'fetched_at', ps.fetched_at, 'http_status', ps.http_status) ORDER BY ps.created_at), '[]'::jsonb)
                      FROM discovery.product_sources ps WHERE ps.product_id = p.id)) ORDER BY p.name), '[]'::jsonb)
                 FROM discovery.products p WHERE p.supplier_id = s.id),
    'logs', (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb)
               FROM (SELECT * FROM discovery.verification_logs WHERE entity = 'supplier' AND entity_id = s.id
                      UNION ALL
                     SELECT * FROM discovery.verification_logs WHERE entity = 'product' AND entity_id IN (SELECT id FROM discovery.products WHERE supplier_id = s.id)
                     ORDER BY created_at DESC LIMIT 150) l));
END $$;

-- tabs: all, published, needs_review, rejected, suspended, duplicates
CREATE OR REPLACE FUNCTION public.admin_discovery_products(p_tab text DEFAULT 'all', p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE q text := '%' || coalesce(nullif(btrim(p_search), ''), '') || '%'; res jsonb;
BEGIN
  PERFORM discovery.require_admin();
  WITH f AS (
    SELECT p.*, s.name_on_site AS supplier_name, s.website_host,
      (SELECT count(*) FROM discovery.product_sources ps WHERE ps.product_id = p.id) AS source_count
    FROM discovery.products p JOIN discovery.suppliers s ON s.id = p.supplier_id
    WHERE (p_search IS NULL OR btrim(p_search) = '' OR p.name ILIKE q OR s.name_on_site ILIKE q OR coalesce(p.category_slug, '') ILIKE q)
  ), g AS (
    SELECT * FROM f WHERE CASE coalesce(p_tab, 'all')
      WHEN 'published' THEN publish_status = 'published'
      WHEN 'needs_review' THEN verification_status IN ('discovered', 'needs_review')
      WHEN 'rejected' THEN verification_status = 'rejected'
      WHEN 'suspended' THEN verification_status = 'suspended'
      WHEN 'duplicates' THEN duplicate_of IS NOT NULL OR source_count > 1
      ELSE true END
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM g),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
                        FROM (SELECT * FROM g ORDER BY created_at DESC LIMIT least(greatest(coalesce(p_limit, 50), 1), 200) OFFSET greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb))
  INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_discovery_jobs(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM discovery.require_admin();
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY j.created_at DESC), '[]'::jsonb)
            FROM (SELECT * FROM discovery.discovery_jobs ORDER BY created_at DESC LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)) j);
END $$;

-- failures: fetch errors, failed rechecks, GST check errors, failed jobs
CREATE OR REPLACE FUNCTION public.admin_discovery_logs(p_kind text DEFAULT 'failures', p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM discovery.require_admin();
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('name',
            CASE l.entity WHEN 'supplier' THEN (SELECT name_on_site FROM discovery.suppliers WHERE id = l.entity_id)
                          WHEN 'product' THEN (SELECT name FROM discovery.products WHERE id = l.entity_id) END) ORDER BY l.created_at DESC), '[]'::jsonb)
            FROM (SELECT * FROM discovery.verification_logs
                   WHERE coalesce(p_kind, 'failures') = 'all'
                      OR action IN ('fetch_failed', 'recheck_failed', 'gst_check_error', 'gst_check_not_configured', 'job_failed', 'gstin_conflict', 'status_suspended')
                   ORDER BY created_at DESC LIMIT least(greatest(coalesce(p_limit, 100), 1), 500)) l);
END $$;

CREATE OR REPLACE FUNCTION public.admin_discovery_queue_job(p_kind text, p_query text DEFAULT NULL, p_location text DEFAULT NULL,
  p_category text DEFAULT NULL, p_seed_urls text[] DEFAULT '{}', p_max_results integer DEFAULT 20) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := discovery.require_admin(); urls text[]; jid uuid;
BEGIN
  IF p_kind NOT IN ('search', 'seed_urls') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  urls := ARRAY(SELECT DISTINCT btrim(u) FROM unnest(coalesce(p_seed_urls, '{}')) u WHERE btrim(u) ~* '^https?://[^\s/]+\.[^\s]+$');
  IF p_kind = 'search' AND coalesce(btrim(p_query), '') = '' THEN RAISE EXCEPTION 'query_required'; END IF;
  IF p_kind = 'seed_urls' AND cardinality(urls) = 0 THEN RAISE EXCEPTION 'urls_required'; END IF;
  IF cardinality(urls) > 50 THEN RAISE EXCEPTION 'too_many_urls'; END IF;
  INSERT INTO discovery.discovery_jobs (kind, query, location, category_slug, seed_urls, max_results, requested_by, source_type)
  VALUES (p_kind, nullif(left(btrim(p_query), 200), ''), nullif(left(btrim(p_location), 100), ''), nullif(btrim(p_category), ''),
          CASE WHEN p_kind = 'seed_urls' THEN urls ELSE '{}' END, least(greatest(coalesce(p_max_results, 20), 1), 100), me,
          CASE WHEN p_kind = 'seed_urls' THEN 'seed_urls' END)
  RETURNING id INTO jid;
  PERFORM discovery.log('job', jid, 'job_queued', NULL, 'queued', jsonb_build_object('kind', p_kind, 'query', p_query, 'urls', cardinality(urls)), me);
  RETURN jid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_discovery_cancel_job(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := discovery.require_admin(); prev text;
BEGIN
  UPDATE discovery.discovery_jobs SET status = 'cancelled', finished_at = now()
   WHERE id = p_id AND status IN ('queued', 'running') RETURNING 'x' INTO prev;
  IF prev IS NULL THEN RAISE EXCEPTION 'job_not_cancellable'; END IF;
  PERFORM discovery.log('job', p_id, 'job_cancelled', NULL, 'cancelled', '{}'::jsonb, me);
END $$;

-- actions: gst_portal_check, publish, withhold, reject, suspend, restore, mark_duplicate, not_duplicate, suppress, recheck_now
CREATE OR REPLACE FUNCTION public.admin_discovery_supplier_action(p_id uuid, p_action text, p_note text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := discovery.require_admin(); s discovery.suppliers%ROWTYPE; note text := nullif(btrim(coalesce(p_note, '')), ''); target uuid;
BEGIN
  SELECT * INTO s FROM discovery.suppliers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_action IN ('reject', 'suspend', 'suppress', 'gst_portal_check', 'withhold') AND note IS NULL THEN RAISE EXCEPTION 'note_required'; END IF;

  IF p_action = 'gst_portal_check' THEN
    -- an admin looked the GSTIN up on the official GST portal (services.gst.gov.in) and copies what it shows
    IF s.gstin IS NULL THEN RAISE EXCEPTION 'no_gstin'; END IF;
    IF coalesce(p_payload->>'result', '') NOT IN ('found', 'not_found') THEN RAISE EXCEPTION 'invalid_result'; END IF;
    IF p_payload->>'result' = 'found' AND (coalesce(btrim(p_payload->>'gst_status'), '') = '' OR coalesce(btrim(p_payload->>'legal_name'), '') = '') THEN
      RAISE EXCEPTION 'status_and_legal_name_required';
    END IF;
    INSERT INTO discovery.supplier_verification (supplier_id, method, provider, gstin, result, gst_status, legal_name, trade_name, registered_on, evidence, checked_by)
    VALUES (s.id, 'gst_portal_manual', 'services.gst.gov.in', s.gstin, p_payload->>'result', nullif(btrim(p_payload->>'gst_status'), ''),
      nullif(btrim(p_payload->>'legal_name'), ''), nullif(btrim(p_payload->>'trade_name'), ''),
      CASE WHEN p_payload->>'registered_on' ~ '^\d{4}-\d{2}-\d{2}$' THEN (p_payload->>'registered_on')::date END,
      jsonb_build_object('note', note), me);
    PERFORM discovery.log('supplier', s.id, 'gst_portal_check', NULL, NULL, jsonb_build_object('result', p_payload->>'result', 'gst_status', p_payload->>'gst_status', 'note', note), me);
  ELSIF p_action = 'publish' THEN
    IF s.verification_status <> 'verified' THEN RAISE EXCEPTION 'only_verified_can_be_published'; END IF;
    UPDATE discovery.suppliers SET publish_status = 'published', published_at = coalesce(published_at, now()) WHERE id = s.id;
    UPDATE discovery.products SET publish_status = 'published', published_at = coalesce(published_at, now())
     WHERE supplier_id = s.id AND verification_status = 'verified' AND publish_status <> 'withheld';
    PERFORM discovery.log('supplier', s.id, 'published', s.publish_status, 'published', jsonb_build_object('note', note), me);
    RETURN jsonb_build_object('publish_status', 'published');
  ELSIF p_action = 'withhold' THEN
    UPDATE discovery.suppliers SET publish_status = 'withheld', published_at = NULL WHERE id = s.id;
    UPDATE discovery.products SET publish_status = CASE WHEN publish_status = 'withheld' THEN 'withheld' ELSE 'internal' END, published_at = NULL WHERE supplier_id = s.id;
    PERFORM discovery.log('supplier', s.id, 'withheld', s.publish_status, 'withheld', jsonb_build_object('note', note), me);
    RETURN jsonb_build_object('publish_status', 'withheld');
  ELSIF p_action IN ('reject', 'suspend') THEN
    UPDATE discovery.suppliers SET verification_status = CASE WHEN p_action = 'reject' THEN 'rejected' ELSE 'suspended' END,
      status_set_by = 'admin', status_reason = note,
      publish_status = CASE WHEN publish_status = 'published' THEN 'internal' ELSE publish_status END, published_at = NULL WHERE id = s.id;
    PERFORM discovery.log('supplier', s.id, 'status_' || CASE WHEN p_action = 'reject' THEN 'rejected' ELSE 'suspended' END,
      s.verification_status, CASE WHEN p_action = 'reject' THEN 'rejected' ELSE 'suspended' END, jsonb_build_object('note', note), me);
  ELSIF p_action = 'restore' THEN
    UPDATE discovery.suppliers SET verification_status = 'needs_review', status_set_by = 'system', status_reason = NULL, consecutive_failures = 0,
      publish_status = 'internal', published_at = NULL WHERE id = s.id;
    UPDATE discovery.products SET verification_status = 'needs_review', status_set_by = 'system', consecutive_failures = 0,
      publish_status = CASE WHEN publish_status = 'published' THEN 'internal' ELSE publish_status END
     WHERE supplier_id = s.id AND status_set_by = 'admin' AND verification_status = 'suspended';
    PERFORM discovery.log('supplier', s.id, 'restored', s.verification_status, 'needs_review', jsonb_build_object('note', note), me);
  ELSIF p_action = 'mark_duplicate' THEN
    target := nullif(p_payload->>'duplicate_of', '')::uuid;
    IF target IS NULL OR target = s.id OR NOT EXISTS (SELECT 1 FROM discovery.suppliers WHERE id = target) THEN RAISE EXCEPTION 'invalid_duplicate_target'; END IF;
    UPDATE discovery.suppliers SET duplicate_of = target, gstin = NULL,
      evidence = evidence || jsonb_strip_nulls(jsonb_build_object('gstin_seen', s.gstin)) WHERE id = s.id;
    PERFORM discovery.log('supplier', s.id, 'duplicate', NULL, NULL, jsonb_build_object('duplicate_of', target, 'note', note), me);
  ELSIF p_action = 'not_duplicate' THEN
    UPDATE discovery.suppliers SET duplicate_of = NULL, status_set_by = 'system', verification_status = 'needs_review', status_reason = NULL,
      publish_status = 'internal', published_at = NULL WHERE id = s.id;
    PERFORM discovery.log('supplier', s.id, 'not_duplicate', NULL, NULL, jsonb_build_object('note', note), me);
  ELSIF p_action = 'suppress' THEN
    -- the company asked not to be listed: off the directory now, and never collected again
    INSERT INTO discovery.suppressions (kind, value, reason, created_by) VALUES ('domain', s.website_host, note, me) ON CONFLICT (kind, value) DO NOTHING;
    IF s.gstin IS NOT NULL THEN
      INSERT INTO discovery.suppressions (kind, value, reason, created_by) VALUES ('gstin', s.gstin, note, me) ON CONFLICT (kind, value) DO NOTHING;
    END IF;
    UPDATE discovery.suppliers SET verification_status = 'rejected', status_set_by = 'admin', status_reason = 'Removal requested: ' || note,
      publish_status = 'withheld', published_at = NULL, public_phones = '{}', public_emails = '{}' WHERE id = s.id;
    UPDATE discovery.products SET publish_status = 'withheld', published_at = NULL WHERE supplier_id = s.id;
    PERFORM discovery.log('supplier', s.id, 'suppressed', s.verification_status, 'rejected', jsonb_build_object('note', note), me);
  ELSIF p_action = 'recheck_now' THEN
    UPDATE discovery.suppliers SET next_recheck_at = now() WHERE id = s.id;
    PERFORM discovery.log('supplier', s.id, 'recheck_requested', NULL, NULL, jsonb_build_object('note', note), me);
    RETURN jsonb_build_object('next_recheck_at', now());
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;

  PERFORM discovery.evaluate_supplier(s.id, me);
  RETURN (SELECT jsonb_build_object('verification_status', verification_status, 'publish_status', publish_status, 'reason', status_reason)
            FROM discovery.suppliers WHERE id = s.id);
END $$;

-- actions: publish, withhold, reject, restore, mark_duplicate, set_category
CREATE OR REPLACE FUNCTION public.admin_discovery_product_action(p_id uuid, p_action text, p_note text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := discovery.require_admin(); pr discovery.products%ROWTYPE; s discovery.suppliers%ROWTYPE; note text := nullif(btrim(coalesce(p_note, '')), ''); target uuid;
BEGIN
  SELECT * INTO pr FROM discovery.products WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM discovery.suppliers WHERE id = pr.supplier_id;
  IF p_action IN ('reject', 'withhold') AND note IS NULL THEN RAISE EXCEPTION 'note_required'; END IF;
  IF p_action = 'publish' THEN
    IF pr.verification_status <> 'verified' OR s.publish_status <> 'published' THEN RAISE EXCEPTION 'only_verified_products_of_published_suppliers'; END IF;
    UPDATE discovery.products SET publish_status = 'published', published_at = coalesce(published_at, now()) WHERE id = pr.id;
  ELSIF p_action = 'withhold' THEN
    UPDATE discovery.products SET publish_status = 'withheld', published_at = NULL WHERE id = pr.id;
  ELSIF p_action = 'reject' THEN
    UPDATE discovery.products SET verification_status = 'rejected', status_set_by = 'admin', status_reason = note, publish_status = 'internal', published_at = NULL WHERE id = pr.id;
  ELSIF p_action = 'restore' THEN
    UPDATE discovery.products SET verification_status = 'needs_review', status_set_by = 'system', status_reason = NULL, consecutive_failures = 0, duplicate_of = NULL,
      publish_status = 'internal', published_at = NULL WHERE id = pr.id;
  ELSIF p_action = 'mark_duplicate' THEN
    target := nullif(p_payload->>'duplicate_of', '')::uuid;
    IF target IS NULL OR target = pr.id OR NOT EXISTS (SELECT 1 FROM discovery.products WHERE id = target) THEN RAISE EXCEPTION 'invalid_duplicate_target'; END IF;
    UPDATE discovery.products SET duplicate_of = target WHERE id = pr.id;
  ELSIF p_action = 'set_category' THEN
    UPDATE discovery.products SET category_slug = nullif(btrim(p_payload->>'category_slug'), '') WHERE id = pr.id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  PERFORM discovery.log('product', pr.id, p_action, pr.verification_status, NULL, jsonb_strip_nulls(jsonb_build_object('note', note, 'payload', nullif(p_payload, '{}'::jsonb))), me);
  PERFORM discovery.evaluate_supplier(pr.supplier_id, me);
  RETURN (SELECT jsonb_build_object('verification_status', verification_status, 'publish_status', publish_status) FROM discovery.products WHERE id = pr.id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_discovery_update_settings(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := discovery.require_admin(); before jsonb; after jsonb; sid uuid;
BEGIN
  SELECT to_jsonb(s) INTO before FROM discovery.settings s WHERE id = 1;
  UPDATE discovery.settings SET
    auto_publish = coalesce((p->>'auto_publish')::boolean, auto_publish),
    require_name_match = coalesce((p->>'require_name_match')::boolean, require_name_match),
    require_state_match = coalesce((p->>'require_state_match')::boolean, require_state_match),
    min_published_products = coalesce((p->>'min_published_products')::int, min_published_products),
    publish_product_images = coalesce((p->>'publish_product_images')::boolean, publish_product_images),
    recheck_days = coalesce((p->>'recheck_days')::int, recheck_days),
    gst_recheck_days = coalesce((p->>'gst_recheck_days')::int, gst_recheck_days),
    max_pages_per_site = coalesce((p->>'max_pages_per_site')::int, max_pages_per_site),
    updated_at = now(), updated_by = me
  WHERE id = 1;
  SELECT to_jsonb(s) INTO after FROM discovery.settings s WHERE id = 1;
  PERFORM discovery.log('settings', NULL, 'settings_changed', NULL, NULL, jsonb_build_object('before', before, 'after', after), me);
  -- the rules may have changed: apply them to every supplier again
  FOR sid IN SELECT id FROM discovery.suppliers LOOP PERFORM discovery.evaluate_supplier(sid, me); END LOOP;
  RETURN after;
END $$;

-- ══ Public directory (published, verified records only; no contacts, GSTIN or source links) ═══════════════════
CREATE OR REPLACE FUNCTION discovery.public_supplier(s discovery.suppliers) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'name', coalesce(nullif(s.gst_trade_name, ''), nullif(s.gst_legal_name, ''), s.name_on_site),
    'legal_name', s.gst_legal_name,
    'city', s.city, 'state', coalesce(s.gst_state, s.state), 'country', s.country,
    'categories', to_jsonb(s.category_slugs),
    'gst_status', s.gst_status,
    'verified_at', s.last_verified_at,
    'published_at', s.published_at,
    'product_count', (SELECT count(*) FROM discovery.products p WHERE p.supplier_id = s.id AND p.publish_status = 'published'));
$$;

CREATE OR REPLACE FUNCTION discovery.public_product(p discovery.products, show_images boolean) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'name', p.name, 'category', p.category_slug, 'description', p.description,
    'specifications', p.specifications, 'price_text', p.price_text, 'moq_text', p.moq_text,
    'image_url', CASE WHEN show_images THEN p.image_source_url END,
    'checked_at', coalesce(p.last_fetched_at, p.updated_at), 'supplier_id', p.supplier_id);
$$;

CREATE OR REPLACE FUNCTION public.directory_suppliers(p_search text DEFAULT NULL, p_category text DEFAULT NULL, p_state text DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH f AS (
    SELECT s.* FROM discovery.suppliers s
    WHERE s.publish_status = 'published' AND s.verification_status = 'verified' AND s.duplicate_of IS NULL
      AND (coalesce(btrim(p_category), '') = '' OR p_category = ANY (s.category_slugs)
           OR EXISTS (SELECT 1 FROM discovery.products p WHERE p.supplier_id = s.id AND p.publish_status = 'published' AND p.category_slug = p_category))
      AND (coalesce(btrim(p_state), '') = '' OR discovery.norm_state(coalesce(s.gst_state, s.state)) = discovery.norm_state(p_state))
      AND (coalesce(btrim(p_search), '') = ''
           OR s.name_on_site ILIKE '%' || btrim(p_search) || '%' OR coalesce(s.gst_trade_name, '') ILIKE '%' || btrim(p_search) || '%'
           OR coalesce(s.gst_legal_name, '') ILIKE '%' || btrim(p_search) || '%' OR coalesce(s.city, '') ILIKE '%' || btrim(p_search) || '%'
           OR EXISTS (SELECT 1 FROM discovery.products p WHERE p.supplier_id = s.id AND p.publish_status = 'published' AND p.name ILIKE '%' || btrim(p_search) || '%'))
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
    'rows', coalesce((SELECT jsonb_agg(discovery.public_supplier(x) || jsonb_build_object('sample_products',
               (SELECT coalesce(jsonb_agg(p.name ORDER BY p.name), '[]'::jsonb) FROM (SELECT name FROM discovery.products
                  WHERE supplier_id = x.id AND publish_status = 'published' ORDER BY name LIMIT 4) p)) ORDER BY x.published_at DESC)
             FROM discovery.suppliers x
             WHERE x.id IN (SELECT id FROM f ORDER BY published_at DESC LIMIT least(greatest(coalesce(p_limit, 24), 1), 60) OFFSET greatest(coalesce(p_offset, 0), 0))), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.directory_supplier(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT discovery.public_supplier(s) || jsonb_build_object('products',
    (SELECT coalesce(jsonb_agg(discovery.public_product(p, (SELECT publish_product_images FROM discovery.settings WHERE id = 1)) ORDER BY p.name), '[]'::jsonb)
       FROM discovery.products p WHERE p.supplier_id = s.id AND p.publish_status = 'published'))
  FROM discovery.suppliers s
  WHERE s.id = p_id AND s.publish_status = 'published' AND s.verification_status = 'verified' AND s.duplicate_of IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.directory_products(p_search text DEFAULT NULL, p_category text DEFAULT NULL, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH f AS (
    SELECT p.*, s.name_on_site, s.gst_trade_name, s.gst_legal_name, s.city, coalesce(s.gst_state, s.state) AS sstate
    FROM discovery.products p JOIN discovery.suppliers s ON s.id = p.supplier_id
    WHERE p.publish_status = 'published' AND p.verification_status = 'verified'
      AND s.publish_status = 'published' AND s.verification_status = 'verified'
      AND (coalesce(btrim(p_category), '') = '' OR p.category_slug = p_category)
      AND (coalesce(btrim(p_search), '') = '' OR p.name ILIKE '%' || btrim(p_search) || '%' OR coalesce(p.description, '') ILIKE '%' || btrim(p_search) || '%')
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object(
               'id', x.id, 'name', x.name, 'category', x.category_slug, 'supplier_id', x.supplier_id,
               'supplier_name', coalesce(nullif(x.gst_trade_name, ''), nullif(x.gst_legal_name, ''), x.name_on_site),
               'city', x.city, 'state', x.sstate,
               'image_url', CASE WHEN (SELECT publish_product_images FROM discovery.settings WHERE id = 1) THEN x.image_source_url END,
               'checked_at', coalesce(x.last_fetched_at, x.updated_at)) ORDER BY x.published_at DESC)
             FROM (SELECT * FROM f ORDER BY published_at DESC LIMIT least(greatest(coalesce(p_limit, 24), 1), 60) OFFSET greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb));
$$;

-- ══ Who may call what ═══════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE f text; r text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'discovery_worker_claim_job()', 'discovery_worker_settings()', 'discovery_worker_finish_job(uuid, text, jsonb, text)',
    'discovery_worker_upsert_supplier(jsonb)', 'discovery_worker_record_gst(uuid, jsonb)', 'discovery_worker_upsert_product(jsonb)',
    'discovery_worker_evaluate(uuid)', 'discovery_worker_due_rechecks(integer)', 'discovery_worker_record_recheck(jsonb)',
    'discovery_worker_log_error(uuid, text, text)',
    'admin_discovery_overview()', 'admin_discovery_suppliers(text, text, integer, integer)', 'admin_discovery_supplier_detail(uuid)',
    'admin_discovery_products(text, text, integer, integer)', 'admin_discovery_jobs(integer)', 'admin_discovery_logs(text, integer)',
    'admin_discovery_queue_job(text, text, text, text, text[], integer)', 'admin_discovery_cancel_job(uuid)',
    'admin_discovery_supplier_action(uuid, text, text, jsonb)', 'admin_discovery_product_action(uuid, text, text, jsonb)',
    'admin_discovery_update_settings(jsonb)',
    'directory_suppliers(text, text, text, integer, integer)', 'directory_supplier(uuid)', 'directory_products(text, text, integer, integer)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM %I', f, r); END IF;
    END LOOP;
    r := CASE WHEN f LIKE 'discovery_worker_%' THEN 'service_role' WHEN f LIKE 'admin_%' THEN 'authenticated' ELSE 'anon,authenticated' END;
    IF r = 'anon,authenticated' THEN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon', f); END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f); END IF;
    ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO %I', f, r);
    END IF;
  END LOOP;
END $$;

COMMIT;
