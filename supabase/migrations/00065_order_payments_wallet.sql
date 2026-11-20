-- Paying for orders, the manufacturer wallet (payouts), and factory visits.
--
-- A buyer pays for an order in one of two ways:
--   * online: the money is taken by BulkSkart through Razorpay (razorpay-create-order / razorpay-verify-payment) and
--     held for the buyer ('escrow') until the buyer confirms delivery and releases it. On release BulkSkart keeps its
--     commission (2%) and the rest goes to the manufacturer's wallet; the manufacturer asks for a payout and the
--     BulkSkart team transfers it to their bank. An admin can refund a held payment (order-refund function) or release
--     it after a dispute.
--   * at the factory: the buyer pays the manufacturer directly, and the manufacturer records it.
-- Buyers can also book a factory visit; the manufacturer confirms (at the asked or another time) or declines.
--
-- Money fields are written only by the functions below (or the payment functions with the service role, or an admin);
-- a browser cannot change a price, a payment state or a balance itself.

-- ── trusted writes ───────────────────────────────────────────────────────────
-- The functions in this file set bulkskart.trusted_write for their own transaction, so the protections below let
-- their changes through. The setting cannot be reached from the browser.
CREATE OR REPLACE FUNCTION public.may_change_protected_fields()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '') IS NULL
      OR coalesce(auth.role(), '') = 'service_role'
      OR coalesce(current_setting('bulkskart.trusted_write', true), '') = 'on'
      OR public.is_admin();
$$;

-- In-app notification from a trusted function; never stops the step it belongs to. Not callable from the browser.
CREATE OR REPLACE FUNCTION public.bulkskart_notify(p_user uuid, p_title text, p_message text, p_link text, p_ref uuid, p_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link, reference_id, reference_type)
    VALUES (p_user, p_title, p_message, p_type, p_link, p_ref, 'order');
  EXCEPTION WHEN undefined_column THEN
    INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (p_user, p_title, p_message, p_type, p_link);
  END;
EXCEPTION WHEN others THEN
  NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bulkskart_notify(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ── orders: payment columns ──────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status      text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS commission_pct      numeric(5,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS commission_amount   numeric(14,2),
  ADD COLUMN IF NOT EXISTS commission_status   text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method      text,
  ADD COLUMN IF NOT EXISTS paid_amount         numeric(14,2),
  ADD COLUMN IF NOT EXISTS paid_at             timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_order_id   text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS payout_amount       numeric(14,2),
  ADD COLUMN IF NOT EXISTS released_at         timestamptz,
  ADD COLUMN IF NOT EXISTS released_by         uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS refunded_at         timestamptz,
  ADD COLUMN IF NOT EXISTS refund_id           text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('online', 'at_factory'));
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- Every payment step, for both dashboards and the admins
CREATE TABLE IF NOT EXISTS public.order_payment_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event      text NOT NULL CHECK (event IN ('method_chosen', 'paid_online', 'paid_at_factory', 'released', 'refunded')),
  amount     numeric(14,2),
  actor_id   uuid,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_payment_events_order ON public.order_payment_events(order_id);
ALTER TABLE public.order_payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order parties read payment events" ON public.order_payment_events;
CREATE POLICY "Order parties read payment events" ON public.order_payment_events
  FOR SELECT USING (
    public.is_admin() OR order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.buyer_id = auth.uid()
         OR o.supplier_company_id IN (SELECT c.id FROM public.companies c WHERE c.owner_id = auth.uid())
    )
  );

-- ── orders: the price comes from the quotation, payment fields from the payment steps ──
CREATE OR REPLACE FUNCTION public.protect_order_money_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  q record;
  qty numeric;
  key text;
BEGIN
  IF public.may_change_protected_fields() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT qt.buyer_id, qt.supplier_id, qt.supplier_company_id, qt.unit_price, qt.currency, qt.status::text AS status,
           nullif(to_jsonb(qt) ->> 'total_price', '')::numeric AS total_price,
           nullif(to_jsonb(qt) ->> 'quantity', '')::numeric AS quantity,
           coalesce(nullif(to_jsonb(qt) ->> 'gst_percent', '')::numeric, 0) AS gst_percent
      INTO q
      FROM public.quotations qt
     WHERE qt.id = NEW.quotation_id;
    IF NOT FOUND OR q.buyer_id IS DISTINCT FROM NEW.buyer_id OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'An order can only be placed on a quotation sent to you';
    END IF;
    IF q.status <> 'accepted' THEN
      RAISE EXCEPTION 'Accept the quotation before placing the order';
    END IF;
    SELECT r.quantity INTO qty FROM public.requirements r WHERE r.id = NEW.requirement_id AND r.buyer_id = NEW.buyer_id;
    qty := coalesce(qty, q.quantity, NEW.quantity, 1);
    NEW.quantity := qty;
    NEW.supplier_company_id := q.supplier_company_id;
    NEW.supplier_id := q.supplier_id;
    NEW.currency := q.currency;
    -- The quotation's own total, else its unit price for the ordered quantity plus the quoted GST
    NEW.total_amount := coalesce(q.total_price, round(q.unit_price * qty * (1 + q.gst_percent / 100), 2));
    NEW.payment_status := 'pending';
    NEW.payment_method := NULL;
    NEW.paid_amount := NULL;
    NEW.paid_at := NULL;
    NEW.razorpay_order_id := NULL;
    NEW.razorpay_payment_id := NULL;
    NEW.payout_amount := NULL;
    NEW.released_at := NULL;
    NEW.released_by := NULL;
    NEW.refunded_at := NULL;
    NEW.refund_id := NULL;
    NEW.commission_pct := 2.00;
    NEW.commission_amount := NULL;
    NEW.commission_status := 'pending';
    RETURN NEW;
  END IF;

  FOREACH key IN ARRAY ARRAY[
    'quotation_id', 'buyer_id', 'supplier_company_id', 'supplier_id', 'total_amount', 'currency', 'quantity',
    'payment_status', 'payment_method', 'paid_amount', 'paid_at', 'razorpay_order_id', 'razorpay_payment_id',
    'payout_amount', 'released_at', 'released_by', 'refunded_at', 'refund_id',
    'commission_pct', 'commission_amount', 'commission_status'
  ] LOOP
    IF (to_jsonb(NEW) -> key) IS DISTINCT FROM (to_jsonb(OLD) -> key) THEN
      RAISE EXCEPTION 'The % of an order changes only through its payment steps', key;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_order_money_fields ON public.orders;
CREATE TRIGGER trg_protect_order_money_fields
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_order_money_fields();

-- Company balances are protected by migration 00064 (trg_protect_company_money_fields).

-- ── payouts ──────────────────────────────────────────────────────────────────
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS requested_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS admin_note       text,
  ADD COLUMN IF NOT EXISTS bank_snapshot    jsonb;

-- Owners read their requests; creating and settling go through request_payout / admin_resolve_payout
DROP POLICY IF EXISTS "Company members can manage own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Company owners read own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Company owners read own withdrawal requests" ON public.withdrawal_requests
  FOR SELECT USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- ── 1. buyer chooses how to pay ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.choose_order_payment_method(p_order_id uuid, p_method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  IF p_method NOT IN ('online', 'at_factory') THEN
    RAISE EXCEPTION 'Choose to pay online or at the factory';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF coalesce(o.payment_status, 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'This order is already paid';
  END IF;
  IF o.order_status = 'cancelled' THEN
    RAISE EXCEPTION 'This order is cancelled';
  END IF;
  PERFORM set_config('bulkskart.trusted_write', 'on', true);
  UPDATE public.orders SET payment_method = p_method WHERE id = o.id;
  INSERT INTO public.order_payment_events (order_id, event, actor_id, note) VALUES (o.id, 'method_chosen', auth.uid(), p_method);
  PERFORM public.bulkskart_notify(
    (SELECT owner_id FROM public.companies WHERE id = o.supplier_company_id),
    CASE WHEN p_method = 'online' THEN 'Buyer will pay online' ELSE 'Buyer will pay at your factory' END,
    'Order #' || o.order_number || CASE WHEN p_method = 'online'
      THEN ': the buyer will pay through BulkSkart. The money is held until they confirm delivery.'
      ELSE ': the buyer will pay you directly at the factory. Record the payment when you receive it.' END,
    '/dashboard/supplier/orders/' || o.id, o.id, 'order_payment');
END;
$$;

-- ── 2. manufacturer records a payment received at the factory ───────────────
CREATE OR REPLACE FUNCTION public.confirm_factory_payment(p_order_id uuid, p_amount numeric, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  amount numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.is_admin() OR o.supplier_company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF coalesce(o.payment_status, 'pending') <> 'pending' OR coalesce(o.payment_method, 'at_factory') <> 'at_factory' THEN
    RAISE EXCEPTION 'This order is not waiting for a payment at the factory';
  END IF;
  amount := coalesce(nullif(p_amount, 0), o.total_amount);
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount received';
  END IF;
  PERFORM set_config('bulkskart.trusted_write', 'on', true);
  UPDATE public.orders
     SET payment_method = 'at_factory', payment_status = 'paid', paid_amount = amount, paid_at = now(),
         commission_status = 'waived'
   WHERE id = o.id;
  INSERT INTO public.order_payment_events (order_id, event, amount, actor_id, note)
  VALUES (o.id, 'paid_at_factory', amount, auth.uid(), nullif(trim(coalesce(p_note, '')), ''));
  PERFORM public.bulkskart_notify(o.buyer_id, 'Payment recorded',
    'Order #' || o.order_number || ': the manufacturer recorded your payment of ' || o.currency || ' ' || amount || ' at the factory.',
    '/dashboard/buyer/orders/' || o.id, o.id, 'order_payment');
END;
$$;

-- ── 3. buyer (or an admin after a dispute) releases a held payment ───────────
CREATE OR REPLACE FUNCTION public.release_order_payment(p_order_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  admin boolean := public.is_admin();
  commission numeric;
  payout numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT (admin OR o.buyer_id = auth.uid()) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF o.payment_status IS DISTINCT FROM 'escrow' THEN
    RAISE EXCEPTION 'There is no held payment on this order';
  END IF;
  IF o.order_status = 'cancelled' THEN
    RAISE EXCEPTION 'This order is cancelled; the payment is refunded instead';
  END IF;
  IF NOT admin AND coalesce(o.order_status, 'pending') NOT IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION 'You can release the payment once the manufacturer has shipped the order';
  END IF;

  commission := round(o.paid_amount * coalesce(o.commission_pct, 2.00) / 100, 2);
  payout := o.paid_amount - commission;

  PERFORM set_config('bulkskart.trusted_write', 'on', true);
  UPDATE public.orders
     SET payment_status = 'released', released_at = now(), released_by = auth.uid(),
         commission_amount = commission, commission_status = 'collected', payout_amount = payout,
         order_status = CASE WHEN order_status = 'shipped' THEN 'delivered' ELSE order_status END
   WHERE id = o.id;
  IF o.order_status = 'shipped' THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, changer_role, notes)
    VALUES (o.id, 'shipped', 'delivered', auth.uid(), CASE WHEN admin THEN 'admin' ELSE 'buyer' END,
            'Delivery confirmed and payment released');
  END IF;
  UPDATE public.companies
     SET withdrawable_balance = coalesce(withdrawable_balance, 0) + payout,
         total_revenue = coalesce(total_revenue, 0) + payout
   WHERE id = o.supplier_company_id;
  INSERT INTO public.order_payment_events (order_id, event, amount, actor_id, note)
  VALUES (o.id, 'released', payout, auth.uid(), 'BulkSkart commission ' || commission);
  PERFORM public.bulkskart_notify(
    (SELECT owner_id FROM public.companies WHERE id = o.supplier_company_id),
    'Payment released to you',
    'Order #' || o.order_number || ': ' || o.currency || ' ' || payout || ' is now in your BulkSkart wallet (after the '
      || coalesce(o.commission_pct, 2.00) || '% BulkSkart commission).',
    '/dashboard/supplier/wallet', o.id, 'order_payment');
  RETURN payout;
END;
$$;

-- ── 4. manufacturer asks for a payout of their balance ───────────────────────
CREATE OR REPLACE FUNCTION public.request_payout(p_amount numeric, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  request_id uuid;
  admin_id uuid;
BEGIN
  SELECT id, company_name, withdrawable_balance, bank_account_name, bank_account_number, bank_ifsc, bank_name
    INTO c FROM public.companies WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register your company first';
  END IF;
  IF coalesce(trim(c.bank_account_number), '') = '' OR coalesce(trim(c.bank_ifsc), '') = '' THEN
    RAISE EXCEPTION 'Add your bank account (account number and IFSC) on the Verification page first';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount to pay out';
  END IF;
  IF p_amount > coalesce(c.withdrawable_balance, 0) THEN
    RAISE EXCEPTION 'You can pay out up to your balance of %', coalesce(c.withdrawable_balance, 0);
  END IF;
  PERFORM set_config('bulkskart.trusted_write', 'on', true);
  UPDATE public.companies SET withdrawable_balance = withdrawable_balance - p_amount WHERE id = c.id;
  INSERT INTO public.withdrawal_requests (company_id, amount, status, notes, requested_by, bank_snapshot)
  VALUES (c.id, p_amount, 'pending', nullif(trim(coalesce(p_note, '')), ''), auth.uid(),
          jsonb_build_object('account_name', c.bank_account_name, 'account_number', c.bank_account_number,
                             'ifsc', c.bank_ifsc, 'bank_name', c.bank_name))
  RETURNING id INTO request_id;
  FOR admin_id IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
    PERFORM public.bulkskart_notify(admin_id, 'Payout requested',
      coalesce(c.company_name, 'A manufacturer') || ' asked for a payout of INR ' || p_amount || '.',
      '/dashboard/admin/payments', request_id, 'payout');
  END LOOP;
  RETURN request_id;
END;
$$;

-- ── 5. admin marks a payout paid (with the bank reference) or rejects it ─────
CREATE OR REPLACE FUNCTION public.admin_resolve_payout(p_request_id uuid, p_approve boolean, p_reference text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins settle payouts';
  END IF;
  SELECT * INTO w FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR w.status <> 'pending' THEN
    RAISE EXCEPTION 'This payout is not waiting';
  END IF;
  IF p_approve AND coalesce(trim(p_reference), '') = '' THEN
    RAISE EXCEPTION 'Enter the bank transfer reference';
  END IF;
  PERFORM set_config('bulkskart.trusted_write', 'on', true);
  UPDATE public.withdrawal_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         processed_at = now(),
         payout_reference = CASE WHEN p_approve THEN trim(p_reference) ELSE NULL END,
         admin_note = nullif(trim(coalesce(p_note, '')), '')
   WHERE id = w.id;
  IF NOT p_approve THEN
    UPDATE public.companies SET withdrawable_balance = coalesce(withdrawable_balance, 0) + w.amount WHERE id = w.company_id;
  END IF;
  PERFORM public.bulkskart_notify(
    (SELECT owner_id FROM public.companies WHERE id = w.company_id),
    CASE WHEN p_approve THEN 'Payout sent' ELSE 'Payout not sent' END,
    CASE WHEN p_approve THEN 'INR ' || w.amount || ' was transferred to your bank. Reference: ' || trim(p_reference) || '.'
         ELSE 'Your payout of INR ' || w.amount || ' was not sent and is back in your balance.'
              || coalesce(' ' || nullif(trim(coalesce(p_note, '')), ''), '') END,
    '/dashboard/supplier/wallet', w.id, 'payout');
END;
$$;

-- ── factory visits ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.factory_visits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id          uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  requested_at      timestamptz NOT NULL,
  confirmed_at      timestamptz,
  visitors          integer NOT NULL DEFAULT 1 CHECK (visitors BETWEEN 1 AND 20),
  purpose           text,
  contact_phone     text,
  status            text NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'completed')),
  manufacturer_note text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_factory_visits_company ON public.factory_visits(company_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_factory_visits_buyer ON public.factory_visits(buyer_id, requested_at);
ALTER TABLE public.factory_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visit parties read visits" ON public.factory_visits;
CREATE POLICY "Visit parties read visits" ON public.factory_visits
  FOR SELECT USING (
    buyer_id = auth.uid()
    OR company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR public.is_admin()
  );
-- No insert or update policies: visits change only through the functions below.

CREATE OR REPLACE FUNCTION public.book_factory_visit(
  p_company_id uuid, p_when timestamptz, p_visitors integer, p_purpose text, p_phone text, p_order_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  visit_id uuid;
  open_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to book a visit';
  END IF;
  SELECT id, owner_id, company_name INTO c FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manufacturer not found';
  END IF;
  IF c.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'This is your own company';
  END IF;
  IF p_when IS NULL OR p_when < now() + interval '1 hour' OR p_when > now() + interval '180 days' THEN
    RAISE EXCEPTION 'Pick a time from an hour from now up to six months ahead';
  END IF;
  IF p_visitors IS NULL OR p_visitors < 1 OR p_visitors > 20 THEN
    RAISE EXCEPTION 'Between 1 and 20 people can visit';
  END IF;
  IF p_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = p_order_id AND buyer_id = auth.uid() AND supplier_company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'That order is not with this manufacturer';
  END IF;
  SELECT count(*) INTO open_count FROM public.factory_visits
   WHERE buyer_id = auth.uid() AND company_id = p_company_id AND status = 'requested';
  IF open_count >= 3 THEN
    RAISE EXCEPTION 'You already have 3 visit requests waiting with this manufacturer';
  END IF;
  INSERT INTO public.factory_visits (company_id, buyer_id, order_id, requested_at, visitors, purpose, contact_phone)
  VALUES (p_company_id, auth.uid(), p_order_id, p_when, p_visitors,
          left(nullif(trim(coalesce(p_purpose, '')), ''), 1000), left(nullif(trim(coalesce(p_phone, '')), ''), 30))
  RETURNING id INTO visit_id;
  PERFORM public.bulkskart_notify(c.owner_id, 'Factory visit request',
    'A buyer wants to visit on ' || to_char(p_when AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') || ' (IST). Confirm or suggest another time.',
    '/dashboard/supplier/visits', visit_id, 'factory_visit');
  RETURN visit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_factory_visit(p_visit_id uuid, p_action text, p_when timestamptz, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.factory_visits%ROWTYPE;
  final_time timestamptz;
BEGIN
  SELECT * INTO v FROM public.factory_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.is_admin() OR v.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;
  IF p_action = 'confirm' THEN
    IF v.status NOT IN ('requested', 'confirmed') THEN
      RAISE EXCEPTION 'This visit can no longer be confirmed';
    END IF;
    final_time := coalesce(p_when, v.requested_at);
    IF final_time < now() THEN
      RAISE EXCEPTION 'Pick a time in the future';
    END IF;
    UPDATE public.factory_visits
       SET status = 'confirmed', confirmed_at = final_time,
           manufacturer_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
     WHERE id = v.id;
    PERFORM public.bulkskart_notify(v.buyer_id, 'Factory visit confirmed',
      'Your visit is confirmed for ' || to_char(final_time AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') || ' (IST)'
        || CASE WHEN final_time <> v.requested_at THEN ', a different time from the one you asked for.' ELSE '.' END,
      '/dashboard/buyer/visits', v.id, 'factory_visit');
  ELSIF p_action = 'decline' THEN
    IF v.status NOT IN ('requested', 'confirmed') THEN
      RAISE EXCEPTION 'This visit can no longer be declined';
    END IF;
    UPDATE public.factory_visits
       SET status = 'declined', manufacturer_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
     WHERE id = v.id;
    PERFORM public.bulkskart_notify(v.buyer_id, 'Factory visit declined',
      'The manufacturer cannot host your visit.' || coalesce(' ' || nullif(trim(coalesce(p_note, '')), ''), ''),
      '/dashboard/buyer/visits', v.id, 'factory_visit');
  ELSIF p_action = 'complete' THEN
    IF v.status <> 'confirmed' THEN
      RAISE EXCEPTION 'Only a confirmed visit can be marked done';
    END IF;
    UPDATE public.factory_visits SET status = 'completed', updated_at = now() WHERE id = v.id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_factory_visit(p_visit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.factory_visits%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.factory_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND OR v.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;
  IF v.status NOT IN ('requested', 'confirmed') THEN
    RAISE EXCEPTION 'This visit is already closed';
  END IF;
  UPDATE public.factory_visits SET status = 'cancelled', updated_at = now() WHERE id = v.id;
  PERFORM public.bulkskart_notify((SELECT owner_id FROM public.companies WHERE id = v.company_id),
    'Factory visit cancelled', 'A buyer cancelled their visit.', '/dashboard/supplier/visits', v.id, 'factory_visit');
END;
$$;

REVOKE ALL ON FUNCTION public.choose_order_payment_method(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_factory_payment(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_order_payment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_payout(numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_payout(uuid, boolean, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.book_factory_visit(uuid, timestamptz, integer, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_factory_visit(uuid, text, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_factory_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_order_payment_method(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_factory_payment(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payout(uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_factory_visit(uuid, timestamptz, integer, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_factory_visit(uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_factory_visit(uuid) TO authenticated;
