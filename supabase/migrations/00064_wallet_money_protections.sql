-- Wallet balances move only through payments and payouts, never straight from the browser.
--
-- A manufacturer's wallet (companies.withdrawable_balance and friends) is filled when a buyer's held payment is
-- released, and emptied by payout requests. Those steps run in the database functions of migration 00065 (or the
-- payment functions with the service role, or an admin). Requests made with a user's sign-in cannot change a balance;
-- the service role, admins and direct SQL sessions (no request JWT, e.g. the SQL editor) can.

CREATE OR REPLACE FUNCTION public.may_change_protected_fields()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '') IS NULL
      OR coalesce(auth.role(), '') = 'service_role'
      OR coalesce(current_setting('bulkskart.trusted_write', true), '') = 'on'
      OR public.is_admin();
$$;

-- Compared through jsonb so a column that a database does not have is simply skipped.
CREATE OR REPLACE FUNCTION public.protect_company_money_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  key text;
BEGIN
  IF public.may_change_protected_fields() THEN
    RETURN NEW;
  END IF;
  FOREACH key IN ARRAY ARRAY['wallet_balance', 'withdrawable_balance', 'total_revenue', 'commission_balance'] LOOP
    IF TG_OP = 'UPDATE' AND (new_row -> key) IS DISTINCT FROM (old_row -> key) THEN
      RAISE EXCEPTION 'The % changes only through payments and payouts', key;
    END IF;
    IF TG_OP = 'INSERT' AND coalesce(nullif(new_row ->> key, '')::numeric, 0) <> 0 THEN
      RAISE EXCEPTION 'A new company starts with no % ', key;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_money_fields ON public.companies;
CREATE TRIGGER trg_protect_company_money_fields
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_money_fields();
