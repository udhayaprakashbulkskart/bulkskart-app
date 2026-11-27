-- 00080: RFQ buyer phone and email only for the buyer, an admin, or a paid supplier.
--
-- "Paid" is the existing rule (is_supplier_subscribed / quotations / supplier map): a supplier whose company has a
-- subscription with status 'active' that has not passed ends_at, or an admin. Buyers are not treated as paid.
--
--   * profile_contacts / profile_contacts_for / rfq_buyer_contacts return those fields only when can_view_contacts
--     is true (the owner, an admin, or a paid supplier). Everyone else gets no row.
--   * my_profile returns the signed-in user's full row, including their own phone and email, so account pages still work.
--   * SELECT on profiles.phone, profiles.email and profiles.whatsapp_number is revoked from authenticated (anon already
--     lost them in 00069). Public RFQ queries must not name those columns; they go through the functions above.
--   * Quotations already require is_supplier_subscribed on INSERT. Chat INSERT already requires is_chat_eligible on
--     the supplier (the same paid rule). Those policies are left in place.
--
-- No business rows are added. Safe to run again.

BEGIN;

CREATE OR REPLACE FUNCTION public.profile_contacts(p_user_id uuid)
RETURNS TABLE (user_id uuid, phone text, email text, whatsapp_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.phone, p.email, p.whatsapp_number
    FROM public.profiles p
   WHERE p.id = p_user_id
     AND public.can_view_contacts(p.id);
$$;

CREATE OR REPLACE FUNCTION public.profile_contacts_for(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, phone text, email text, whatsapp_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.phone, p.email, p.whatsapp_number
    FROM public.profiles p
   WHERE p_user_ids IS NOT NULL
     AND p.id = ANY(p_user_ids)
     AND public.can_view_contacts(p.id);
$$;

CREATE OR REPLACE FUNCTION public.rfq_buyer_contacts(p_requirement_id uuid)
RETURNS TABLE (user_id uuid, phone text, email text, whatsapp_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.phone, p.email, p.whatsapp_number
    FROM public.requirements r
    JOIN public.profiles p ON p.id = r.buyer_id
   WHERE r.id = p_requirement_id
     AND public.can_view_contacts(p.id);
$$;

-- The signed-in person's own row, including contacts they may edit.
CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.profile_contacts(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.profile_contacts_for(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rfq_buyer_contacts(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.profile_contacts(uuid), public.profile_contacts_for(uuid[]), public.rfq_buyer_contacts(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated, service_role;

-- Contact columns: readable only through the functions above (and by the table owner / service role).
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profiles'
     AND column_name NOT IN ('phone', 'email', 'whatsapp_number');
  REVOKE SELECT ON public.profiles FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', cols);
END $$;

-- Fail the migration if a visitor or an unpaid signed-in role can still read email directly.
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.profiles', 'email', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'phone', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'whatsapp_number', 'SELECT')
     OR has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')
     OR has_column_privilege('authenticated', 'public.profiles', 'phone', 'SELECT')
     OR has_column_privilege('authenticated', 'public.profiles', 'whatsapp_number', 'SELECT') THEN
    RAISE EXCEPTION 'profiles contact columns are still readable; nothing was changed';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.profiles', 'full_name', 'SELECT') THEN
    RAISE EXCEPTION 'Signed-in users lost access to profiles.full_name; nothing was changed';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
