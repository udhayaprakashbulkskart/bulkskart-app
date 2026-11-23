-- Phone numbers, WhatsApp numbers and email addresses are not public.
--
-- Only members with an active paid subscription (and admins) see other people's contact details; everyone sees their
-- own. The website already shows them that way; this makes the database hold the same line for the public:
--
--  1. Visitors who are not signed in (the "anon" role) can no longer read profiles.phone, profiles.email or
--     profiles.whatsapp_number. Every other column stays readable, so public pages keep working (the website stopped
--     asking for these columns for visitors in the same release).
--  2. buyer_public_profile() returns the buyer's phone, email and WhatsApp only when the caller is that buyer, an admin
--     or a supplier with an active paid subscription; for everyone else they come back empty.
--
-- A column added to profiles later is not readable by visitors until it is granted to anon (see step 1).
-- Safe to run again. Everything runs in one transaction and stops if visitors could still read an email afterwards.

BEGIN;

-- Who may see someone's contact details: that person, admins and suppliers with an active paid plan
-- (is_supplier_subscribed() is true for admins too).
CREATE OR REPLACE FUNCTION public.can_view_contacts(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (auth.uid() = p_owner OR public.is_supplier_subscribed(auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_view_contacts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_contacts(uuid) TO anon, authenticated, service_role;

-- 1. Visitors: every profiles column except the contact ones
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profiles'
     AND column_name NOT IN ('phone', 'email', 'whatsapp_number');
  REVOKE SELECT ON public.profiles FROM anon;
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon', cols);
END $$;

-- 2. Public buyer profile: contact details only for those allowed to see them
CREATE OR REPLACE FUNCTION public.buyer_public_profile(p_slug text)
RETURNS TABLE (
  user_id uuid,
  public_slug text,
  company_name text,
  brand_name text,
  business_type text,
  gst_number text,
  annual_volume text,
  address text,
  city text,
  state text,
  country text,
  pincode text,
  verified boolean,
  verification_status text,
  logo_url text,
  banner_url text,
  whatsapp_number text,
  website text,
  year_established integer,
  description text,
  product_categories text[],
  target_products text[],
  trade_type text,
  countries_served text[],
  created_at timestamptz,
  full_name text,
  avatar_url text,
  phone text,
  email text,
  profile_whatsapp text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bp.user_id,
    bp.public_slug,
    bp.company_name,
    bp.brand_name,
    bp.business_type,
    bp.gst_number,
    bp.annual_volume,
    bp.address,
    bp.city,
    bp.state,
    bp.country,
    bp.pincode,
    bp.verified,
    bp.verification_status,
    bp.logo_url,
    bp.banner_url,
    CASE WHEN public.can_view_contacts(bp.user_id) THEN bp.whatsapp_number END,
    bp.website,
    bp.year_established,
    bp.description,
    bp.product_categories,
    bp.target_products,
    bp.trade_type,
    bp.countries_served,
    bp.created_at,
    p.full_name,
    p.avatar_url,
    CASE WHEN public.can_view_contacts(bp.user_id) THEN p.phone END,
    CASE WHEN public.can_view_contacts(bp.user_id) THEN p.email END,
    CASE WHEN public.can_view_contacts(bp.user_id) THEN p.whatsapp_number END
  FROM public.buyer_profiles bp
  JOIN public.profiles p ON p.id = bp.user_id
  WHERE bp.public_slug = lower(btrim(p_slug))
    AND p.role = 'buyer'
    AND p.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.buyer_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_public_profile(text) TO anon, authenticated, service_role;

-- Stop (and undo everything above) if visitors could still read contact details, e.g. through a grant to PUBLIC
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.profiles', 'email', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'phone', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'whatsapp_number', 'SELECT') THEN
    RAISE EXCEPTION 'Visitors can still read profile contact details (check grants to PUBLIC on public.profiles)';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT') THEN
    RAISE EXCEPTION 'Signed-in users lost access to profiles.email; nothing was changed';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
