-- BulkSkart Business Credit for paid manufacturers (needs 00076_loan_kyc.sql).
--
-- Workflow: check eligibility → choose amount → KYC and business verification → submit → BulkSkart checks platform
-- eligibility → sent to a regulated lending partner (bank / NBFC) → the LENDER approves or rejects → the lender's Key Fact
-- Statement (KFS) and loan agreement are shown → the supplier accepts → the supplier asks for money → the LENDER pays
-- it into the supplier's verified bank account → repayment schedule and payments from the lender.
--
-- Rules enforced here:
--   • BulkSkart is not the lender and never holds the money. An application is "approved", an amount "approved" and money
--     "withdrawable" only after the lending partner's decision is recorded with the lender's own reference: by the
--     partner's signed webhook, or by an admin copying it from the lender.
--   • Money is "withdrawable" only after the supplier accepted the lender's KFS and agreement. A withdrawal is only a
--     request: it is "disbursed" only when the lender confirms the payment with a UTR.
--   • "0% interest" is shown only for a product whose 0% rate was confirmed by the partner, with the confirmation recorded.
--   • Suppliers read their own rows and write nothing directly. Every change goes through a function that checks the
--     caller and writes credit_audit_logs (append-only).
--
-- One transaction; safe to run again.

BEGIN;

-- ── lending partners and their products (admin-managed) ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lending_partners (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{1,30}$'),   -- used for the webhook secret name
  name                    text NOT NULL CHECK (char_length(btrim(name)) >= 2),
  legal_name              text NOT NULL CHECK (char_length(btrim(legal_name)) >= 2),
  entity_type             text NOT NULL CHECK (entity_type IN ('bank', 'nbfc')),
  rbi_registration_no     text,                    -- NBFC certificate of registration / bank licence reference
  grievance_officer_name  text,
  grievance_email         text,
  grievance_phone         text,
  website                 text,
  integration_mode        text NOT NULL DEFAULT 'manual' CHECK (integration_mode IN ('manual', 'api')),
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- a partner can go live only with its regulator details and grievance officer (shown to borrowers)
  CONSTRAINT lending_partners_live_ck CHECK (status <> 'active' OR (char_length(coalesce(rbi_registration_no, '')) >= 3
    AND char_length(coalesce(grievance_officer_name, '')) >= 2 AND grievance_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
);

CREATE TABLE IF NOT EXISTS public.credit_products (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id              uuid NOT NULL REFERENCES public.lending_partners(id),
  name                    text NOT NULL,
  min_amount              numeric(14,2) NOT NULL DEFAULT 50000 CHECK (min_amount > 0),
  max_amount              numeric(14,2) NOT NULL DEFAULT 1500000 CHECK (max_amount <= 100000000),
  tenure_months           integer NOT NULL DEFAULT 12 CHECK (tenure_months BETWEEN 1 AND 120),
  interest_rate_pct       numeric(6,3) CHECK (interest_rate_pct IS NULL OR interest_rate_pct BETWEEN 0 AND 60),
  rate_confirmed_at       timestamptz,             -- when the partner confirmed the rate in writing
  rate_confirmation_ref   text,                    -- the partner's letter / email reference
  processing_fee_pct      numeric(6,3) CHECK (processing_fee_pct IS NULL OR processing_fee_pct BETWEEN 0 AND 10),
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_products_range_ck CHECK (min_amount <= max_amount),
  CONSTRAINT credit_products_rate_ck CHECK (rate_confirmed_at IS NULL OR (interest_rate_pct IS NOT NULL AND char_length(coalesce(rate_confirmation_ref, '')) >= 3))
);

-- ── per-supplier limits ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_limits (
  user_id             uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform_cap        numeric(14,2) CHECK (platform_cap IS NULL OR platform_cap >= 0),   -- BulkSkart's cap on what may be applied for
  sanctioned_limit    numeric(14,2) CHECK (sanctioned_limit IS NULL OR sanctioned_limit >= 0),  -- set only from a lender decision
  partner_id          uuid REFERENCES public.lending_partners(id),
  lender_reference    text,
  sanctioned_at       timestamptz,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  notes               text,
  updated_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_limits_sanction_ck CHECK (sanctioned_limit IS NULL OR (partner_id IS NOT NULL AND char_length(coalesce(lender_reference, '')) >= 3))
);

-- ── applications ───────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_applications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id              uuid,
  product_id              uuid REFERENCES public.credit_products(id),
  partner_id              uuid REFERENCES public.lending_partners(id),
  requested_amount        numeric(14,2) NOT NULL CHECK (requested_amount > 0),
  tenure_months           integer NOT NULL DEFAULT 12 CHECK (tenure_months BETWEEN 1 AND 120),
  purpose                 text CHECK (char_length(coalesce(purpose, '')) <= 300),
  stage                   text NOT NULL DEFAULT 'draft' CHECK (stage IN ('draft', 'submitted', 'platform_approved', 'platform_rejected',
                            'with_lender', 'lender_approved', 'lender_rejected', 'agreement_accepted', 'active', 'closed', 'cancelled')),
  share_consent_at        timestamptz,
  eligibility_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at            timestamptz,
  platform_note           text,
  platform_decided_at     timestamptz,
  platform_decided_by     uuid,
  sent_to_lender_at       timestamptz,
  lender_reference        text,
  lender_decision         text CHECK (lender_decision IN ('approved', 'rejected')),
  lender_decision_source  text CHECK (lender_decision_source IN ('lender_api', 'admin_from_lender')),
  lender_decided_at       timestamptz,
  lender_note             text,
  approved_amount         numeric(14,2) CHECK (approved_amount IS NULL OR approved_amount > 0),
  kfs                     jsonb,                   -- the lender's Key Fact Statement, as issued
  kfs_sha256              text,
  agreement_url           text CHECK (agreement_url IS NULL OR agreement_url ~ '^https://'),
  agreement_accepted_at   timestamptz,
  agreement_kfs_sha256    text,                    -- the KFS version the supplier accepted
  closed_at               timestamptz,
  cancelled_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- money is "approved" only by a lender decision carrying the lender's reference
  CONSTRAINT credit_applications_lender_ck CHECK (
    (approved_amount IS NULL OR (lender_decision = 'approved' AND char_length(coalesce(lender_reference, '')) >= 3 AND lender_decision_source IS NOT NULL AND kfs IS NOT NULL))
    AND (stage NOT IN ('lender_approved', 'agreement_accepted', 'active', 'closed') OR approved_amount IS NOT NULL OR stage = 'closed' AND lender_decision IS DISTINCT FROM 'approved')
    AND (stage NOT IN ('agreement_accepted', 'active') OR agreement_accepted_at IS NOT NULL)
    AND (stage NOT IN ('with_lender', 'lender_approved', 'lender_rejected', 'agreement_accepted', 'active') OR (partner_id IS NOT NULL AND share_consent_at IS NOT NULL)))
);
CREATE INDEX IF NOT EXISTS credit_applications_user_idx ON public.credit_applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_applications_stage_idx ON public.credit_applications (stage, updated_at DESC);
-- one open application per supplier
CREATE UNIQUE INDEX IF NOT EXISTS credit_applications_one_open_idx ON public.credit_applications (user_id)
  WHERE stage NOT IN ('platform_rejected', 'lender_rejected', 'closed', 'cancelled');

-- ── lender documents (KFS, agreement, sanction letter): encrypted in the kyc-documents bucket ───────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('kfs', 'loan_agreement', 'sanction_letter', 'other')),
  file_name       text NOT NULL,
  mime_type       text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes      integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256          text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path    text NOT NULL UNIQUE,
  enc_iv          text NOT NULL,
  enc_key_id      text NOT NULL,
  uploaded_by     uuid,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

-- ── withdrawals (disbursement requests; paid by the lender into the verified bank account) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_disbursements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      uuid NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  status              text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'sent_to_lender', 'disbursed', 'failed', 'cancelled')),
  bank_account_last4  text NOT NULL,
  bank_ifsc           text NOT NULL,
  utr                 text,
  lender_reference    text,
  source              text CHECK (source IN ('lender_api', 'admin_from_lender')),
  note                text,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  disbursed_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_disbursements_paid_ck CHECK (status <> 'disbursed' OR (char_length(coalesce(utr, '')) >= 6 AND disbursed_at IS NOT NULL AND source IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS credit_disbursements_app_idx ON public.credit_disbursements (application_id, requested_at DESC);

-- ── repayment schedule and payments (from the lender) ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_repayment_schedule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  installment_no  integer NOT NULL CHECK (installment_no BETWEEN 1 AND 360),
  due_date        date NOT NULL,
  principal       numeric(14,2) NOT NULL CHECK (principal >= 0),
  interest        numeric(14,2) NOT NULL CHECK (interest >= 0),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  paid_at         timestamptz,
  UNIQUE (application_id, installment_no),
  CONSTRAINT credit_schedule_sum_ck CHECK (abs(amount - principal - interest) < 0.02 AND paid_amount <= amount + 0.01)
);

CREATE TABLE IF NOT EXISTS public.credit_repayments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_at         timestamptz NOT NULL,
  method          text NOT NULL CHECK (method IN ('nach', 'upi', 'neft', 'rtgs', 'imps', 'cheque', 'other')),
  reference       text NOT NULL CHECK (char_length(reference) >= 4),
  source          text NOT NULL CHECK (source IN ('lender_api', 'admin_from_lender')),
  recorded_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, reference)
);

-- ── webhook events (idempotency) and audit log ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_webhook_events (
  event_id      text PRIMARY KEY,
  partner_id    uuid NOT NULL REFERENCES public.lending_partners(id),
  event_type    text NOT NULL,
  application_id uuid,
  result        text NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_audit_logs (
  id              bigserial PRIMARY KEY,
  application_id  uuid,                 -- no foreign keys: the log outlives deleted rows and is never updated
  subject_user_id uuid,
  actor_id        uuid,
  actor_role      text NOT NULL CHECK (actor_role IN ('supplier', 'admin', 'lender', 'system')),
  action          text NOT NULL,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_audit_logs_subject_idx ON public.credit_audit_logs (subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_audit_logs_app_idx ON public.credit_audit_logs (application_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.credit_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'credit_audit_logs is append-only';
END $$;
DROP TRIGGER IF EXISTS credit_audit_logs_no_change ON public.credit_audit_logs;
CREATE TRIGGER credit_audit_logs_no_change BEFORE UPDATE OR DELETE ON public.credit_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.credit_audit_append_only();

-- ── access ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lending_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_repayment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lending_partners, public.credit_products, public.credit_limits, public.credit_applications, public.credit_documents,
  public.credit_disbursements, public.credit_repayment_schedule, public.credit_repayments, public.credit_webhook_events,
  public.credit_audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.credit_audit_logs_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.lending_partners, public.credit_products, public.credit_limits, public.credit_applications, public.credit_documents,
  public.credit_disbursements, public.credit_repayment_schedule, public.credit_repayments, public.credit_audit_logs TO authenticated;
GRANT SELECT ON public.credit_webhook_events TO authenticated;

DROP POLICY IF EXISTS lending_partners_read ON public.lending_partners;
CREATE POLICY lending_partners_read ON public.lending_partners FOR SELECT TO authenticated USING (status = 'active' OR public.is_admin());
DROP POLICY IF EXISTS credit_products_read ON public.credit_products;
CREATE POLICY credit_products_read ON public.credit_products FOR SELECT TO authenticated USING (status = 'active' OR public.is_admin());
DROP POLICY IF EXISTS credit_limits_read ON public.credit_limits;
CREATE POLICY credit_limits_read ON public.credit_limits FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS credit_applications_read ON public.credit_applications;
CREATE POLICY credit_applications_read ON public.credit_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS credit_documents_read ON public.credit_documents;
CREATE POLICY credit_documents_read ON public.credit_documents FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS credit_disbursements_read ON public.credit_disbursements;
CREATE POLICY credit_disbursements_read ON public.credit_disbursements FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS credit_schedule_read ON public.credit_repayment_schedule;
CREATE POLICY credit_schedule_read ON public.credit_repayment_schedule FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.credit_applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS credit_repayments_read ON public.credit_repayments;
CREATE POLICY credit_repayments_read ON public.credit_repayments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS credit_webhook_events_read ON public.credit_webhook_events;
CREATE POLICY credit_webhook_events_read ON public.credit_webhook_events FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS credit_audit_logs_read ON public.credit_audit_logs;
CREATE POLICY credit_audit_logs_read ON public.credit_audit_logs FOR SELECT TO authenticated USING (subject_user_id = auth.uid() OR public.is_admin());

-- ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_log(p_app uuid, p_subject uuid, p_actor uuid, p_role text, p_action text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.credit_audit_logs (application_id, subject_user_id, actor_id, actor_role, action, detail)
  VALUES (p_app, p_subject, p_actor, p_role, p_action, coalesce(p_detail, '{}'::jsonb));
$$;

-- The five eligibility checks for a supplier, computed from the live records.
CREATE OR REPLACE FUNCTION public.credit_checks(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'subscription', EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role = 'supplier') AND coalesce(public.is_supplier_subscribed(p_user), false),
    'kyc', EXISTS (SELECT 1 FROM public.kyc_profiles WHERE user_id = p_user AND status = 'verified'),
    'business', EXISTS (SELECT 1 FROM public.companies WHERE owner_id = p_user AND verification_status::text = 'verified'),
    'bank', EXISTS (SELECT 1 FROM public.bank_verifications WHERE user_id = p_user AND is_current AND status = 'verified'),
    'lender', EXISTS (SELECT 1 FROM public.credit_applications WHERE user_id = p_user AND lender_decision = 'approved' AND stage <> 'cancelled')
              OR EXISTS (SELECT 1 FROM public.credit_limits WHERE user_id = p_user AND coalesce(sanctioned_limit, 0) > 0 AND status = 'active'));
$$;

CREATE OR REPLACE FUNCTION public.credit_platform_ok(p_checks jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((p_checks->>'subscription')::boolean, false) AND coalesce((p_checks->>'kyc')::boolean, false)
     AND coalesce((p_checks->>'business')::boolean, false) AND coalesce((p_checks->>'bank')::boolean, false);
$$;

-- The live product: the active product of an active partner (at most one is used; the newest).
CREATE OR REPLACE FUNCTION public.credit_live_product() RETURNS public.credit_products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.credit_products p JOIN public.lending_partners l ON l.id = p.partner_id
  WHERE p.status = 'active' AND l.status = 'active' ORDER BY p.updated_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.credit_drawn(p_app uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(amount), 0) FROM public.credit_disbursements WHERE application_id = p_app AND status IN ('requested', 'sent_to_lender', 'disbursed');
$$;

-- Withdrawable: approved by the lender, agreement accepted, minus what is already asked for or paid out.
CREATE OR REPLACE FUNCTION public.credit_withdrawable(p_app uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN a.stage IN ('agreement_accepted', 'active') AND a.lender_decision = 'approved' AND a.agreement_accepted_at IS NOT NULL
              AND coalesce(l.status, 'active') = 'active'
              THEN greatest(a.approved_amount - public.credit_drawn(a.id), 0) ELSE 0 END
  FROM public.credit_applications a LEFT JOIN public.credit_limits l ON l.user_id = a.user_id WHERE a.id = p_app;
$$;

-- Default program values when no lending partner is live yet (shown as "up to", subject to the lender).
CREATE OR REPLACE FUNCTION public.credit_program() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.credit_products; pa public.lending_partners;
BEGIN
  pr := public.credit_live_product();
  IF pr.id IS NULL THEN
    RETURN jsonb_build_object('live', false, 'max_amount', 1500000, 'min_amount', 50000, 'tenure_months', 12, 'zero_interest_confirmed', false);
  END IF;
  SELECT * INTO pa FROM public.lending_partners WHERE id = pr.partner_id;
  RETURN jsonb_build_object('live', true, 'product_id', pr.id, 'product_name', pr.name, 'max_amount', pr.max_amount, 'min_amount', pr.min_amount,
    'tenure_months', pr.tenure_months, 'interest_rate_pct', CASE WHEN pr.rate_confirmed_at IS NOT NULL THEN pr.interest_rate_pct END,
    'zero_interest_confirmed', pr.rate_confirmed_at IS NOT NULL AND pr.interest_rate_pct = 0,
    'processing_fee_pct', pr.processing_fee_pct,
    'partner', jsonb_build_object('name', pa.name, 'legal_name', pa.legal_name, 'entity_type', pa.entity_type, 'rbi_registration_no', pa.rbi_registration_no,
                                  'grievance_officer_name', pa.grievance_officer_name, 'grievance_email', pa.grievance_email,
                                  'grievance_phone', pa.grievance_phone, 'website', pa.website));
END $$;

-- ── supplier functions ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_my_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  checks jsonb;
  prog jsonb;
  lim public.credit_limits;
  cap numeric;
  outstanding numeric;
  next_due date;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  checks := public.credit_checks(me);
  prog := public.credit_program();
  SELECT * INTO lim FROM public.credit_limits WHERE user_id = me;
  cap := least((prog->>'max_amount')::numeric, coalesce(lim.platform_cap, (prog->>'max_amount')::numeric));
  SELECT coalesce(sum(s.amount - s.paid_amount), 0), min(s.due_date) FILTER (WHERE s.paid_amount < s.amount)
    INTO outstanding, next_due
    FROM public.credit_repayment_schedule s JOIN public.credit_applications a ON a.id = s.application_id
   WHERE a.user_id = me AND a.stage IN ('active', 'agreement_accepted');
  RETURN jsonb_build_object(
    'checks', checks,
    'program', prog,
    'limit', CASE WHEN lim.user_id IS NULL THEN NULL ELSE jsonb_build_object('status', lim.status, 'sanctioned_limit', lim.sanctioned_limit, 'platform_cap', lim.platform_cap, 'sanctioned_at', lim.sanctioned_at) END,
    -- what the supplier may apply for (not an approval)
    'eligible_amount', CASE WHEN public.credit_platform_ok(checks) AND coalesce(lim.status, 'active') = 'active' THEN cap ELSE 0 END,
    -- sanctioned by the lender and not yet drawn (requested or paid out); only after a lender decision
    'available_limit', CASE WHEN coalesce(lim.sanctioned_limit, 0) > 0 AND lim.status = 'active'
                            THEN greatest(lim.sanctioned_limit - coalesce((SELECT sum(public.credit_drawn(a.id)) FROM public.credit_applications a
                                   WHERE a.user_id = me AND a.stage IN ('lender_approved', 'agreement_accepted', 'active')), 0), 0)
                            ELSE NULL END,
    'outstanding', outstanding,
    'next_emi_date', next_due,
    'applications', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'application', to_jsonb(a) - 'eligibility_snapshot',
        'withdrawable', public.credit_withdrawable(a.id),
        'drawn', public.credit_drawn(a.id),
        'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'file_name', d.file_name, 'uploaded_at', d.uploaded_at) ORDER BY d.uploaded_at)
                               FROM public.credit_documents d WHERE d.application_id = a.id), '[]'::jsonb),
        'disbursements', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.requested_at DESC) FROM public.credit_disbursements x WHERE x.application_id = a.id), '[]'::jsonb),
        'schedule', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.installment_no) FROM public.credit_repayment_schedule s WHERE s.application_id = a.id), '[]'::jsonb),
        'repayments', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.paid_at DESC) FROM public.credit_repayments r WHERE r.application_id = a.id), '[]'::jsonb))
      ORDER BY a.created_at DESC) FROM public.credit_applications a WHERE a.user_id = me), '[]'::jsonb),
    'bank', (SELECT jsonb_build_object('last4', b.account_last4, 'ifsc', b.ifsc, 'bank_name', b.bank_name, 'status', b.status)
             FROM public.bank_verifications b WHERE b.user_id = me AND b.is_current),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('action', l.action, 'actor_role', l.actor_role, 'detail', l.detail - 'note_internal', 'created_at', l.created_at) ORDER BY l.created_at DESC)
                         FROM (SELECT * FROM public.credit_audit_logs WHERE subject_user_id = me ORDER BY created_at DESC LIMIT 60) l), '[]'::jsonb));
END $$;

-- Choose (or change) the amount: a draft application.
CREATE OR REPLACE FUNCTION public.credit_save_draft(p_amount numeric, p_purpose text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); prog jsonb; lim public.credit_limits; cap numeric; a public.credit_applications; cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = me AND role = 'supplier') THEN RAISE EXCEPTION 'suppliers_only'; END IF;
  prog := public.credit_program();
  SELECT * INTO lim FROM public.credit_limits WHERE user_id = me;
  IF lim.status = 'suspended' THEN RAISE EXCEPTION 'credit_suspended'; END IF;
  cap := least((prog->>'max_amount')::numeric, coalesce(lim.platform_cap, (prog->>'max_amount')::numeric));
  IF p_amount IS NULL OR p_amount < (prog->>'min_amount')::numeric OR p_amount > cap OR p_amount <> round(p_amount, -3) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF char_length(coalesce(p_purpose, '')) > 300 THEN RAISE EXCEPTION 'purpose_too_long'; END IF;
  SELECT id INTO cid FROM public.companies WHERE owner_id = me ORDER BY created_at LIMIT 1;
  SELECT * INTO a FROM public.credit_applications WHERE user_id = me AND stage NOT IN ('platform_rejected', 'lender_rejected', 'closed', 'cancelled') FOR UPDATE;
  IF FOUND THEN
    IF a.stage <> 'draft' THEN RAISE EXCEPTION 'application_in_progress'; END IF;
    UPDATE public.credit_applications SET requested_amount = p_amount, purpose = nullif(btrim(coalesce(p_purpose, '')), ''),
           tenure_months = (prog->>'tenure_months')::int, product_id = (prog->>'product_id')::uuid, updated_at = now()
     WHERE id = a.id;
  ELSE
    INSERT INTO public.credit_applications (user_id, company_id, product_id, requested_amount, tenure_months, purpose)
    VALUES (me, cid, (prog->>'product_id')::uuid, p_amount, (prog->>'tenure_months')::int, nullif(btrim(coalesce(p_purpose, '')), ''))
    RETURNING * INTO a;
  END IF;
  PERFORM public.credit_log(a.id, me, me, 'supplier', 'amount_selected', jsonb_build_object('amount', p_amount));
  RETURN a.id;
END $$;

CREATE OR REPLACE FUNCTION public.credit_submit(p_app uuid, p_share_consent boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a public.credit_applications; checks jsonb;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app AND user_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'draft' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_share_consent IS NOT TRUE THEN RAISE EXCEPTION 'share_consent_required'; END IF;
  checks := public.credit_checks(me);
  IF NOT public.credit_platform_ok(checks) THEN RAISE EXCEPTION 'not_eligible: %', checks::text; END IF;
  UPDATE public.credit_applications SET stage = 'submitted', submitted_at = now(), share_consent_at = now(), eligibility_snapshot = checks, updated_at = now()
   WHERE id = a.id;
  PERFORM public.credit_log(a.id, me, me, 'supplier', 'submitted', jsonb_build_object('amount', a.requested_amount, 'checks', checks));
  RETURN 'submitted';
END $$;

CREATE OR REPLACE FUNCTION public.credit_cancel(p_app uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a public.credit_applications;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app AND user_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage NOT IN ('draft', 'submitted', 'platform_approved', 'with_lender', 'lender_approved') THEN RAISE EXCEPTION 'cannot_cancel'; END IF;
  UPDATE public.credit_applications SET stage = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = a.id;
  PERFORM public.credit_log(a.id, me, me, 'supplier', 'cancelled', '{}'::jsonb);
  RETURN 'cancelled';
END $$;

-- Accept the lender's KFS and agreement: only the KFS version the supplier was shown (its SHA-256).
CREATE OR REPLACE FUNCTION public.credit_accept_agreement(p_app uuid, p_kfs_sha256 text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a public.credit_applications;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app AND user_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'lender_approved' OR a.lender_decision IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF a.kfs IS NULL OR a.kfs_sha256 IS NULL THEN RAISE EXCEPTION 'kfs_missing'; END IF;
  IF a.agreement_url IS NULL AND NOT EXISTS (SELECT 1 FROM public.credit_documents WHERE application_id = a.id AND kind = 'loan_agreement') THEN
    RAISE EXCEPTION 'agreement_missing';
  END IF;
  IF p_kfs_sha256 IS DISTINCT FROM a.kfs_sha256 THEN RAISE EXCEPTION 'kfs_changed'; END IF;
  UPDATE public.credit_applications SET stage = 'agreement_accepted', agreement_accepted_at = now(), agreement_kfs_sha256 = p_kfs_sha256, updated_at = now()
   WHERE id = a.id;
  PERFORM public.credit_log(a.id, me, me, 'supplier', 'agreement_accepted', jsonb_build_object('kfs_sha256', p_kfs_sha256));
  RETURN 'agreement_accepted';
END $$;

-- Ask for money. Only a request: the lender pays it into the verified bank account and confirms with a UTR.
CREATE OR REPLACE FUNCTION public.credit_request_withdrawal(p_app uuid, p_amount numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a public.credit_applications; b public.bank_verifications; d uuid;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app AND user_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage NOT IN ('agreement_accepted', 'active') THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > public.credit_withdrawable(a.id) THEN RAISE EXCEPTION 'amount_above_withdrawable'; END IF;
  IF p_amount < 1000 AND p_amount <> public.credit_withdrawable(a.id) THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT * INTO b FROM public.bank_verifications WHERE user_id = me AND is_current AND status = 'verified';
  IF NOT FOUND THEN RAISE EXCEPTION 'bank_not_verified'; END IF;
  INSERT INTO public.credit_disbursements (application_id, user_id, amount, bank_account_last4, bank_ifsc)
  VALUES (a.id, me, p_amount, b.account_last4, b.ifsc) RETURNING id INTO d;
  PERFORM public.credit_log(a.id, me, me, 'supplier', 'withdrawal_requested', jsonb_build_object('disbursement', d, 'amount', p_amount, 'to', 'XXXX' || b.account_last4));
  RETURN d;
END $$;

-- ── lender results (used by the signed webhook and by admins copying the lender's own records) ───────────────────────
CREATE OR REPLACE FUNCTION public.credit_kfs_ok(k jsonb, p_amount numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  -- coalesce: a missing field makes the comparison NULL, which must count as "not complete"
  RETURN coalesce(k IS NOT NULL
    AND (k->>'sanctioned_amount')::numeric = p_amount
    AND (k->>'tenure_months')::int BETWEEN 1 AND 120
    AND (k->>'interest_rate_pct')::numeric BETWEEN 0 AND 60
    AND (k->>'apr_pct')::numeric BETWEEN 0 AND 100
    AND (k->>'processing_fee')::numeric >= 0
    AND (k->>'emi_amount')::numeric > 0
    AND (k->>'installments')::int BETWEEN 1 AND 360
    AND (k->>'total_repayable')::numeric >= p_amount
    AND (k->>'cooling_off_days')::int >= 1, false);
EXCEPTION WHEN others THEN
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.credit_apply_lender_decision(p_app uuid, p_decision text, p_amount numeric, p_kfs jsonb, p_lender_ref text,
  p_agreement_url text, p_note text, p_actor uuid, p_source text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.credit_applications; sha text;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'with_lender' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_source NOT IN ('lender_api', 'admin_from_lender') THEN RAISE EXCEPTION 'invalid_source'; END IF;
  IF char_length(btrim(coalesce(p_lender_ref, ''))) < 3 THEN RAISE EXCEPTION 'lender_reference_required'; END IF;
  IF p_decision = 'approved' THEN
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > a.requested_amount THEN RAISE EXCEPTION 'invalid_amount'; END IF;
    IF NOT public.credit_kfs_ok(p_kfs, p_amount) THEN RAISE EXCEPTION 'kfs_incomplete'; END IF;
    IF p_agreement_url IS NOT NULL AND p_agreement_url !~ '^https://' THEN RAISE EXCEPTION 'invalid_agreement_url'; END IF;
    sha := encode(sha256(convert_to(p_kfs::text, 'UTF8')), 'hex');
    UPDATE public.credit_applications SET stage = 'lender_approved', lender_decision = 'approved', lender_decision_source = p_source,
           lender_reference = btrim(p_lender_ref), lender_decided_at = now(), lender_note = nullif(btrim(coalesce(p_note, '')), ''),
           approved_amount = p_amount, kfs = p_kfs, kfs_sha256 = sha, agreement_url = p_agreement_url, updated_at = now()
     WHERE id = a.id;
    INSERT INTO public.credit_limits (user_id, sanctioned_limit, partner_id, lender_reference, sanctioned_at, updated_by)
    VALUES (a.user_id, p_amount, a.partner_id, btrim(p_lender_ref), now(), p_actor)
    ON CONFLICT (user_id) DO UPDATE SET sanctioned_limit = EXCLUDED.sanctioned_limit, partner_id = EXCLUDED.partner_id,
      lender_reference = EXCLUDED.lender_reference, sanctioned_at = EXCLUDED.sanctioned_at, updated_by = p_actor, updated_at = now();
  ELSIF p_decision = 'rejected' THEN
    UPDATE public.credit_applications SET stage = 'lender_rejected', lender_decision = 'rejected', lender_decision_source = p_source,
           lender_reference = btrim(p_lender_ref), lender_decided_at = now(), lender_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     WHERE id = a.id;
  ELSE
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  PERFORM public.credit_log(a.id, a.user_id, p_actor, CASE WHEN p_source = 'lender_api' THEN 'lender' ELSE 'admin' END, 'lender_' || p_decision,
    jsonb_build_object('amount', p_amount, 'lender_reference', btrim(p_lender_ref), 'source', p_source, 'note', p_note));
  RETURN CASE WHEN p_decision = 'approved' THEN 'lender_approved' ELSE 'lender_rejected' END;
END $$;

CREATE OR REPLACE FUNCTION public.credit_apply_disbursement(p_disb uuid, p_status text, p_utr text, p_lender_ref text, p_note text,
  p_actor uuid, p_source text, p_at timestamptz DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.credit_disbursements; a public.credit_applications;
BEGIN
  SELECT * INTO d FROM public.credit_disbursements WHERE id = p_disb FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO a FROM public.credit_applications WHERE id = d.application_id FOR UPDATE;
  IF p_source NOT IN ('lender_api', 'admin_from_lender') THEN RAISE EXCEPTION 'invalid_source'; END IF;
  IF d.status IN ('disbursed', 'failed', 'cancelled') THEN RAISE EXCEPTION 'already_final'; END IF;
  IF p_status = 'sent_to_lender' THEN
    UPDATE public.credit_disbursements SET status = 'sent_to_lender', lender_reference = coalesce(nullif(btrim(coalesce(p_lender_ref, '')), ''), lender_reference),
           note = p_note, updated_at = now() WHERE id = d.id;
  ELSIF p_status = 'disbursed' THEN
    IF char_length(btrim(coalesce(p_utr, ''))) < 6 THEN RAISE EXCEPTION 'utr_required'; END IF;
    UPDATE public.credit_disbursements SET status = 'disbursed', utr = btrim(p_utr), lender_reference = coalesce(nullif(btrim(coalesce(p_lender_ref, '')), ''), lender_reference),
           source = p_source, disbursed_at = coalesce(p_at, now()), note = p_note, updated_at = now() WHERE id = d.id;
    UPDATE public.credit_applications SET stage = 'active', updated_at = now() WHERE id = a.id AND stage = 'agreement_accepted';
  ELSIF p_status = 'failed' THEN
    IF char_length(btrim(coalesce(p_note, ''))) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
    UPDATE public.credit_disbursements SET status = 'failed', source = p_source, note = btrim(p_note), updated_at = now() WHERE id = d.id;
  ELSE
    RAISE EXCEPTION 'invalid_status';
  END IF;
  PERFORM public.credit_log(a.id, a.user_id, p_actor, CASE WHEN p_source = 'lender_api' THEN 'lender' ELSE 'admin' END, 'disbursement_' || p_status,
    jsonb_build_object('disbursement', d.id, 'amount', d.amount, 'utr', p_utr, 'note', p_note));
  RETURN p_status;
END $$;

-- The lender's repayment schedule: rows of { installment_no, due_date, principal, interest, amount }.
CREATE OR REPLACE FUNCTION public.credit_apply_schedule(p_app uuid, p_rows jsonb, p_actor uuid, p_source text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.credit_applications; n int; principal_sum numeric; disbursed numeric;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage NOT IN ('agreement_accepted', 'active') THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_source NOT IN ('lender_api', 'admin_from_lender') THEN RAISE EXCEPTION 'invalid_source'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'schedule_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.credit_repayments WHERE application_id = a.id) THEN RAISE EXCEPTION 'repayments_exist'; END IF;
  SELECT coalesce(sum((r->>'principal')::numeric), 0) INTO principal_sum FROM jsonb_array_elements(p_rows) r;
  SELECT coalesce(sum(amount), 0) INTO disbursed FROM public.credit_disbursements WHERE application_id = a.id AND status = 'disbursed';
  IF principal_sum > a.approved_amount + 0.01 THEN RAISE EXCEPTION 'schedule_above_approved'; END IF;
  DELETE FROM public.credit_repayment_schedule WHERE application_id = a.id;
  INSERT INTO public.credit_repayment_schedule (application_id, installment_no, due_date, principal, interest, amount)
  SELECT a.id, (r->>'installment_no')::int, (r->>'due_date')::date, (r->>'principal')::numeric, (r->>'interest')::numeric, (r->>'amount')::numeric
  FROM jsonb_array_elements(p_rows) r;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.credit_log(a.id, a.user_id, p_actor, CASE WHEN p_source = 'lender_api' THEN 'lender' ELSE 'admin' END, 'schedule_set',
    jsonb_build_object('installments', n, 'principal', principal_sum, 'disbursed', disbursed));
  RETURN n;
END $$;

-- A repayment the lender received. Applied to the oldest unpaid instalments first.
CREATE OR REPLACE FUNCTION public.credit_apply_repayment(p_app uuid, p_amount numeric, p_paid_at timestamptz, p_method text, p_reference text,
  p_actor uuid, p_source text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.credit_applications; left_over numeric := p_amount; s record; take numeric; due numeric;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'active' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_source NOT IN ('lender_api', 'admin_from_lender') THEN RAISE EXCEPTION 'invalid_source'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT coalesce(sum(amount - paid_amount), 0) INTO due FROM public.credit_repayment_schedule WHERE application_id = a.id;
  IF due = 0 THEN RAISE EXCEPTION 'schedule_required'; END IF;
  IF p_amount > due + 0.01 THEN RAISE EXCEPTION 'amount_above_outstanding'; END IF;
  IF EXISTS (SELECT 1 FROM public.credit_repayments WHERE application_id = a.id AND reference = btrim(coalesce(p_reference, ''))) THEN RETURN 'duplicate'; END IF;
  INSERT INTO public.credit_repayments (application_id, user_id, amount, paid_at, method, reference, source, recorded_by)
  VALUES (a.id, a.user_id, p_amount, coalesce(p_paid_at, now()), p_method, btrim(coalesce(p_reference, '')), p_source, p_actor);
  FOR s IN SELECT * FROM public.credit_repayment_schedule WHERE application_id = a.id AND paid_amount < amount ORDER BY installment_no LOOP
    EXIT WHEN left_over <= 0;
    take := least(left_over, s.amount - s.paid_amount);
    UPDATE public.credit_repayment_schedule SET paid_amount = paid_amount + take,
           paid_at = CASE WHEN paid_amount + take >= amount - 0.005 THEN coalesce(p_paid_at, now()) ELSE paid_at END
     WHERE id = s.id;
    left_over := left_over - take;
  END LOOP;
  PERFORM public.credit_log(a.id, a.user_id, p_actor, CASE WHEN p_source = 'lender_api' THEN 'lender' ELSE 'admin' END, 'repayment_recorded',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'reference', p_reference));
  -- fully repaid and nothing more to draw: closed
  IF NOT EXISTS (SELECT 1 FROM public.credit_repayment_schedule WHERE application_id = a.id AND paid_amount < amount - 0.005)
     AND NOT EXISTS (SELECT 1 FROM public.credit_disbursements WHERE application_id = a.id AND status IN ('requested', 'sent_to_lender'))
     AND public.credit_withdrawable(a.id) = 0 THEN
    UPDATE public.credit_applications SET stage = 'closed', closed_at = now(), updated_at = now() WHERE id = a.id;
    PERFORM public.credit_log(a.id, a.user_id, p_actor, 'system', 'closed_repaid', '{}'::jsonb);
  END IF;
  RETURN 'recorded';
END $$;

-- ── service functions (signed lender webhook, document storage) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_service_lender_event(p_partner_code text, p_event_id text, p_type text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pa public.lending_partners;
  app uuid;
  res text;
  d public.credit_disbursements;
BEGIN
  SELECT * INTO pa FROM public.lending_partners WHERE code = p_partner_code AND integration_mode = 'api' AND status IN ('active', 'paused');
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_partner'; END IF;
  IF char_length(coalesce(p_event_id, '')) < 6 THEN RAISE EXCEPTION 'event_id_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.credit_webhook_events WHERE event_id = p_partner_code || ':' || p_event_id) THEN
    RETURN jsonb_build_object('result', 'duplicate');
  END IF;
  IF p_type = 'disbursement.update' THEN
    SELECT * INTO d FROM public.credit_disbursements WHERE id = (p_payload->>'disbursement_id')::uuid;
    app := d.application_id;
  ELSE
    app := (p_payload->>'application_id')::uuid;
  END IF;
  IF app IS NULL OR NOT EXISTS (SELECT 1 FROM public.credit_applications WHERE id = app AND partner_id = pa.id) THEN RAISE EXCEPTION 'not_found'; END IF;

  IF p_type = 'application.decision' THEN
    res := public.credit_apply_lender_decision(app, p_payload->>'decision', (p_payload->>'approved_amount')::numeric, p_payload->'kfs',
             p_payload->>'lender_reference', p_payload->>'agreement_url', p_payload->>'note', NULL, 'lender_api');
  ELSIF p_type = 'disbursement.update' THEN
    res := public.credit_apply_disbursement(d.id, p_payload->>'status', p_payload->>'utr', p_payload->>'lender_reference', p_payload->>'note',
             NULL, 'lender_api', (p_payload->>'disbursed_at')::timestamptz);
  ELSIF p_type = 'schedule.set' THEN
    res := public.credit_apply_schedule(app, p_payload->'installments', NULL, 'lender_api')::text;
  ELSIF p_type = 'repayment.received' THEN
    res := public.credit_apply_repayment(app, (p_payload->>'amount')::numeric, (p_payload->>'paid_at')::timestamptz, p_payload->>'method',
             p_payload->>'reference', NULL, 'lender_api');
  ELSE
    RAISE EXCEPTION 'unknown_event_type';
  END IF;
  INSERT INTO public.credit_webhook_events (event_id, partner_id, event_type, application_id, result)
  VALUES (p_partner_code || ':' || p_event_id, pa.id, p_type, app, res);
  RETURN jsonb_build_object('result', res);
END $$;

CREATE OR REPLACE FUNCTION public.credit_service_add_document(p_actor uuid, p_app uuid, p_kind text, p_file_name text, p_mime text, p_size integer,
  p_sha256 text, p_path text, p_iv text, p_key_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.credit_applications; d uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role = 'admin') THEN RAISE EXCEPTION 'admin_only'; END IF;
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage NOT IN ('with_lender', 'lender_approved', 'agreement_accepted', 'active') THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  INSERT INTO public.credit_documents (application_id, user_id, kind, file_name, mime_type, size_bytes, sha256, storage_path, enc_iv, enc_key_id, uploaded_by)
  VALUES (a.id, a.user_id, p_kind, p_file_name, p_mime, p_size, p_sha256, p_path, p_iv, p_key_id, p_actor) RETURNING id INTO d;
  PERFORM public.credit_log(a.id, a.user_id, p_actor, 'admin', 'document_added', jsonb_build_object('document', d, 'kind', p_kind));
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.credit_service_document_for(p_actor uuid, p_doc uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.credit_documents; adm boolean;
BEGIN
  SELECT * INTO d FROM public.credit_documents WHERE id = p_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  adm := EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role = 'admin');
  IF d.user_id <> p_actor AND NOT adm THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM public.credit_log(d.application_id, d.user_id, p_actor, CASE WHEN adm AND d.user_id <> p_actor THEN 'admin' ELSE 'supplier' END,
    'document_viewed', jsonb_build_object('document', d.id, 'kind', d.kind));
  RETURN jsonb_build_object('path', d.storage_path, 'iv', d.enc_iv, 'key_id', d.enc_key_id, 'mime_type', d.mime_type, 'file_name', d.file_name);
END $$;

-- ── admin functions ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_require_admin() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_applications(p_filter text DEFAULT 'review', p_search text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  PERFORM public.credit_require_admin();
  WITH apps AS (
    SELECT a.id, a.user_id, a.stage, a.requested_amount, a.approved_amount, a.submitted_at, a.updated_at, a.created_at, a.lender_reference,
           pr.full_name, pr.email, c.company_name, lp.name AS partner_name,
           public.credit_withdrawable(a.id) AS withdrawable,
           (SELECT count(*) FROM public.credit_disbursements x WHERE x.application_id = a.id AND x.status IN ('requested', 'sent_to_lender')) AS pending_withdrawals
    FROM public.credit_applications a
    LEFT JOIN public.profiles pr ON pr.id = a.user_id
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.lending_partners lp ON lp.id = a.partner_id
    WHERE (CASE coalesce(p_filter, 'all')
             WHEN 'review' THEN a.stage = 'submitted'
             WHEN 'to_send' THEN a.stage = 'platform_approved'
             WHEN 'with_lender' THEN a.stage = 'with_lender'
             WHEN 'agreement' THEN a.stage = 'lender_approved'
             WHEN 'payouts' THEN EXISTS (SELECT 1 FROM public.credit_disbursements x WHERE x.application_id = a.id AND x.status IN ('requested', 'sent_to_lender'))
             WHEN 'active' THEN a.stage IN ('agreement_accepted', 'active')
             WHEN 'closed' THEN a.stage IN ('closed', 'cancelled', 'platform_rejected', 'lender_rejected')
             WHEN 'draft' THEN a.stage = 'draft'
             ELSE true END)
      AND (p_search IS NULL OR btrim(p_search) = '' OR concat_ws(' ', pr.full_name, pr.email, c.company_name, a.id::text, a.lender_reference) ILIKE '%' || btrim(p_search) || '%'))
  SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM (SELECT * FROM apps ORDER BY updated_at DESC LIMIT 200) x), '[]'::jsonb),
    'counts', (SELECT jsonb_build_object(
        'review', count(*) FILTER (WHERE stage = 'submitted'), 'to_send', count(*) FILTER (WHERE stage = 'platform_approved'),
        'with_lender', count(*) FILTER (WHERE stage = 'with_lender'), 'agreement', count(*) FILTER (WHERE stage = 'lender_approved'),
        'payouts', (SELECT count(DISTINCT application_id) FROM public.credit_disbursements WHERE status IN ('requested', 'sent_to_lender')),
        'active', count(*) FILTER (WHERE stage IN ('agreement_accepted', 'active'))) FROM public.credit_applications))
  INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_detail(p_app uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.credit_applications; res jsonb;
BEGIN
  PERFORM public.credit_require_admin();
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT jsonb_build_object(
    'application', to_jsonb(a),
    'checks_now', public.credit_checks(a.user_id),
    'supplier', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email, 'phone', pr.phone) FROM public.profiles pr WHERE pr.id = a.user_id),
    'company', (SELECT jsonb_build_object('id', c.id, 'company_name', c.company_name, 'city', c.city, 'verification_status', c.verification_status) FROM public.companies c WHERE c.id = a.company_id),
    'limit', (SELECT to_jsonb(l) FROM public.credit_limits l WHERE l.user_id = a.user_id),
    'withdrawable', public.credit_withdrawable(a.id),
    'drawn', public.credit_drawn(a.id),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'file_name', d.file_name, 'uploaded_at', d.uploaded_at) ORDER BY d.uploaded_at)
                           FROM public.credit_documents d WHERE d.application_id = a.id), '[]'::jsonb),
    'disbursements', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.requested_at DESC) FROM public.credit_disbursements x WHERE x.application_id = a.id), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.installment_no) FROM public.credit_repayment_schedule s WHERE s.application_id = a.id), '[]'::jsonb),
    'repayments', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.paid_at DESC) FROM public.credit_repayments r WHERE r.application_id = a.id), '[]'::jsonb),
    'logs', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC) FROM public.credit_audit_logs l WHERE l.application_id = a.id), '[]'::jsonb))
  INTO res;
  RETURN res;
END $$;

-- Platform eligibility: BulkSkart's own check before anything goes to a lender.
CREATE OR REPLACE FUNCTION public.admin_credit_platform_decision(p_app uuid, p_action text, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin(); a public.credit_applications; checks jsonb;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'submitted' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_action = 'approve' THEN
    checks := public.credit_checks(a.user_id);
    IF NOT public.credit_platform_ok(checks) THEN RAISE EXCEPTION 'not_eligible'; END IF;
    UPDATE public.credit_applications SET stage = 'platform_approved', platform_note = nullif(btrim(coalesce(p_note, '')), ''),
           platform_decided_at = now(), platform_decided_by = me, eligibility_snapshot = checks, updated_at = now() WHERE id = a.id;
  ELSIF p_action = 'reject' THEN
    IF char_length(btrim(coalesce(p_note, ''))) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
    UPDATE public.credit_applications SET stage = 'platform_rejected', platform_note = btrim(p_note), platform_decided_at = now(),
           platform_decided_by = me, updated_at = now() WHERE id = a.id;
  ELSE RAISE EXCEPTION 'invalid_action';
  END IF;
  PERFORM public.credit_log(a.id, a.user_id, me, 'admin', 'platform_' || p_action, jsonb_build_object('note', p_note));
  RETURN CASE WHEN p_action = 'approve' THEN 'platform_approved' ELSE 'platform_rejected' END;
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_send_to_lender(p_app uuid, p_product uuid, p_reference text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin(); a public.credit_applications; pr public.credit_products; pa public.lending_partners;
BEGIN
  SELECT * INTO a FROM public.credit_applications WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'platform_approved' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  SELECT * INTO pr FROM public.credit_products WHERE id = p_product AND status = 'active';
  SELECT * INTO pa FROM public.lending_partners WHERE id = pr.partner_id AND status = 'active';
  IF pr.id IS NULL OR pa.id IS NULL THEN RAISE EXCEPTION 'partner_not_live'; END IF;
  IF a.requested_amount > pr.max_amount OR a.requested_amount < pr.min_amount THEN RAISE EXCEPTION 'amount_outside_product'; END IF;
  UPDATE public.credit_applications SET stage = 'with_lender', product_id = pr.id, partner_id = pa.id, tenure_months = pr.tenure_months,
         sent_to_lender_at = now(), lender_reference = nullif(btrim(coalesce(p_reference, '')), ''), updated_at = now() WHERE id = a.id;
  PERFORM public.credit_log(a.id, a.user_id, me, 'admin', 'sent_to_lender', jsonb_build_object('partner', pa.name, 'product', pr.name, 'reference', p_reference));
  RETURN 'with_lender';
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_record_lender_decision(p_app uuid, p_decision text, p_amount numeric, p_kfs jsonb, p_lender_ref text,
  p_agreement_url text DEFAULT NULL, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin();
BEGIN
  RETURN public.credit_apply_lender_decision(p_app, p_decision, p_amount, p_kfs, p_lender_ref, nullif(btrim(coalesce(p_agreement_url, '')), ''), p_note, me, 'admin_from_lender');
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_update_disbursement(p_disb uuid, p_status text, p_utr text DEFAULT NULL, p_lender_ref text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin();
BEGIN
  RETURN public.credit_apply_disbursement(p_disb, p_status, p_utr, p_lender_ref, p_note, me, 'admin_from_lender');
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_set_schedule(p_app uuid, p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin();
BEGIN
  RETURN public.credit_apply_schedule(p_app, p_rows, me, 'admin_from_lender');
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_record_repayment(p_app uuid, p_amount numeric, p_paid_at timestamptz, p_method text, p_reference text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin();
BEGIN
  RETURN public.credit_apply_repayment(p_app, p_amount, p_paid_at, p_method, p_reference, me, 'admin_from_lender');
END $$;

-- Platform cap (what a supplier may apply for) and suspension. The sanctioned limit only comes from a lender decision.
CREATE OR REPLACE FUNCTION public.admin_credit_set_limit(p_user uuid, p_platform_cap numeric, p_status text, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin(); res jsonb;
BEGIN
  IF p_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF p_platform_cap IS NOT NULL AND p_platform_cap < 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role = 'supplier') THEN RAISE EXCEPTION 'suppliers_only'; END IF;
  INSERT INTO public.credit_limits (user_id, platform_cap, status, notes, updated_by) VALUES (p_user, p_platform_cap, p_status, p_note, me)
  ON CONFLICT (user_id) DO UPDATE SET platform_cap = EXCLUDED.platform_cap, status = EXCLUDED.status, notes = EXCLUDED.notes, updated_by = me, updated_at = now()
  RETURNING to_jsonb(credit_limits.*) INTO res;
  PERFORM public.credit_log(NULL, p_user, me, 'admin', 'limit_updated', jsonb_build_object('platform_cap', p_platform_cap, 'status', p_status, 'note', p_note));
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_limits(p_search text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.credit_require_admin();
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'updated_at' DESC) FROM (
    SELECT to_jsonb(l) || jsonb_build_object('full_name', pr.full_name, 'email', pr.email,
             'company_name', (SELECT c.company_name FROM public.companies c WHERE c.owner_id = l.user_id ORDER BY c.created_at LIMIT 1)) AS x
    FROM public.credit_limits l JOIN public.profiles pr ON pr.id = l.user_id
    WHERE p_search IS NULL OR btrim(p_search) = '' OR concat_ws(' ', pr.full_name, pr.email) ILIKE '%' || btrim(p_search) || '%'
    LIMIT 300) s), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_upsert_partner(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin(); pid uuid;
BEGIN
  IF nullif(p->>'id', '') IS NULL THEN
    INSERT INTO public.lending_partners (code, name, legal_name, entity_type, rbi_registration_no, grievance_officer_name, grievance_email, grievance_phone,
                                         website, integration_mode, status, notes)
    VALUES (lower(p->>'code'), p->>'name', p->>'legal_name', p->>'entity_type', nullif(p->>'rbi_registration_no', ''), nullif(p->>'grievance_officer_name', ''),
            nullif(p->>'grievance_email', ''), nullif(p->>'grievance_phone', ''), nullif(p->>'website', ''), coalesce(nullif(p->>'integration_mode', ''), 'manual'),
            coalesce(nullif(p->>'status', ''), 'draft'), nullif(p->>'notes', ''))
    RETURNING id INTO pid;
  ELSE
    UPDATE public.lending_partners SET name = p->>'name', legal_name = p->>'legal_name', entity_type = p->>'entity_type',
           rbi_registration_no = nullif(p->>'rbi_registration_no', ''), grievance_officer_name = nullif(p->>'grievance_officer_name', ''),
           grievance_email = nullif(p->>'grievance_email', ''), grievance_phone = nullif(p->>'grievance_phone', ''), website = nullif(p->>'website', ''),
           integration_mode = coalesce(nullif(p->>'integration_mode', ''), integration_mode), status = coalesce(nullif(p->>'status', ''), status),
           notes = nullif(p->>'notes', ''), updated_at = now()
     WHERE id = (p->>'id')::uuid RETURNING id INTO pid;
    IF pid IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  PERFORM public.credit_log(NULL, NULL, me, 'admin', 'partner_saved', (p - 'notes') || jsonb_build_object('id', pid));
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_upsert_product(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.credit_require_admin(); pid uuid; confirmed timestamptz;
BEGIN
  -- the rate counts as confirmed only with the partner's written reference
  confirmed := CASE WHEN (p->>'rate_confirmed')::boolean IS TRUE AND char_length(coalesce(p->>'rate_confirmation_ref', '')) >= 3 THEN now() END;
  IF (p->>'status') = 'active' AND NOT EXISTS (SELECT 1 FROM public.lending_partners WHERE id = (p->>'partner_id')::uuid AND status = 'active') THEN
    RAISE EXCEPTION 'partner_not_live';
  END IF;
  IF nullif(p->>'id', '') IS NULL THEN
    INSERT INTO public.credit_products (partner_id, name, min_amount, max_amount, tenure_months, interest_rate_pct, rate_confirmed_at, rate_confirmation_ref,
                                       processing_fee_pct, status)
    VALUES ((p->>'partner_id')::uuid, p->>'name', coalesce((p->>'min_amount')::numeric, 50000), coalesce((p->>'max_amount')::numeric, 1500000),
            coalesce((p->>'tenure_months')::int, 12), (p->>'interest_rate_pct')::numeric, confirmed, nullif(p->>'rate_confirmation_ref', ''),
            (p->>'processing_fee_pct')::numeric, coalesce(nullif(p->>'status', ''), 'draft'))
    RETURNING id INTO pid;
  ELSE
    UPDATE public.credit_products SET name = p->>'name', min_amount = (p->>'min_amount')::numeric, max_amount = (p->>'max_amount')::numeric,
           tenure_months = (p->>'tenure_months')::int, interest_rate_pct = (p->>'interest_rate_pct')::numeric,
           rate_confirmed_at = CASE WHEN confirmed IS NULL THEN NULL
                                    WHEN rate_confirmation_ref IS NOT DISTINCT FROM nullif(p->>'rate_confirmation_ref', '') AND interest_rate_pct IS NOT DISTINCT FROM (p->>'interest_rate_pct')::numeric
                                    THEN coalesce(rate_confirmed_at, confirmed) ELSE confirmed END,
           rate_confirmation_ref = nullif(p->>'rate_confirmation_ref', ''), processing_fee_pct = (p->>'processing_fee_pct')::numeric,
           status = coalesce(nullif(p->>'status', ''), status), updated_at = now()
     WHERE id = (p->>'id')::uuid RETURNING id INTO pid;
    IF pid IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  PERFORM public.credit_log(NULL, NULL, me, 'admin', 'product_saved', p || jsonb_build_object('id', pid, 'rate_confirmed', confirmed IS NOT NULL));
  RETURN pid;
END $$;

-- ── KYC can be submitted for credit without a loan application (replaces the 00076 version) ──────────────────────────
CREATE OR REPLACE FUNCTION public.kyc_submit(p_application_id uuid, p_share_consent boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p public.kyc_profiles;
  missing text[];
  ret int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  p := public.kyc_profile_for(me);
  IF p_application_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.loan_applications WHERE id = p_application_id AND user_id = me AND stage IN ('kyc', 'verification')) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF p_share_consent IS NOT TRUE THEN RAISE EXCEPTION 'share_consent_required'; END IF;
  IF p.rejected_at IS NOT NULL THEN RAISE EXCEPTION 'kyc_rejected'; END IF;
  IF p.pan_hash IS NULL OR p.entity_type IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.bank_verifications WHERE kyc_profile_id = p.id AND is_current) THEN
    RAISE EXCEPTION 'details_missing';
  END IF;
  IF 'resubmission_required' IN (p.pan_status, p.aadhaar_status, p.business_status, p.bank_status) THEN
    RAISE EXCEPTION 'resubmission_pending';
  END IF;
  missing := public.kyc_missing_documents(p.id);
  IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'documents_missing: %', array_to_string(missing, ','); END IF;

  SELECT document_retention_days INTO ret FROM public.kyc_settings;
  UPDATE public.kyc_documents SET delete_after = now() + make_interval(days => ret)
   WHERE kyc_profile_id = p.id AND status <> 'purged';
  IF p_application_id IS NOT NULL THEN
    UPDATE public.loan_applications SET share_consent_at = coalesce(share_consent_at, now()), kyc_profile_id = p.id, updated_at = now()
     WHERE id = p_application_id;
  END IF;
  IF p.review_status <> 'verified' THEN
    UPDATE public.kyc_profiles SET review_status = 'in_progress', submitted_at = now(),
           step_notes = step_notes - 'review', updated_at = now() WHERE id = p.id;
  END IF;
  PERFORM public.kyc_log(p.id, p_application_id, me, me, 'applicant', 'submitted_for_review',
    CASE WHEN p_application_id IS NULL THEN '{"for":"business_credit"}'::jsonb ELSE '{}'::jsonb END);
  RETURN public.kyc_recompute(p.id);
END $$;

-- ── who may call what ─────────────────────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND (p.proname LIKE 'credit\_%' OR p.proname LIKE 'admin\_credit\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.kyc_submit(uuid, boolean) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.kyc_submit(uuid, boolean), public.credit_program(), public.credit_my_state(), public.credit_save_draft(numeric, text),
  public.credit_submit(uuid, boolean), public.credit_cancel(uuid), public.credit_accept_agreement(uuid, text), public.credit_request_withdrawal(uuid, numeric)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_applications(text, text), public.admin_credit_detail(uuid), public.admin_credit_platform_decision(uuid, text, text),
  public.admin_credit_send_to_lender(uuid, uuid, text), public.admin_credit_record_lender_decision(uuid, text, numeric, jsonb, text, text, text),
  public.admin_credit_update_disbursement(uuid, text, text, text, text), public.admin_credit_set_schedule(uuid, jsonb),
  public.admin_credit_record_repayment(uuid, numeric, timestamptz, text, text), public.admin_credit_set_limit(uuid, numeric, text, text),
  public.admin_credit_limits(text), public.admin_credit_upsert_partner(jsonb), public.admin_credit_upsert_product(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_service_lender_event(text, text, text, jsonb), public.credit_service_add_document(uuid, uuid, text, text, text, integer, text, text, text, text),
  public.credit_service_document_for(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
