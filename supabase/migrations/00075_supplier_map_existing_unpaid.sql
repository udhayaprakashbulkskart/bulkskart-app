-- 00075: the companies already on BulkSkart before the paid-only supplier map are shown on it too
--
--   * Every real manufacturer that existed when this ran (active supplier account, not blocked, not rejected, not
--     an imported or system listing) is recorded once in supplier_map_grandfathered, with the cutoff time.
--   * The map shows a company when it has an active paid plan OR is in that list. Manufacturers who register
--     after the cutoff appear only with an active paid plan, as before.
--   * Unpaid companies are placed at the centre of the city in their own profile (map_places, 00072); a company
--     whose city is not in map_places is not shown. They never get the green Verified check; the site labels
--     them "Unverified". The search and detail functions now also return `paid`.
-- No business data is created or changed. Safe to run again (the list is filled only on the first run).
BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_map_grandfathered (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  cutoff_at timestamptz NOT NULL
);
ALTER TABLE public.supplier_map_grandfathered ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_map_grandfathered FROM PUBLIC, anon, authenticated;

INSERT INTO public.supplier_map_grandfathered (company_id, cutoff_at)
SELECT c.id, now()
  FROM public.companies c
  JOIN public.profiles p ON p.id = c.owner_id AND p.status = 'active' AND p.role = 'supplier'
 WHERE NOT COALESCE(c.is_blocked, false)
   AND c.verification_status <> 'rejected'
   AND c.owner_id <> '00000000-0000-0000-0000-000000000001'::uuid
   AND c.id::text NOT LIKE 'e1000001-0000-0000-0000-%'
   AND NOT EXISTS (SELECT 1 FROM public.supplier_map_grandfathered)
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.map_visible_company_ids()
RETURNS TABLE (
  company_id uuid, latitude double precision, longitude double precision, location_precision text,
  city text, state text, country text, verified boolean, verified_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, pt.latitude, pt.longitude, pt.location_precision, pt.city, pt.state, pt.country,
         (public.company_has_paid_plan(c.id)
           AND c.verification_status = 'verified'
           AND (c.verification_expiry_at IS NULL OR c.verification_expiry_at > now())
           AND (bv.company_id IS NULL OR (bv.status = 'approved' AND (bv.recheck_due_at IS NULL OR bv.recheck_due_at > now())))) AS verified,
         COALESCE(bv.decided_at, c.verified_at)
    FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id AND p.status = 'active' AND p.role = 'supplier'
    LEFT JOIN public.business_verifications bv ON bv.company_id = c.id
    CROSS JOIN LATERAL public.company_map_point(c.id) pt
   WHERE NOT COALESCE(c.is_blocked, false)
     AND c.verification_status <> 'rejected'
     AND (bv.company_id IS NULL OR bv.status NOT IN ('rejected', 'suspended'))
     AND c.owner_id <> '00000000-0000-0000-0000-000000000001'::uuid
     AND c.id::text NOT LIKE 'e1000001-0000-0000-0000-%'
     AND (public.company_has_paid_plan(c.id)
          OR EXISTS (SELECT 1 FROM public.supplier_map_grandfathered g WHERE g.company_id = c.id));
$$;

DROP FUNCTION IF EXISTS public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text, boolean);
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
  p_country text DEFAULT NULL,
  p_verified_only boolean DEFAULT false
)
RETURNS TABLE (
  company_id uuid, company_name text, slug text, business_type text, city text, state text, country text,
  latitude double precision, longitude double precision, location_precision text, distance_km double precision,
  rating numeric, review_count integer, logo_url text, cover_url text,
  verified boolean, gst_verified boolean, cin_verified boolean, udyam_verified boolean, registry_verified boolean, verified_since timestamptz,
  matched_products jsonb, product_count integer, min_moq numeric, moq_unit text,
  monthly_capacity numeric, capacity_unit text, lead_time_days integer, stock_status text, supply_type text,
  availability_updated_at timestamptz, total_count bigint, paid boolean
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
           CASE WHEN p_radius_km IS NULL OR p_lat IS NULL THEN NULL
                ELSE p_radius_km / (111.0 * GREATEST(cos(radians(p_lat)), 0.01)) END AS dlng,
           LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200) AS lim,
           GREATEST(COALESCE(p_offset, 0), 0) AS off
  ),
  base AS (
    SELECT c.id, c.company_name, c.slug, c.business_type, c.rating_avg, c.review_count, c.logo_url, c.cover_url,
           c.key_products, c.description,
           v.latitude, v.longitude, v.location_precision, v.city, v.state, v.country, v.verified, v.verified_since, public.company_has_paid_plan(c.id) AS paid,
           fl.monthly_capacity, fl.capacity_unit, fl.lead_time_days, fl.stock_status, fl.supply_type, fl.availability_updated_at,
           -- registration checks count only while the company is verified
           (v.verified AND COALESCE(bv.gst_verified, false)) AS gst_verified,
           (v.verified AND COALESCE(bv.cin_verified, false)) AS cin_verified,
           (v.verified AND COALESCE(bv.udyam_verified, false)) AS udyam_verified,
           (v.verified AND COALESCE(bv.registry_verified, false)) AS registry_verified,
           CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
                ELSE public.km_between(p_lat, p_lng, v.latitude, v.longitude) END AS dist
      FROM public.map_visible_company_ids() v
      JOIN public.companies c ON c.id = v.company_id
      LEFT JOIN public.factory_locations fl ON fl.company_id = c.id
      LEFT JOIN public.business_verifications bv ON bv.company_id = c.id, q
     WHERE (p_south IS NULL OR v.latitude BETWEEN p_south AND p_north)
       AND (p_west IS NULL OR p_east IS NULL OR CASE WHEN p_west <= p_east THEN v.longitude BETWEEN p_west AND p_east
                                                     ELSE v.longitude >= p_west OR v.longitude <= p_east END)
       AND (q.country IS NULL OR lower(v.country) = lower(q.country))
       AND (p_radius_km IS NULL OR p_lat IS NULL OR p_lng IS NULL OR (
             v.latitude BETWEEN p_lat - p_radius_km / 111.0 AND p_lat + p_radius_km / 111.0
             AND (q.dlng >= 180 OR abs(v.longitude - p_lng) <= q.dlng OR abs(v.longitude - p_lng) >= 360 - q.dlng)))
       AND (NOT p_verified_only OR v.verified)
       AND (NOT p_require_gst OR (v.verified AND COALESCE(bv.gst_verified, false)))
       AND (NOT p_require_cin OR (v.verified AND COALESCE(bv.cin_verified, false)))
       AND (NOT p_require_udyam OR (v.verified AND COALESCE(bv.udyam_verified, false)))
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
    SELECT b.*, COALESCE(a.items, '[]'::jsonb) AS items, COALESCE(a.n, 0) AS n, a.min_moq, a.unit
      FROM base b
      LEFT JOIN agg a ON a.company_id = b.id, q
     WHERE a.company_id IS NOT NULL
        -- no product filters: every company on the map, with or without products
        OR (q.term IS NULL AND q.cat IS NULL AND p_max_moq IS NULL)
        -- a search also matches the company's name, its listed key products and its description
        OR (q.term IS NOT NULL AND q.cat IS NULL AND p_max_moq IS NULL
            AND (b.company_name ILIKE '%' || q.term || '%'
                 OR array_to_string(b.key_products, ' ') ILIKE '%' || q.term || '%'
                 OR COALESCE(b.description, '') ILIKE '%' || q.term || '%'))
  ),
  ranged AS (
    SELECT * FROM matched WHERE p_radius_km IS NULL OR dist IS NULL OR dist <= p_radius_km
  )
  SELECT r.id, r.company_name, r.slug, r.business_type, r.city, r.state, r.country, r.latitude, r.longitude, r.location_precision,
         round(r.dist::numeric, 1)::double precision,
         r.rating_avg, r.review_count, r.logo_url, r.cover_url,
         r.verified, r.gst_verified, r.cin_verified, r.udyam_verified, r.registry_verified, r.verified_since,
         (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(r.items) e LIMIT 6) s),
         r.n, r.min_moq, r.unit, r.monthly_capacity, r.capacity_unit, r.lead_time_days, r.stock_status, r.supply_type,
         r.availability_updated_at, count(*) OVER (), r.paid
    FROM ranged r, q
   ORDER BY r.dist NULLS LAST, r.paid DESC, r.verified DESC, r.rating_avg DESC NULLS LAST, r.company_name
   LIMIT (SELECT lim FROM q) OFFSET (SELECT off FROM q);
$$;
REVOKE ALL ON FUNCTION public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text, boolean) TO anon, authenticated, service_role;

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
    'city', v.city, 'state', v.state, 'country', v.country,
    -- the street address only for a pinned factory; a city-level point shows the city
    'factory_address', CASE WHEN v.location_precision IN ('exact', 'pinned') THEN fl.address END,
    'latitude', v.latitude, 'longitude', v.longitude, 'location_precision', v.location_precision,
    'distance_km', CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL ELSE round(public.km_between(p_lat, p_lng, v.latitude, v.longitude)::numeric, 1) END,
    'monthly_capacity', fl.monthly_capacity, 'capacity_unit', fl.capacity_unit, 'lead_time_days', fl.lead_time_days,
    'stock_status', fl.stock_status, 'supply_type', fl.supply_type, 'availability_updated_at', fl.availability_updated_at,
    'verified', v.verified, 'paid', public.company_has_paid_plan(c.id),
    'gst_verified', v.verified AND COALESCE(bv.gst_verified, false), 'cin_verified', v.verified AND COALESCE(bv.cin_verified, false),
    'udyam_verified', v.verified AND COALESCE(bv.udyam_verified, false), 'registry_verified', v.verified AND COALESCE(bv.registry_verified, false),
    'registration_country', bv.registration_country,
    'entity_type', bv.entity_type, 'verified_since', v.verified_since,
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'slug', pr.slug, 'moq', pr.moq, 'moq_unit', pr.moq_unit,
               'price_min', pr.price_min, 'price_max', pr.price_max, 'currency', pr.price_currency, 'image', (pr.images)[1])
               ORDER BY pr.updated_at DESC NULLS LAST)
        FROM (SELECT * FROM public.products WHERE company_id = c.id AND is_active ORDER BY updated_at DESC NULLS LAST LIMIT 12) pr
    ), '[]'::jsonb)
  )
    FROM public.map_visible_company_ids() v
    JOIN public.companies c ON c.id = v.company_id
    LEFT JOIN public.factory_locations fl ON fl.company_id = c.id
    LEFT JOIN public.business_verifications bv ON bv.company_id = c.id
   WHERE c.id = p_company_id;
$$;

REVOKE ALL ON FUNCTION public.map_visible_company_ids() FROM PUBLIC, anon, authenticated;

INSERT INTO public.supplier_map_changes (company_id, kind) VALUES (NULL, 'supplier_map_grandfathered');

COMMIT;

NOTIFY pgrst, 'reload schema';
