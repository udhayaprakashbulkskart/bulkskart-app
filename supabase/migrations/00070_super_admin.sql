-- Super admin: the admins who decide who else is an admin.
--
-- Before this, admin rights could be taken without anyone's say:
--   * handle_new_user() gave the admin role to anyone who signed up with role "admin" in their sign-up data, which
--     any browser can send;
--   * profiles_update_own lets people update their own profile row, every column included, so a signed-in user could
--     set their own role to admin (or lift their own suspension).
--
-- After this:
--   * sign-up only ever creates buyers or suppliers;
--   * only a super admin can make someone an admin, remove an admin, or make/remove a super admin, through the
--     super_admin_* functions below (each change is written to admin_role_changes);
--   * people can still switch themselves between buyer and supplier (sign-up and company set-up do), admins can still
--     change buyers/suppliers and suspend accounts, but nobody can raise their own role or lift their own suspension;
--   * the Supabase SQL editor and server code (no signed-in user) can still change anything, which is how the first
--     super admin is made:
--       UPDATE profiles SET role = 'admin', is_super_admin = true WHERE email = 'you@example.com';
--
-- Safe to run again. Runs in one transaction.

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- 00069 lets visitors read only the profile columns granted to them; this column is not a secret
DO $$
BEGIN
  IF NOT has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    GRANT SELECT (is_super_admin) ON public.profiles TO anon;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_super_admin AND p.role = 'admin' FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;

-- ── Sign-up never grants admin ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  chosen_role public.user_role := 'buyer'::public.user_role;
  raw_role text;
  meta_full_name text;
BEGIN
  -- the sign-up data comes from the browser: it may choose buyer or supplier, never admin
  raw_role := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));
  IF raw_role IN ('supplier', 'manufacturer', 'seller') THEN
    chosen_role := 'supplier'::public.user_role;
  ELSE
    chosen_role := 'buyer'::public.user_role;
  END IF;

  meta_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
  VALUES (NEW.id, NEW.email, meta_full_name, chosen_role, 'active', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    -- a buyer who signed up as a supplier becomes one; an admin keeps their role
    role = CASE
      WHEN EXCLUDED.role = 'supplier'::public.user_role AND public.profiles.role = 'buyer'::public.user_role
        THEN EXCLUDED.role
      ELSE public.profiles.role
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ── Guard on profile rows ──────────────────────────────────────────────────────
-- Disallowed changes are quietly kept as they were (not raised), so ordinary saves that send the whole row still work.
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_super boolean;
  v_admin boolean;
BEGIN
  -- SQL editor, server code and sign-up run without a signed-in user: trusted
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;
  v_super := public.is_super_admin();
  v_admin := v_super OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_caller AND p.role = 'admin');

  IF TG_OP = 'INSERT' THEN
    IF NOT v_super THEN
      IF NEW.role = 'admin'::public.user_role THEN
        NEW.role := 'buyer'::public.user_role;
      END IF;
      NEW.is_super_admin := false;
    END IF;
    RETURN NEW;
  END IF;

  -- admin rights: given and taken only by super admins
  IF NOT v_super THEN
    IF (NEW.role = 'admin'::public.user_role) IS DISTINCT FROM (OLD.role = 'admin'::public.user_role) THEN
      NEW.role := OLD.role;
    END IF;
    NEW.is_super_admin := OLD.is_super_admin;
  END IF;
  -- account status (suspension): only admins change it, never on their own account... except super admins
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_admin THEN
    NEW.status := OLD.status;
  END IF;
  -- someone else's buyer/supplier role: only admins
  IF NEW.role IS DISTINCT FROM OLD.role AND OLD.id <> v_caller AND NOT v_admin THEN
    NEW.role := OLD.role;
  END IF;
  -- a super admin flag only on admins
  IF NEW.is_super_admin AND NEW.role <> 'admin'::public.user_role THEN
    NEW.is_super_admin := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ── Who changed whose rights ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_role_changes (
  id bigserial PRIMARY KEY,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  change text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_role_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_role_changes_super_select ON public.admin_role_changes;
CREATE POLICY admin_role_changes_super_select ON public.admin_role_changes FOR SELECT USING (public.is_super_admin());

-- ── Functions for the Super Admin page ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.super_admin_list_admins()
RETURNS TABLE (id uuid, email text, full_name text, role text, is_super_admin boolean, status text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'super_admin_only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email::text, p.full_name::text, p.role::text, p.is_super_admin, p.status::text, p.created_at
      FROM public.profiles p
     WHERE p.role = 'admin'::public.user_role OR p.is_super_admin
     ORDER BY p.is_super_admin DESC, p.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_search_users(p_query text)
RETURNS TABLE (id uuid, email text, full_name text, role text, is_super_admin boolean, status text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := btrim(coalesce(p_query, ''));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'super_admin_only' USING ERRCODE = '42501';
  END IF;
  IF length(q) < 3 THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.email::text, p.full_name::text, p.role::text, p.is_super_admin, p.status::text, p.created_at
      FROM public.profiles p
     WHERE p.email ILIKE '%' || q || '%' OR p.full_name ILIKE '%' || q || '%'
     ORDER BY (lower(p.email) = lower(q)) DESC, p.created_at DESC
     LIMIT 20;
END;
$$;

-- p_role: 'admin' gives admin rights; 'buyer' or 'supplier' takes them away (and the super admin flag with them)
CREATE OR REPLACE FUNCTION public.super_admin_set_role(p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'super_admin_only' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('buyer', 'supplier', 'admin') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;
  IF p_user = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'cannot_remove_own_admin' USING ERRCODE = '42501';
  END IF;
  SELECT role::text AS role, is_super_admin INTO v_old FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_old.role = p_role THEN
    RETURN;
  END IF;
  UPDATE public.profiles
     SET role = p_role::public.user_role,
         is_super_admin = CASE WHEN p_role = 'admin' THEN is_super_admin ELSE false END,
         updated_at = now()
   WHERE id = p_user;
  INSERT INTO public.admin_role_changes (changed_by, user_id, change)
  VALUES (auth.uid(), p_user, format('role %s -> %s', v_old.role, p_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_set_super(p_user uuid, p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'super_admin_only' USING ERRCODE = '42501';
  END IF;
  SELECT role::text INTO v_role FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_on AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'make_admin_first' USING ERRCODE = '22023';
  END IF;
  IF NOT p_on AND (SELECT count(*) FROM public.profiles WHERE is_super_admin AND role = 'admin' AND id <> p_user) = 0 THEN
    RAISE EXCEPTION 'last_super_admin' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET is_super_admin = p_on, updated_at = now() WHERE id = p_user;
  INSERT INTO public.admin_role_changes (changed_by, user_id, change)
  VALUES (auth.uid(), p_user, CASE WHEN p_on THEN 'super admin on' ELSE 'super admin off' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_recent_changes()
RETURNS TABLE (created_at timestamptz, changed_by_email text, user_email text, change text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'super_admin_only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.created_at, b.email::text, u.email::text, c.change
      FROM public.admin_role_changes c
      LEFT JOIN public.profiles b ON b.id = c.changed_by
      LEFT JOIN public.profiles u ON u.id = c.user_id
     ORDER BY c.created_at DESC
     LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_list_admins() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_search_users(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_set_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_set_super(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_recent_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_list_admins() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_search_users(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_set_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_set_super(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_recent_changes() TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
