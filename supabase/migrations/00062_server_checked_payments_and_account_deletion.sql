-- Payments and paid features are decided by the server, and accounts can be deleted for real.
--
-- 1. Auction posting fees are paid against a Razorpay order the server creates at a price it sets. The auction is
--    published by the razorpay-verify-payment function only after the payment signature checks out, so browsers no
--    longer insert auctions themselves.
-- 2. Subscriptions, verification and paid listing flags can only be granted by the payment functions (service role)
--    or an admin. Before this, a signed-in owner could write these rows straight from the browser.
-- 3. Add-on orders (AI Accessibility, 24 Hours Sell Products) can be recorded; the old check allowed plan names only.
-- 4. Accounts deleted with the delete-account function are marked 'deleted', and the reason is kept for the admins.
--
-- Requests made with a user's sign-in pass through the checks below; the service role, admins and direct SQL
-- sessions (no request JWT, e.g. the SQL editor) do not.

-- ── who may change protected fields ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.may_change_protected_fields()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '') IS NULL
      OR coalesce(auth.role(), '') = 'service_role'
      OR public.is_admin();
$$;

-- ── 1. auction posting fees ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_fee_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_order_id   text NOT NULL UNIQUE,
  razorpay_payment_id text,
  amount_paise        integer NOT NULL CHECK (amount_paise > 0),
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  auction_draft       jsonb NOT NULL,
  auction_id          uuid REFERENCES public.auctions(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);
CREATE INDEX IF NOT EXISTS idx_auction_fee_orders_user ON public.auction_fee_orders(user_id);

ALTER TABLE public.auction_fee_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own auction fee orders" ON public.auction_fee_orders;
CREATE POLICY "Users read their own auction fee orders" ON public.auction_fee_orders
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
-- No insert or update policies: only the payment functions (service role) write here.

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS fee_order_id   text,
  ADD COLUMN IF NOT EXISTS fee_payment_id text,
  ADD COLUMN IF NOT EXISTS fee_paid_at    timestamptz;

DROP POLICY IF EXISTS "Authenticated users can create auctions" ON public.auctions;
DROP POLICY IF EXISTS "Admins can create auctions" ON public.auctions;
CREATE POLICY "Admins can create auctions" ON public.auctions
  FOR INSERT WITH CHECK (public.is_admin());

-- Sellers may still edit their lots, but not the record of the fee they paid.
CREATE OR REPLACE FUNCTION public.protect_auction_fee_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF public.may_change_protected_fields() THEN
    RETURN NEW;
  END IF;
  IF NEW.fee_order_id IS DISTINCT FROM OLD.fee_order_id
     OR NEW.fee_payment_id IS DISTINCT FROM OLD.fee_payment_id
     OR NEW.fee_paid_at IS DISTINCT FROM OLD.fee_paid_at THEN
    RAISE EXCEPTION 'The posting fee record of an auction is kept by the payment service';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_auction_fee_record ON public.auctions;
CREATE TRIGGER trg_protect_auction_fee_record
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.protect_auction_fee_record();

-- ── 2a. subscriptions: granted by payment, not by the browser ────────────────
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
DROP POLICY IF EXISTS "Company owner can insert subscription" ON public.subscriptions;

-- Owners keep update rights only so the RFQ-response counter can go up as they use their plan.
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF public.may_change_protected_fields() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'used_rfq_leads' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'used_rfq_leads' - 'updated_at') THEN
    RAISE EXCEPTION 'A subscription can only be changed by a payment or an admin';
  END IF;
  IF coalesce(NEW.used_rfq_leads, 0) < coalesce(OLD.used_rfq_leads, 0) THEN
    RAISE EXCEPTION 'Used RFQ responses cannot go down';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_subscription_fields ON public.subscriptions;
CREATE TRIGGER trg_protect_subscription_fields
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_fields();

-- ── 2b. companies: verification and paid flags ───────────────────────────────
-- Compared through jsonb so a column that a database does not have is simply skipped.
CREATE OR REPLACE FUNCTION public.protect_company_paid_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  key text;
BEGIN
  IF public.may_change_protected_fields() THEN
    RETURN NEW;
  END IF;
  -- owners may submit documents (pending) or step back to unverified, nothing else
  IF (TG_OP = 'INSERT' OR (new_row -> 'verification_status') IS DISTINCT FROM (old_row -> 'verification_status'))
     AND coalesce(new_row ->> 'verification_status', 'unverified') NOT IN ('unverified', 'pending') THEN
    RAISE EXCEPTION 'Verification is granted by the BulkSkart team';
  END IF;
  -- paid or admin-only flags may be switched off, never on
  FOREACH key IN ARRAY ARRAY['is_featured', 'is_verified', 'has_ai_access'] LOOP
    IF (new_row -> key) IS DISTINCT FROM (old_row -> key)
       AND coalesce(new_row ->> key, 'false') NOT IN ('false') THEN
      RAISE EXCEPTION 'The % flag is set by a payment or an admin', key;
    END IF;
  END LOOP;
  FOREACH key IN ARRAY ARRAY['verified_at', 'flash_sell_until'] LOOP
    IF (new_row -> key) IS DISTINCT FROM (old_row -> key)
       AND new_row ? key AND jsonb_typeof(new_row -> key) <> 'null' THEN
      RAISE EXCEPTION 'The % field is set by a payment or an admin', key;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_company_paid_fields ON public.companies;
CREATE TRIGGER trg_protect_company_paid_fields
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_paid_fields();

-- ── 2c. products: promotion flags come with a paid promotion ─────────────────
CREATE OR REPLACE FUNCTION public.protect_product_promotion_flags()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  key text;
BEGIN
  IF public.may_change_protected_fields() THEN
    RETURN NEW;
  END IF;
  FOREACH key IN ARRAY ARRAY['is_featured', 'is_sponsored', 'is_promoted'] LOOP
    IF (new_row -> key) IS DISTINCT FROM (old_row -> key)
       AND coalesce(new_row ->> key, 'false') NOT IN ('false') THEN
      RAISE EXCEPTION 'The % flag comes with a paid promotion', key;
    END IF;
  END LOOP;
  IF (new_row -> 'promotion_type') IS DISTINCT FROM (old_row -> 'promotion_type')
     AND new_row ? 'promotion_type' AND jsonb_typeof(new_row -> 'promotion_type') <> 'null' THEN
    RAISE EXCEPTION 'The promotion type comes with a paid promotion';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_product_promotion_flags ON public.products;
CREATE TRIGGER trg_protect_product_promotion_flags
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_promotion_flags();

-- ── 3. add-on orders ─────────────────────────────────────────────────────────
ALTER TABLE public.subscription_orders DROP CONSTRAINT IF EXISTS subscription_orders_plan_tier_check;
ALTER TABLE public.subscription_orders ADD CONSTRAINT subscription_orders_plan_tier_check
  CHECK (plan_tier IN ('starter', 'business', 'growth', 'enterprise', 'ai_accessibility', 'flash_sell_24h'));

-- ── 4. account deletion ──────────────────────────────────────────────────────
ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'deleted';

CREATE TABLE IF NOT EXISTS public.account_deletions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  role       text,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read account deletions" ON public.account_deletions;
CREATE POLICY "Admins read account deletions" ON public.account_deletions
  FOR SELECT USING (public.is_admin());
