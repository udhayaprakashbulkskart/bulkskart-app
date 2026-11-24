-- Business loan KYC (runs after a loan request from the loan calculator).
--
-- Flow: Loan request → KYC (5 steps) → Verification → Lending partner review → Loan decision.
-- BulkSkart is not the lender: a lending partner (bank / NBFC) decides, and an admin records that decision here.
--
-- Rules enforced here, not in the browser:
--   • Applicants can read their own rows and nothing else. They cannot write any table directly.
--   • Every change goes through a function that checks who is calling, and is written to kyc_audit_logs (append-only).
--   • A step becomes "verified" only (a) from a check by the configured provider in its PRODUCTION environment, recorded
--     by the kyc edge function with the service role, or (b) by an admin who accepted the uploaded documents for that
--     step (for Aadhaar: a masked Aadhaar copy, first 8 digits hidden). Sandbox results never verify anything.
--     Without a provider, everything is collected and BulkSkart staff verify it from the documents (manual review).
--   • Full PAN and bank account numbers are stored only encrypted (AES-256-GCM, key held by the edge function, not the
--     database) in kyc_private.secrets; the readable tables keep a masked value and a keyed hash. Aadhaar: last 4 digits.
--   • Documents are stored encrypted in the private "kyc-documents" bucket, which has no storage policies: only the edge
--     function (service role) reads or writes it, after checking the caller is the owner or an admin.
--   • Aadhaar OTPs and login credentials are never stored (the DigiLocker login happens on DigiLocker's own site).
--
-- One transaction; safe to run again.

BEGIN;

-- ── loan request hand-off ──────────────────────────────────────────────────────────────────────────────────────────────
-- A visitor who is not signed in gets a random claim token in their browser; only its SHA-256 is stored. After they sign
-- in, loan_claim_request(token) attaches the request to their account.
ALTER TABLE public.loan_requests ADD COLUMN IF NOT EXISTS claim_token_hash text
  CHECK (claim_token_hash IS NULL OR claim_token_hash ~ '^[0-9a-f]{64}$');
CREATE INDEX IF NOT EXISTS loan_requests_claim_idx ON public.loan_requests (claim_token_hash) WHERE claim_token_hash IS NOT NULL;

-- ── settings ───────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_settings (
  id                        boolean PRIMARY KEY DEFAULT true CHECK (id),
  document_retention_days   integer NOT NULL DEFAULT 1825 CHECK (document_retention_days BETWEEN 30 AND 3650),
  abandoned_retention_days  integer NOT NULL DEFAULT 180 CHECK (abandoned_retention_days BETWEEN 7 AND 1825),
  max_file_mb               integer NOT NULL DEFAULT 5 CHECK (max_file_mb BETWEEN 1 AND 10),
  review_hours              integer NOT NULL DEFAULT 2 CHECK (review_hours BETWEEN 1 AND 72),   -- promised call-back time, in working hours
  consent_version           text NOT NULL DEFAULT '2026-11-24',
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid
);
INSERT INTO public.kyc_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ── KYC profile: one per applicant ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                 text NOT NULL DEFAULT 'not_started',
  status_reason          text,
  pan_status             text NOT NULL DEFAULT 'not_started',
  aadhaar_status         text NOT NULL DEFAULT 'not_started',
  business_status        text NOT NULL DEFAULT 'not_started',
  bank_status            text NOT NULL DEFAULT 'not_started',
  review_status          text NOT NULL DEFAULT 'not_started',
  step_notes             jsonb NOT NULL DEFAULT '{}'::jsonb,    -- latest message per step, shown to the applicant
  -- PAN (personal PAN of the applicant / proprietor)
  pan_masked             text,
  pan_hash               text,
  pan_name               text,                                  -- as entered
  pan_registered_name    text,                                  -- as the provider returned it
  pan_type               text,
  pan_verified_via       text CHECK (pan_verified_via IN ('provider', 'document_review')),
  -- Aadhaar (DigiLocker only; never the full number)
  aadhaar_last4          text CHECK (aadhaar_last4 IS NULL OR aadhaar_last4 ~ '^[0-9]{4}$'),
  aadhaar_name           text,
  aadhaar_verified_via   text CHECK (aadhaar_verified_via IN ('digilocker', 'document_review')),
  -- Business
  entity_type            text CHECK (entity_type IN ('proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'other')),
  business_name          text,
  gstin                  text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  gst_legal_name         text,
  gst_status             text,
  udyam_number           text CHECK (udyam_number IS NULL OR udyam_number ~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$'),
  cin                    text CHECK (cin IS NULL OR cin ~ '^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4})$'),
  business_pan_masked    text,
  business_pan_hash      text,
  business_verified_via  text CHECK (business_verified_via IN ('provider', 'document_review')),
  -- consent and lifecycle
  consent_version        text,
  consent_text_sha256    text CHECK (consent_text_sha256 IS NULL OR consent_text_sha256 ~ '^[0-9a-f]{64}$'),
  consent_at             timestamptz,
  submitted_at           timestamptz,
  verified_at            timestamptz,
  rejected_at            timestamptz,
  decided_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kyc_profiles_status_ck CHECK (
    status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')
    AND pan_status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')
    AND aadhaar_status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')
    AND business_status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')
    AND bank_status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')
    AND review_status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')),
  -- "verified" always says how
  CONSTRAINT kyc_profiles_verified_how_ck CHECK (
    (pan_status <> 'verified' OR pan_verified_via IS NOT NULL)
    AND (aadhaar_status <> 'verified' OR aadhaar_verified_via IS NOT NULL)
    AND (business_status <> 'verified' OR business_verified_via IS NOT NULL)
    AND (status <> 'verified' OR (pan_status = 'verified' AND aadhaar_status = 'verified' AND business_status = 'verified'
                                  AND bank_status = 'verified' AND review_status = 'verified')))
);

-- ── loan applications ──────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_request_id       uuid UNIQUE REFERENCES public.loan_requests(id) ON DELETE SET NULL,
  kyc_profile_id        uuid REFERENCES public.kyc_profiles(id) ON DELETE SET NULL,
  amount                numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  currency              text NOT NULL DEFAULT 'INR',
  tenure_months         integer CHECK (tenure_months IS NULL OR tenure_months BETWEEN 1 AND 360),
  purpose               text CHECK (char_length(coalesce(purpose, '')) <= 300),
  stage                 text NOT NULL DEFAULT 'kyc'
                        CHECK (stage IN ('kyc', 'verification', 'partner_review', 'decision', 'withdrawn')),
  share_consent_at      timestamptz,                -- applicant agreed to share KYC with the lending partner
  lending_partner       text,
  partner_reference     text,
  forwarded_at          timestamptz,
  forwarded_by          uuid,
  decision              text CHECK (decision IN ('approved_by_partner', 'declined_by_partner')),
  decision_amount       numeric(14,2) CHECK (decision_amount IS NULL OR decision_amount > 0),
  decision_note         text,
  decided_at            timestamptz,
  decision_recorded_by  uuid,
  withdrawn_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loan_applications_partner_ck CHECK (stage NOT IN ('partner_review', 'decision') OR (lending_partner IS NOT NULL AND share_consent_at IS NOT NULL)),
  CONSTRAINT loan_applications_decision_ck CHECK ((stage = 'decision') = (decision IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS loan_applications_user_idx ON public.loan_applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loan_applications_stage_idx ON public.loan_applications (stage, updated_at DESC);

-- ── documents (encrypted files in the private kyc-documents bucket) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_profile_id   uuid NOT NULL REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step             text NOT NULL CHECK (step IN ('pan', 'aadhaar', 'business', 'bank', 'other')),
  doc_type         text NOT NULL CHECK (doc_type IN ('pan_card', 'aadhaar_masked', 'gst_certificate', 'udyam_certificate', 'incorporation_certificate',
                                                     'partnership_deed', 'business_pan_card', 'cancelled_cheque', 'bank_statement', 'other')),
  file_name        text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 120),
  mime_type        text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes       integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256           text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path     text NOT NULL UNIQUE,
  enc_iv           text NOT NULL,
  enc_key_id       text NOT NULL,
  status           text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'accepted', 'rejected', 'resubmission_required', 'purged')),
  review_note      text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  delete_after     timestamptz NOT NULL,
  purged_at        timestamptz,
  CONSTRAINT kyc_documents_note_ck CHECK (status NOT IN ('rejected', 'resubmission_required') OR char_length(coalesce(review_note, '')) >= 3)
);
CREATE INDEX IF NOT EXISTS kyc_documents_profile_idx ON public.kyc_documents (kyc_profile_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS kyc_documents_expiry_idx ON public.kyc_documents (delete_after) WHERE status <> 'purged';

-- ── provider checks and admin reviews ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_profile_id  uuid NOT NULL REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step            text NOT NULL CHECK (step IN ('pan', 'aadhaar', 'business', 'bank')),
  check_type      text NOT NULL CHECK (check_type IN ('pan', 'aadhaar_digilocker', 'gstin', 'bank_account', 'document_review')),
  provider        text NOT NULL,                          -- e.g. 'cashfree', or 'admin' for a document review
  environment     text NOT NULL CHECK (environment IN ('production', 'sandbox', 'none')),
  status          text NOT NULL CHECK (status IN ('integration_pending', 'requested', 'success', 'review', 'failed', 'error',
                                                  'expired', 'consent_denied', 'test_only')),
  provider_ref    text,
  client_ref      text UNIQUE,                            -- our own id sent to the provider (DigiLocker verification_id)
  result          jsonb NOT NULL DEFAULT '{}'::jsonb,     -- masked, minimal: never a full PAN, account number or Aadhaar
  message         text,
  requested_by    uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS verification_requests_profile_idx ON public.verification_requests (kyc_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_verifications (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_profile_id            uuid NOT NULL REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_current                boolean NOT NULL DEFAULT true,
  account_holder_name       text NOT NULL CHECK (char_length(account_holder_name) BETWEEN 2 AND 120),
  account_last4             text NOT NULL CHECK (account_last4 ~ '^[0-9A-Z]{4}$'),
  account_hash              text NOT NULL,
  ifsc                      text NOT NULL CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name                 text,
  branch                    text,
  name_at_bank              text,
  name_match_result         text,
  name_match_score          numeric(6,2),
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required')),
  verified_via              text CHECK (verified_via IN ('provider', 'document_review')),
  verification_request_id   uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_verifications_how_ck CHECK (status <> 'verified' OR verified_via IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_verifications_current_idx ON public.bank_verifications (kyc_profile_id) WHERE is_current;

-- ── audit log (append-only) ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_audit_logs (
  id              bigserial PRIMARY KEY,
  kyc_profile_id  uuid,                                   -- no foreign keys: the log outlives deleted rows and is never updated
  application_id  uuid,
  subject_user_id uuid,                                   -- whose KYC this is about
  actor_id        uuid,
  actor_role      text NOT NULL CHECK (actor_role IN ('applicant', 'admin', 'system')),
  action          text NOT NULL,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kyc_audit_logs_subject_idx ON public.kyc_audit_logs (subject_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.kyc_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'kyc_audit_logs is append-only';
END $$;
DROP TRIGGER IF EXISTS kyc_audit_logs_no_change ON public.kyc_audit_logs;
CREATE TRIGGER kyc_audit_logs_no_change BEFORE UPDATE OR DELETE ON public.kyc_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.kyc_audit_append_only();

-- ── encrypted values (not exposed by the API) ──────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS kyc_private;
CREATE TABLE IF NOT EXISTS kyc_private.secrets (
  kyc_profile_id  uuid NOT NULL REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('pan', 'business_pan', 'bank_account')),
  ciphertext      text NOT NULL,
  iv              text NOT NULL,
  key_id          text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kyc_profile_id, kind)
);

-- ── private bucket for the encrypted files (no policies: only the service role reaches it) ─────────────────────────────
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;
END $$;

-- ── access ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.kyc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kyc_settings, public.kyc_profiles, public.loan_applications, public.kyc_documents,
  public.verification_requests, public.bank_verifications, public.kyc_audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.kyc_audit_logs_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SCHEMA kyc_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA kyc_private FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.kyc_settings, public.kyc_profiles, public.loan_applications, public.kyc_documents,
  public.verification_requests, public.bank_verifications, public.kyc_audit_logs TO authenticated;

DROP POLICY IF EXISTS kyc_settings_read ON public.kyc_settings;
CREATE POLICY kyc_settings_read ON public.kyc_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS kyc_profiles_read ON public.kyc_profiles;
CREATE POLICY kyc_profiles_read ON public.kyc_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS loan_applications_read ON public.loan_applications;
CREATE POLICY loan_applications_read ON public.loan_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS kyc_documents_read ON public.kyc_documents;
CREATE POLICY kyc_documents_read ON public.kyc_documents FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS verification_requests_read ON public.verification_requests;
CREATE POLICY verification_requests_read ON public.verification_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS bank_verifications_read ON public.bank_verifications;
CREATE POLICY bank_verifications_read ON public.bank_verifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS kyc_audit_logs_read ON public.kyc_audit_logs;
CREATE POLICY kyc_audit_logs_read ON public.kyc_audit_logs FOR SELECT TO authenticated USING (subject_user_id = auth.uid() OR public.is_admin());

-- ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kyc_log(p_profile uuid, p_app uuid, p_subject uuid, p_actor uuid, p_role text, p_action text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.kyc_audit_logs (kyc_profile_id, application_id, subject_user_id, actor_id, actor_role, action, detail)
  VALUES (p_profile, p_app, p_subject, p_actor, p_role, p_action, coalesce(p_detail, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.kyc_require_admin() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  RETURN auth.uid();
END $$;

-- Documents still needed before the applicant can submit (types; 'bank_proof' = cancelled cheque or bank statement).
CREATE OR REPLACE FUNCTION public.kyc_missing_documents(p_profile uuid) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.kyc_profiles;
  need text[] := ARRAY[]::text[];
  have text[];
BEGIN
  SELECT * INTO p FROM public.kyc_profiles WHERE id = p_profile;
  IF NOT FOUND THEN RETURN ARRAY[]::text[]; END IF;
  IF auth.uid() IS NOT NULL AND p.user_id <> auth.uid() AND NOT public.is_admin() THEN RETURN ARRAY[]::text[]; END IF;
  SELECT coalesce(array_agg(DISTINCT doc_type), ARRAY[]::text[]) INTO have
    FROM public.kyc_documents WHERE kyc_profile_id = p_profile AND status IN ('uploaded', 'accepted');
  IF p.pan_status <> 'verified' AND NOT 'pan_card' = ANY (have) THEN need := array_append(need, 'pan_card'); END IF;
  IF p.aadhaar_status <> 'verified' AND NOT 'aadhaar_masked' = ANY (have) THEN need := array_append(need, 'aadhaar_masked'); END IF;
  IF p.business_status <> 'verified' THEN
    IF p.gstin IS NOT NULL AND NOT 'gst_certificate' = ANY (have) THEN need := array_append(need, 'gst_certificate'); END IF;
    IF p.udyam_number IS NOT NULL AND NOT 'udyam_certificate' = ANY (have) THEN need := array_append(need, 'udyam_certificate'); END IF;
    IF p.entity_type IN ('private_limited', 'public_limited', 'llp') AND NOT 'incorporation_certificate' = ANY (have) THEN
      need := array_append(need, 'incorporation_certificate'); END IF;
    IF p.entity_type = 'partnership' AND NOT 'partnership_deed' = ANY (have) THEN need := array_append(need, 'partnership_deed'); END IF;
    IF p.business_pan_masked IS NOT NULL AND NOT 'business_pan_card' = ANY (have) THEN need := array_append(need, 'business_pan_card'); END IF;
  END IF;
  IF p.bank_status <> 'verified' AND NOT ('cancelled_cheque' = ANY (have) OR 'bank_statement' = ANY (have)) THEN
    need := array_append(need, 'bank_proof'); END IF;
  RETURN need;
END $$;

-- Works out the overall status from the steps.
CREATE OR REPLACE FUNCTION public.kyc_recompute(p_profile uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.kyc_profiles;
  s text;
BEGIN
  SELECT * INTO p FROM public.kyc_profiles WHERE id = p_profile FOR UPDATE;
  IF p.rejected_at IS NOT NULL THEN s := 'rejected';
  ELSIF p.pan_status = 'verified' AND p.aadhaar_status = 'verified' AND p.business_status = 'verified'
        AND p.bank_status = 'verified' AND p.review_status = 'verified' THEN s := 'verified';
  ELSIF 'resubmission_required' IN (p.pan_status, p.aadhaar_status, p.business_status, p.bank_status, p.review_status)
        OR 'rejected' IN (p.pan_status, p.aadhaar_status, p.business_status, p.bank_status) THEN s := 'resubmission_required';
  ELSIF p.review_status = 'in_progress' THEN s := 'in_progress';
  ELSIF p.consent_at IS NULL THEN s := 'not_started';
  ELSE s := 'pending';
  END IF;
  UPDATE public.kyc_profiles SET status = s, updated_at = now(),
    verified_at = CASE WHEN s = 'verified' THEN coalesce(verified_at, now()) ELSE NULL END
  WHERE id = p_profile;
  -- keep the applications in step with the KYC
  UPDATE public.loan_applications SET stage = 'kyc', updated_at = now()
   WHERE kyc_profile_id = p_profile AND stage = 'verification' AND s IN ('resubmission_required', 'pending');
  UPDATE public.loan_applications SET stage = 'verification', updated_at = now()
   WHERE kyc_profile_id = p_profile AND stage = 'kyc' AND s IN ('in_progress', 'verified') AND share_consent_at IS NOT NULL;
  RETURN s;
END $$;

-- Raises unless the applicant may still change this step.
CREATE OR REPLACE FUNCTION public.kyc_assert_editable(p public.kyc_profiles, p_step text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  IF p.consent_at IS NULL THEN RAISE EXCEPTION 'consent_required'; END IF;
  IF p.rejected_at IS NOT NULL THEN RAISE EXCEPTION 'kyc_rejected'; END IF;
  IF p.review_status IN ('in_progress', 'verified') AND p_step <> 'aadhaar' THEN RAISE EXCEPTION 'kyc_locked'; END IF;
  st := CASE p_step WHEN 'pan' THEN p.pan_status WHEN 'aadhaar' THEN p.aadhaar_status WHEN 'business' THEN p.business_status
                    WHEN 'bank' THEN p.bank_status ELSE 'pending' END;
  IF st IN ('verified', 'in_progress') THEN RAISE EXCEPTION 'step_locked'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.kyc_profile_for(p_user uuid) RETURNS public.kyc_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.kyc_profiles;
BEGIN
  SELECT * INTO p FROM public.kyc_profiles WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consent_required'; END IF;
  RETURN p;
END $$;

-- ── loan request → application ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.loan_application_from_request(r public.loan_requests) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE app uuid; prof uuid;
BEGIN
  IF r.user_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO app FROM public.loan_applications WHERE loan_request_id = r.id;
  IF app IS NOT NULL THEN RETURN app; END IF;
  SELECT id INTO prof FROM public.kyc_profiles WHERE user_id = r.user_id;
  INSERT INTO public.loan_applications (user_id, loan_request_id, kyc_profile_id, amount, currency, tenure_months, purpose)
  VALUES (r.user_id, r.id, prof, r.loan_amount, coalesce(r.currency, 'INR'), r.tenure_months, left(r.goods_needed, 300))
  RETURNING id INTO app;
  PERFORM public.kyc_log(prof, app, r.user_id, r.user_id, 'applicant', 'loan_request_received', jsonb_build_object('amount', r.loan_amount));
  RETURN app;
END $$;

CREATE OR REPLACE FUNCTION public.loan_requests_to_application() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.loan_application_from_request(NEW);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS loan_requests_application ON public.loan_requests;
CREATE TRIGGER loan_requests_application AFTER INSERT ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.loan_requests_to_application();

CREATE OR REPLACE FUNCTION public.loan_claim_request(p_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.loan_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  IF p_token IS NULL OR char_length(p_token) < 32 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  UPDATE public.loan_requests SET user_id = auth.uid(), claim_token_hash = NULL
   WHERE claim_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') AND user_id IS NULL AND created_at > now() - interval '7 days'
  RETURNING * INTO r;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.loan_application_from_request(r);
END $$;

-- ── applicant functions ───────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kyc_give_consent(p_application_id uuid, p_consent_version text, p_consent_text_sha256 text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  prof public.kyc_profiles;
  cur text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
  SELECT consent_version INTO cur FROM public.kyc_settings;
  IF p_consent_version IS DISTINCT FROM cur THEN RAISE EXCEPTION 'consent_outdated'; END IF;
  IF p_consent_text_sha256 IS NULL OR p_consent_text_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'consent_required'; END IF;
  IF p_application_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.loan_applications WHERE id = p_application_id AND user_id = me) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  INSERT INTO public.kyc_profiles (user_id) VALUES (me) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.kyc_profiles SET consent_version = p_consent_version, consent_text_sha256 = p_consent_text_sha256,
         consent_at = now(), updated_at = now()
   WHERE user_id = me RETURNING * INTO prof;
  UPDATE public.loan_applications SET kyc_profile_id = prof.id, updated_at = now()
   WHERE user_id = me AND kyc_profile_id IS NULL AND stage IN ('kyc', 'verification');
  PERFORM public.kyc_log(prof.id, p_application_id, me, me, 'applicant', 'consent_given',
    jsonb_build_object('version', p_consent_version, 'text_sha256', p_consent_text_sha256));
  PERFORM public.kyc_recompute(prof.id);
  RETURN prof.id;
END $$;

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
  IF NOT EXISTS (SELECT 1 FROM public.loan_applications WHERE id = p_application_id AND user_id = me AND stage IN ('kyc', 'verification')) THEN
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
  UPDATE public.loan_applications SET share_consent_at = coalesce(share_consent_at, now()), kyc_profile_id = p.id, updated_at = now()
   WHERE id = p_application_id;
  IF p.review_status <> 'verified' THEN
    UPDATE public.kyc_profiles SET review_status = 'in_progress', submitted_at = now(),
           step_notes = step_notes - 'review', updated_at = now() WHERE id = p.id;
  END IF;
  PERFORM public.kyc_log(p.id, p_application_id, me, me, 'applicant', 'submitted_for_review', '{}'::jsonb);
  RETURN public.kyc_recompute(p.id);
END $$;

CREATE OR REPLACE FUNCTION public.loan_withdraw_application(p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a public.loan_applications; keep int;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = p_application_id AND user_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage NOT IN ('kyc', 'verification', 'partner_review') THEN RAISE EXCEPTION 'cannot_withdraw'; END IF;
  UPDATE public.loan_applications SET stage = 'withdrawn', withdrawn_at = now(), updated_at = now() WHERE id = a.id;
  -- nothing else active: the documents go after the shorter retention
  IF a.kyc_profile_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.loan_applications WHERE kyc_profile_id = a.kyc_profile_id AND stage IN ('kyc', 'verification', 'partner_review')) THEN
    SELECT abandoned_retention_days INTO keep FROM public.kyc_settings;
    UPDATE public.kyc_documents SET delete_after = least(delete_after, now() + make_interval(days => keep))
     WHERE kyc_profile_id = a.kyc_profile_id AND status <> 'purged';
  END IF;
  PERFORM public.kyc_log(a.kyc_profile_id, a.id, me, me, 'applicant', 'application_withdrawn', '{}'::jsonb);
END $$;

-- ── service functions (called by the kyc edge function with the service role) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kyc_service_state(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('profile', to_jsonb(p), 'settings', (SELECT to_jsonb(s) FROM public.kyc_settings s),
                            'is_admin', EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role = 'admin'),
                            'aadhaar_request', (SELECT jsonb_build_object('client_ref', v.client_ref, 'status', v.status, 'created_at', v.created_at)
                                                FROM public.verification_requests v
                                                WHERE v.user_id = p_user AND v.check_type = 'aadhaar_digilocker' AND v.client_ref IS NOT NULL
                                                ORDER BY v.created_at DESC LIMIT 1))
  FROM (SELECT 1) one LEFT JOIN public.kyc_profiles p ON p.user_id = p_user;
$$;

CREATE OR REPLACE FUNCTION public.kyc_service_save_pan(p_user uuid, p_pan_masked text, p_pan_hash text, p_name text,
  p_ciphertext text, p_iv text, p_key_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.kyc_profiles;
BEGIN
  p := public.kyc_profile_for(p_user);
  PERFORM public.kyc_assert_editable(p, 'pan');
  IF p_pan_masked !~ '^[A-Z]{2}X{6}[0-9A-Z]{2}$' OR char_length(btrim(coalesce(p_name, ''))) < 2 THEN RAISE EXCEPTION 'invalid_pan'; END IF;
  INSERT INTO kyc_private.secrets (kyc_profile_id, kind, ciphertext, iv, key_id) VALUES (p.id, 'pan', p_ciphertext, p_iv, p_key_id)
  ON CONFLICT (kyc_profile_id, kind) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, key_id = EXCLUDED.key_id, updated_at = now();
  UPDATE public.kyc_profiles SET pan_masked = p_pan_masked, pan_hash = p_pan_hash, pan_name = btrim(p_name),
         pan_registered_name = NULL, pan_type = NULL, pan_verified_via = NULL, pan_status = 'pending',
         step_notes = step_notes - 'pan', updated_at = now()
   WHERE id = p.id;
  PERFORM public.kyc_log(p.id, NULL, p_user, p_user, 'applicant', 'pan_saved', jsonb_build_object('pan', p_pan_masked));
  PERFORM public.kyc_recompute(p.id);
  RETURN p.id;
END $$;

CREATE OR REPLACE FUNCTION public.kyc_service_save_business(p_user uuid, p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.kyc_profiles;
BEGIN
  k := public.kyc_profile_for(p_user);
  PERFORM public.kyc_assert_editable(k, 'business');
  IF coalesce(p->>'entity_type', '') NOT IN ('proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'other')
     OR char_length(btrim(coalesce(p->>'business_name', ''))) < 2 THEN
    RAISE EXCEPTION 'invalid_business';
  END IF;
  IF p->>'entity_type' IN ('private_limited', 'public_limited', 'llp') AND nullif(p->>'cin', '') IS NULL THEN RAISE EXCEPTION 'cin_required'; END IF;
  IF p->>'entity_type' <> 'proprietorship' AND nullif(p->>'business_pan_masked', '') IS NULL THEN RAISE EXCEPTION 'business_pan_required'; END IF;
  IF nullif(p->>'business_pan_ciphertext', '') IS NOT NULL THEN
    INSERT INTO kyc_private.secrets (kyc_profile_id, kind, ciphertext, iv, key_id)
    VALUES (k.id, 'business_pan', p->>'business_pan_ciphertext', p->>'business_pan_iv', p->>'key_id')
    ON CONFLICT (kyc_profile_id, kind) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, key_id = EXCLUDED.key_id, updated_at = now();
  ELSE
    DELETE FROM kyc_private.secrets WHERE kyc_profile_id = k.id AND kind = 'business_pan';
  END IF;
  UPDATE public.kyc_profiles SET
    entity_type = p->>'entity_type', business_name = btrim(p->>'business_name'),
    gstin = nullif(p->>'gstin', ''), udyam_number = nullif(p->>'udyam_number', ''), cin = nullif(p->>'cin', ''),
    business_pan_masked = nullif(p->>'business_pan_masked', ''), business_pan_hash = nullif(p->>'business_pan_hash', ''),
    gst_legal_name = NULL, gst_status = NULL, business_verified_via = NULL, business_status = 'pending',
    step_notes = step_notes - 'business', updated_at = now()
  WHERE id = k.id;
  PERFORM public.kyc_log(k.id, NULL, p_user, p_user, 'applicant', 'business_saved',
    jsonb_build_object('entity_type', p->>'entity_type', 'gstin', nullif(p->>'gstin', ''), 'udyam', nullif(p->>'udyam_number', ''), 'cin', nullif(p->>'cin', '')));
  PERFORM public.kyc_recompute(k.id);
  RETURN k.id;
END $$;

CREATE OR REPLACE FUNCTION public.kyc_service_save_bank(p_user uuid, p_holder text, p_last4 text, p_hash text, p_ifsc text,
  p_ciphertext text, p_iv text, p_key_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.kyc_profiles; b uuid;
BEGIN
  k := public.kyc_profile_for(p_user);
  PERFORM public.kyc_assert_editable(k, 'bank');
  INSERT INTO kyc_private.secrets (kyc_profile_id, kind, ciphertext, iv, key_id) VALUES (k.id, 'bank_account', p_ciphertext, p_iv, p_key_id)
  ON CONFLICT (kyc_profile_id, kind) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, key_id = EXCLUDED.key_id, updated_at = now();
  UPDATE public.bank_verifications SET is_current = false, updated_at = now() WHERE kyc_profile_id = k.id AND is_current;
  INSERT INTO public.bank_verifications (kyc_profile_id, user_id, account_holder_name, account_last4, account_hash, ifsc)
  VALUES (k.id, p_user, btrim(p_holder), upper(p_last4), p_hash, upper(p_ifsc)) RETURNING id INTO b;
  UPDATE public.kyc_profiles SET bank_status = 'pending', step_notes = step_notes - 'bank', updated_at = now() WHERE id = k.id;
  PERFORM public.kyc_log(k.id, NULL, p_user, p_user, 'applicant', 'bank_saved', jsonb_build_object('account', 'XXXX' || upper(p_last4), 'ifsc', upper(p_ifsc)));
  PERFORM public.kyc_recompute(k.id);
  RETURN b;
END $$;

-- Records one provider check and applies its outcome to the step.
--   p_outcome: 'verified' (production only) | 'review' (needs an admin) | 'invalid' (applicant must correct) |
--              'error' (try again) | 'integration_pending' | 'test_only' (sandbox) | 'requested' | 'expired' | 'consent_denied'
--   p_fields: values the provider returned that the step keeps (registered names, GST status, bank name, Aadhaar last 4 ...)
CREATE OR REPLACE FUNCTION public.kyc_service_record_check(p_user uuid, p_step text, p_check_type text, p_provider text,
  p_environment text, p_outcome text, p_provider_ref text, p_client_ref text, p_result jsonb, p_message text, p_fields jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k public.kyc_profiles;
  req uuid;
  req_status text;
  new_step text;
  bank_id uuid;
BEGIN
  k := public.kyc_profile_for(p_user);
  IF p_step NOT IN ('pan', 'aadhaar', 'business', 'bank') THEN RAISE EXCEPTION 'invalid_step'; END IF;
  IF p_outcome NOT IN ('verified', 'review', 'invalid', 'error', 'integration_pending', 'test_only', 'requested', 'expired', 'consent_denied') THEN
    RAISE EXCEPTION 'invalid_outcome';
  END IF;
  IF p_outcome = 'verified' AND (p_environment <> 'production' OR coalesce(p_provider, '') IN ('', 'admin')) THEN
    RAISE EXCEPTION 'verified_needs_production_provider';
  END IF;
  IF p_step = 'aadhaar' AND p_check_type <> 'aadhaar_digilocker' THEN RAISE EXCEPTION 'aadhaar_digilocker_only'; END IF;
  -- results for a step the applicant can no longer change (verified, or under review) are kept but change nothing
  IF k.rejected_at IS NOT NULL OR (k.review_status IN ('in_progress', 'verified') AND p_step <> 'aadhaar')
     OR (CASE p_step WHEN 'pan' THEN k.pan_status WHEN 'aadhaar' THEN k.aadhaar_status WHEN 'business' THEN k.business_status ELSE k.bank_status END) = 'verified' THEN
    p_outcome := CASE WHEN p_outcome = 'verified' THEN 'review' ELSE p_outcome END;
    new_step := NULL;
  ELSE
    new_step := CASE p_outcome WHEN 'verified' THEN 'verified' WHEN 'review' THEN 'in_progress' WHEN 'invalid' THEN 'resubmission_required'
                               WHEN 'consent_denied' THEN 'pending' WHEN 'expired' THEN 'pending' ELSE 'pending' END;
  END IF;
  req_status := CASE p_outcome WHEN 'verified' THEN 'success' WHEN 'invalid' THEN 'failed' ELSE p_outcome END;

  IF p_client_ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.verification_requests WHERE client_ref = p_client_ref) THEN
    UPDATE public.verification_requests SET status = req_status, provider_ref = coalesce(p_provider_ref, provider_ref),
           result = coalesce(p_result, '{}'::jsonb), message = p_message,
           completed_at = CASE WHEN req_status = 'requested' THEN NULL ELSE now() END
     WHERE client_ref = p_client_ref AND user_id = p_user RETURNING id INTO req;
    IF req IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  ELSE
    INSERT INTO public.verification_requests (kyc_profile_id, user_id, step, check_type, provider, environment, status, provider_ref,
                                              client_ref, result, message, requested_by, completed_at)
    VALUES (k.id, p_user, p_step, p_check_type, coalesce(p_provider, 'none'), p_environment, req_status, p_provider_ref, p_client_ref,
            coalesce(p_result, '{}'::jsonb), p_message, p_user, CASE WHEN req_status = 'requested' THEN NULL ELSE now() END)
    RETURNING id INTO req;
  END IF;

  IF new_step IS NOT NULL THEN
    IF p_step = 'pan' THEN
      UPDATE public.kyc_profiles SET pan_status = new_step,
             pan_registered_name = coalesce(p_fields->>'registered_name', pan_registered_name),
             pan_type = coalesce(p_fields->>'pan_type', pan_type),
             pan_verified_via = CASE WHEN new_step = 'verified' THEN 'provider' ELSE NULL END
       WHERE id = k.id;
    ELSIF p_step = 'aadhaar' THEN
      UPDATE public.kyc_profiles SET aadhaar_status = new_step,
             aadhaar_last4 = CASE WHEN p_fields->>'aadhaar_last4' ~ '^[0-9]{4}$' THEN p_fields->>'aadhaar_last4' ELSE aadhaar_last4 END,
             aadhaar_name = coalesce(p_fields->>'name', aadhaar_name),
             aadhaar_verified_via = CASE WHEN new_step = 'verified' THEN 'digilocker' ELSE NULL END
       WHERE id = k.id;
    ELSIF p_step = 'business' THEN
      UPDATE public.kyc_profiles SET business_status = new_step,
             gst_legal_name = coalesce(p_fields->>'legal_name', gst_legal_name),
             gst_status = coalesce(p_fields->>'gst_status', gst_status),
             business_verified_via = CASE WHEN new_step = 'verified' THEN 'provider' ELSE NULL END
       WHERE id = k.id;
    ELSE
      SELECT id INTO bank_id FROM public.bank_verifications WHERE kyc_profile_id = k.id AND is_current;
      IF bank_id IS NULL THEN RAISE EXCEPTION 'details_missing'; END IF;
      UPDATE public.bank_verifications SET status = new_step, verification_request_id = req,
             bank_name = coalesce(p_fields->>'bank_name', bank_name), branch = coalesce(p_fields->>'branch', branch),
             name_at_bank = coalesce(p_fields->>'name_at_bank', name_at_bank),
             name_match_result = coalesce(p_fields->>'name_match_result', name_match_result),
             name_match_score = coalesce(nullif(p_fields->>'name_match_score', '')::numeric, name_match_score),
             verified_via = CASE WHEN new_step = 'verified' THEN 'provider' ELSE NULL END, updated_at = now()
       WHERE id = bank_id;
      UPDATE public.kyc_profiles SET bank_status = new_step WHERE id = k.id;
    END IF;
    UPDATE public.kyc_profiles SET updated_at = now(),
           step_notes = CASE WHEN p_message IS NULL OR p_outcome IN ('verified', 'integration_pending') THEN step_notes - p_step
                             ELSE step_notes || jsonb_build_object(p_step, p_message) END
     WHERE id = k.id;
  END IF;
  PERFORM public.kyc_log(k.id, NULL, p_user, NULL, 'system', 'check_recorded',
    jsonb_build_object('step', p_step, 'check', p_check_type, 'provider', p_provider, 'environment', p_environment, 'outcome', p_outcome));
  PERFORM public.kyc_recompute(k.id);
  RETURN req;
END $$;

CREATE OR REPLACE FUNCTION public.kyc_service_add_document(p_user uuid, p_step text, p_doc_type text, p_file_name text, p_mime text,
  p_size integer, p_sha256 text, p_path text, p_iv text, p_key_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.kyc_profiles; d uuid; keep int; maxmb int; n int;
BEGIN
  k := public.kyc_profile_for(p_user);
  PERFORM public.kyc_assert_editable(k, p_step);
  SELECT abandoned_retention_days, max_file_mb INTO keep, maxmb FROM public.kyc_settings;
  IF p_size > maxmb * 1048576 THEN RAISE EXCEPTION 'file_too_large'; END IF;
  SELECT count(*) INTO n FROM public.kyc_documents WHERE kyc_profile_id = k.id AND status <> 'purged';
  IF n >= 40 THEN RAISE EXCEPTION 'too_many_documents'; END IF;
  INSERT INTO public.kyc_documents (kyc_profile_id, user_id, step, doc_type, file_name, mime_type, size_bytes, sha256, storage_path,
                                    enc_iv, enc_key_id, delete_after)
  VALUES (k.id, p_user, p_step, p_doc_type, p_file_name, p_mime, p_size, p_sha256, p_path, p_iv, p_key_id, now() + make_interval(days => keep))
  RETURNING id INTO d;
  PERFORM public.kyc_log(k.id, NULL, p_user, p_user, 'applicant', 'document_uploaded', jsonb_build_object('document', d, 'type', p_doc_type, 'size', p_size));
  RETURN d;
END $$;

-- The applicant can remove a document they uploaded while the step is still open.
CREATE OR REPLACE FUNCTION public.kyc_service_remove_document(p_user uuid, p_doc uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.kyc_profiles; d public.kyc_documents;
BEGIN
  k := public.kyc_profile_for(p_user);
  SELECT * INTO d FROM public.kyc_documents WHERE id = p_doc AND user_id = p_user AND status IN ('uploaded', 'rejected', 'resubmission_required');
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM public.kyc_assert_editable(k, d.step);
  UPDATE public.kyc_documents SET status = 'purged', purged_at = now() WHERE id = d.id;
  PERFORM public.kyc_log(k.id, NULL, p_user, p_user, 'applicant', 'document_removed', jsonb_build_object('document', d.id, 'type', d.doc_type));
  RETURN d.storage_path;
END $$;

-- Where a document is stored, for its owner or an admin; every opening is logged.
CREATE OR REPLACE FUNCTION public.kyc_service_document_for(p_actor uuid, p_doc uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.kyc_documents; adm boolean;
BEGIN
  SELECT * INTO d FROM public.kyc_documents WHERE id = p_doc AND status <> 'purged';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  adm := EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND role = 'admin');
  IF d.user_id <> p_actor AND NOT adm THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM public.kyc_log(d.kyc_profile_id, NULL, d.user_id, p_actor, CASE WHEN adm AND d.user_id <> p_actor THEN 'admin' ELSE 'applicant' END,
    'document_viewed', jsonb_build_object('document', d.id, 'type', d.doc_type));
  RETURN jsonb_build_object('path', d.storage_path, 'iv', d.enc_iv, 'key_id', d.enc_key_id, 'mime_type', d.mime_type, 'file_name', d.file_name);
END $$;

CREATE OR REPLACE FUNCTION public.kyc_service_expired_documents(p_limit integer DEFAULT 200) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', storage_path)), '[]'::jsonb)
  FROM (SELECT id, storage_path FROM public.kyc_documents WHERE status <> 'purged' AND delete_after < now()
        ORDER BY delete_after LIMIT greatest(1, least(p_limit, 1000))) e;
$$;

CREATE OR REPLACE FUNCTION public.kyc_service_mark_purged(p_actor uuid, p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.kyc_documents SET status = 'purged', purged_at = now() WHERE id = ANY (p_ids) AND status <> 'purged';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.kyc_log(NULL, NULL, NULL, p_actor, CASE WHEN p_actor IS NULL THEN 'system' ELSE 'admin' END, 'documents_purged', jsonb_build_object('count', n));
  RETURN n;
END $$;

-- ── admin functions ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_kyc_applications(p_filter text DEFAULT 'review', p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  PERFORM public.kyc_require_admin();
  WITH apps AS (
    SELECT a.*, k.status AS kyc_status, k.pan_status, k.aadhaar_status, k.business_status, k.bank_status, k.review_status,
           k.business_name, k.submitted_at, pr.full_name, pr.email, lr.company_name AS request_company, lr.phone AS request_phone,
           lr.city AS request_city,
           (SELECT count(*) FROM public.kyc_documents d WHERE d.kyc_profile_id = k.id AND d.status = 'uploaded') AS docs_to_review
    FROM public.loan_applications a
    LEFT JOIN public.kyc_profiles k ON k.id = a.kyc_profile_id
    LEFT JOIN public.profiles pr ON pr.id = a.user_id
    LEFT JOIN public.loan_requests lr ON lr.id = a.loan_request_id
    WHERE (CASE coalesce(p_filter, 'all')
             WHEN 'review' THEN a.stage = 'verification' AND k.status = 'in_progress'
             WHEN 'kyc' THEN a.stage = 'kyc'
             WHEN 'resubmission' THEN k.status = 'resubmission_required'
             WHEN 'verified' THEN k.status = 'verified' AND a.stage = 'verification'
             WHEN 'partner' THEN a.stage = 'partner_review'
             WHEN 'decided' THEN a.stage = 'decision'
             WHEN 'rejected' THEN k.status = 'rejected'
             WHEN 'withdrawn' THEN a.stage = 'withdrawn'
             ELSE true END)
      AND (p_search IS NULL OR btrim(p_search) = '' OR concat_ws(' ', pr.full_name, pr.email, lr.company_name, k.business_name, lr.city, a.id::text)
           ILIKE '%' || btrim(p_search) || '%')
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM apps),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.updated_at DESC)
                      FROM (SELECT * FROM apps ORDER BY updated_at DESC LIMIT least(greatest(p_limit, 1), 200) OFFSET greatest(p_offset, 0)) r), '[]'::jsonb),
    'counts', (SELECT jsonb_build_object(
        'review', count(*) FILTER (WHERE a.stage = 'verification' AND k.status = 'in_progress'),
        'kyc', count(*) FILTER (WHERE a.stage = 'kyc'),
        'resubmission', count(*) FILTER (WHERE k.status = 'resubmission_required'),
        'verified', count(*) FILTER (WHERE k.status = 'verified' AND a.stage = 'verification'),
        'partner', count(*) FILTER (WHERE a.stage = 'partner_review'),
        'decided', count(*) FILTER (WHERE a.stage = 'decision'))
      FROM public.loan_applications a LEFT JOIN public.kyc_profiles k ON k.id = a.kyc_profile_id))
  INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_kyc_detail(p_application_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications; res jsonb;
BEGIN
  PERFORM public.kyc_require_admin();
  SELECT * INTO a FROM public.loan_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT jsonb_build_object(
    'application', to_jsonb(a),
    'applicant', (SELECT jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'role', pr.role) FROM public.profiles pr WHERE pr.id = a.user_id),
    'request', (SELECT jsonb_build_object('full_name', lr.full_name, 'company_name', lr.company_name, 'email', lr.email, 'phone', lr.phone,
                                          'city', lr.city, 'goods_needed', lr.goods_needed, 'created_at', lr.created_at)
                FROM public.loan_requests lr WHERE lr.id = a.loan_request_id),
    'profile', (SELECT to_jsonb(k) - 'pan_hash' - 'business_pan_hash' FROM public.kyc_profiles k WHERE k.id = a.kyc_profile_id),
    'missing_documents', to_jsonb(public.kyc_missing_documents(a.kyc_profile_id)),
    'documents', coalesce((SELECT jsonb_agg(to_jsonb(d) - 'enc_iv' - 'enc_key_id' - 'storage_path' ORDER BY d.uploaded_at DESC)
                           FROM public.kyc_documents d WHERE d.kyc_profile_id = a.kyc_profile_id), '[]'::jsonb),
    'checks', coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC) FROM public.verification_requests v
                        WHERE v.kyc_profile_id = a.kyc_profile_id), '[]'::jsonb),
    'bank', (SELECT to_jsonb(b) - 'account_hash' FROM public.bank_verifications b WHERE b.kyc_profile_id = a.kyc_profile_id AND b.is_current),
    'logs', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
                      FROM (SELECT * FROM public.kyc_audit_logs l WHERE l.subject_user_id = a.user_id ORDER BY created_at DESC LIMIT 200) l), '[]'::jsonb),
    'other_applications', coalesce((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'amount', o.amount, 'stage', o.stage, 'created_at', o.created_at))
                                    FROM public.loan_applications o WHERE o.user_id = a.user_id AND o.id <> a.id), '[]'::jsonb))
  INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_kyc_document_action(p_doc uuid, p_action text, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.kyc_require_admin(); d public.kyc_documents; st text;
BEGIN
  SELECT * INTO d FROM public.kyc_documents WHERE id = p_doc AND status <> 'purged' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  st := CASE p_action WHEN 'accept' THEN 'accepted' WHEN 'reject' THEN 'rejected' WHEN 'request_resubmission' THEN 'resubmission_required' END;
  IF st IS NULL THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF st <> 'accepted' AND char_length(btrim(coalesce(p_note, ''))) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
  -- an Aadhaar copy that is not accepted (for example a full, unmasked Aadhaar) is deleted at the next clean-up
  UPDATE public.kyc_documents SET status = st, review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = me, reviewed_at = now(),
         delete_after = CASE WHEN d.doc_type = 'aadhaar_masked' AND st <> 'accepted' THEN now() ELSE delete_after END
   WHERE id = d.id;
  IF st = 'resubmission_required' THEN
    UPDATE public.kyc_profiles SET review_status = CASE WHEN review_status = 'verified' THEN review_status ELSE 'resubmission_required' END,
           step_notes = step_notes || jsonb_build_object('review', btrim(p_note)), updated_at = now()
     WHERE id = d.kyc_profile_id;
    PERFORM public.kyc_recompute(d.kyc_profile_id);
  END IF;
  PERFORM public.kyc_log(d.kyc_profile_id, NULL, d.user_id, me, 'admin', 'document_' || p_action, jsonb_build_object('document', d.id, 'type', d.doc_type, 'note', p_note));
  RETURN st;
END $$;

-- p_action: 'verify_by_document' (needs an accepted document for the step; for Aadhaar a masked copy) | 'reject' | 'request_resubmission' | 'reopen'
CREATE OR REPLACE FUNCTION public.admin_kyc_step_action(p_profile uuid, p_step text, p_action text, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.kyc_require_admin(); k public.kyc_profiles; st text; note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  SELECT * INTO k FROM public.kyc_profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_step NOT IN ('pan', 'aadhaar', 'business', 'bank') THEN RAISE EXCEPTION 'invalid_step'; END IF;
  IF p_action IN ('reject', 'request_resubmission') AND char_length(coalesce(note, '')) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
  IF p_action = 'verify_by_document' THEN
    IF NOT EXISTS (SELECT 1 FROM public.kyc_documents WHERE kyc_profile_id = k.id AND step = p_step AND status = 'accepted') THEN
      RAISE EXCEPTION 'accepted_document_required';
    END IF;
    IF p_step = 'pan' AND k.pan_hash IS NULL OR p_step = 'business' AND k.entity_type IS NULL THEN RAISE EXCEPTION 'details_missing'; END IF;
    st := 'verified';
  ELSIF p_action = 'reject' THEN st := 'rejected';
  ELSIF p_action = 'request_resubmission' THEN st := 'resubmission_required';
  ELSIF p_action = 'reopen' THEN st := 'pending';
  ELSE RAISE EXCEPTION 'invalid_action';
  END IF;

  IF p_step = 'pan' THEN
    UPDATE public.kyc_profiles SET pan_status = st, pan_verified_via = CASE WHEN st = 'verified' THEN 'document_review' ELSE NULL END WHERE id = k.id;
  ELSIF p_step = 'aadhaar' THEN
    UPDATE public.kyc_profiles SET aadhaar_status = st, aadhaar_verified_via = CASE WHEN st = 'verified' THEN 'document_review' ELSE NULL END WHERE id = k.id;
  ELSIF p_step = 'business' THEN
    UPDATE public.kyc_profiles SET business_status = st, business_verified_via = CASE WHEN st = 'verified' THEN 'document_review' ELSE NULL END WHERE id = k.id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.bank_verifications WHERE kyc_profile_id = k.id AND is_current) THEN RAISE EXCEPTION 'details_missing'; END IF;
    UPDATE public.bank_verifications SET status = st, verified_via = CASE WHEN st = 'verified' THEN 'document_review' ELSE NULL END, updated_at = now()
     WHERE kyc_profile_id = k.id AND is_current;
    UPDATE public.kyc_profiles SET bank_status = st WHERE id = k.id;
  END IF;
  -- a step sent back reopens the applicant's form
  UPDATE public.kyc_profiles SET
    review_status = CASE WHEN st IN ('resubmission_required', 'rejected', 'pending') AND review_status IN ('in_progress', 'verified') THEN 'resubmission_required' ELSE review_status END,
    step_notes = CASE WHEN note IS NULL THEN step_notes - p_step ELSE step_notes || jsonb_build_object(p_step, note) END,
    updated_at = now()
   WHERE id = k.id;
  INSERT INTO public.verification_requests (kyc_profile_id, user_id, step, check_type, provider, environment, status, result, message, requested_by, completed_at)
  VALUES (k.id, k.user_id, p_step, 'document_review', 'admin', 'none',
          CASE st WHEN 'verified' THEN 'success' WHEN 'pending' THEN 'review' ELSE 'failed' END, '{}'::jsonb, note, me, now());
  PERFORM public.kyc_log(k.id, NULL, k.user_id, me, 'admin', 'step_' || p_action, jsonb_build_object('step', p_step, 'note', note));
  RETURN public.kyc_recompute(k.id);
END $$;

-- p_action: 'approve' (every step verified) | 'reject' (final, with a reason) | 'request_resubmission' | 'reopen' (undo a rejection)
CREATE OR REPLACE FUNCTION public.admin_kyc_decision(p_profile uuid, p_action text, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.kyc_require_admin(); k public.kyc_profiles; note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  SELECT * INTO k FROM public.kyc_profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_action IN ('reject', 'request_resubmission') AND char_length(coalesce(note, '')) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
  IF p_action = 'approve' THEN
    IF k.rejected_at IS NOT NULL THEN RAISE EXCEPTION 'kyc_rejected'; END IF;
    IF NOT (k.pan_status = 'verified' AND k.aadhaar_status = 'verified' AND k.business_status = 'verified' AND k.bank_status = 'verified') THEN
      RAISE EXCEPTION 'steps_not_verified';
    END IF;
    IF k.submitted_at IS NULL THEN RAISE EXCEPTION 'not_submitted'; END IF;
    UPDATE public.kyc_profiles SET review_status = 'verified', status_reason = note, decided_by = me, step_notes = step_notes - 'review' WHERE id = k.id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.kyc_profiles SET review_status = 'rejected', rejected_at = now(), status_reason = note, decided_by = me,
           step_notes = step_notes || jsonb_build_object('review', note) WHERE id = k.id;
  ELSIF p_action = 'request_resubmission' THEN
    UPDATE public.kyc_profiles SET review_status = 'resubmission_required', status_reason = note, decided_by = me,
           step_notes = step_notes || jsonb_build_object('review', note) WHERE id = k.id;
  ELSIF p_action = 'reopen' THEN
    UPDATE public.kyc_profiles SET review_status = 'resubmission_required', rejected_at = NULL, status_reason = note, decided_by = me WHERE id = k.id;
  ELSE RAISE EXCEPTION 'invalid_action';
  END IF;
  PERFORM public.kyc_log(k.id, NULL, k.user_id, me, 'admin', 'kyc_' || p_action, jsonb_build_object('note', note));
  RETURN public.kyc_recompute(k.id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_loan_forward(p_application_id uuid, p_partner text, p_reference text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.kyc_require_admin(); a public.loan_applications; ks text;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'verification' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  SELECT status INTO ks FROM public.kyc_profiles WHERE id = a.kyc_profile_id;
  IF ks IS DISTINCT FROM 'verified' THEN RAISE EXCEPTION 'kyc_not_verified'; END IF;
  IF a.share_consent_at IS NULL THEN RAISE EXCEPTION 'share_consent_required'; END IF;
  IF char_length(btrim(coalesce(p_partner, ''))) < 2 THEN RAISE EXCEPTION 'partner_required'; END IF;
  UPDATE public.loan_applications SET stage = 'partner_review', lending_partner = btrim(p_partner),
         partner_reference = nullif(btrim(coalesce(p_reference, '')), ''), forwarded_at = now(), forwarded_by = me, updated_at = now()
   WHERE id = a.id;
  PERFORM public.kyc_log(a.kyc_profile_id, a.id, a.user_id, me, 'admin', 'forwarded_to_partner', jsonb_build_object('partner', btrim(p_partner), 'reference', p_reference));
  RETURN 'partner_review';
END $$;

-- Records the lending partner's decision. BulkSkart does not approve or decline loans itself.
CREATE OR REPLACE FUNCTION public.admin_loan_record_decision(p_application_id uuid, p_decision text, p_amount numeric DEFAULT NULL, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.kyc_require_admin(); a public.loan_applications;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.stage <> 'partner_review' THEN RAISE EXCEPTION 'wrong_stage'; END IF;
  IF p_decision NOT IN ('approved_by_partner', 'declined_by_partner') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF char_length(btrim(coalesce(p_note, ''))) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
  UPDATE public.loan_applications SET stage = 'decision', decision = p_decision,
         decision_amount = CASE WHEN p_decision = 'approved_by_partner' THEN p_amount ELSE NULL END,
         decision_note = btrim(p_note), decided_at = now(), decision_recorded_by = me, updated_at = now()
   WHERE id = a.id;
  UPDATE public.kyc_documents SET delete_after = now() + make_interval(days => (SELECT document_retention_days FROM public.kyc_settings))
   WHERE kyc_profile_id = a.kyc_profile_id AND status <> 'purged';
  PERFORM public.kyc_log(a.kyc_profile_id, a.id, a.user_id, me, 'admin', 'partner_decision_recorded',
    jsonb_build_object('decision', p_decision, 'partner', a.lending_partner, 'amount', p_amount));
  RETURN 'decision';
END $$;

CREATE OR REPLACE FUNCTION public.admin_kyc_update_settings(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.kyc_require_admin(); res jsonb;
BEGIN
  UPDATE public.kyc_settings SET
    document_retention_days = coalesce((p->>'document_retention_days')::int, document_retention_days),
    abandoned_retention_days = coalesce((p->>'abandoned_retention_days')::int, abandoned_retention_days),
    max_file_mb = coalesce((p->>'max_file_mb')::int, max_file_mb),
    review_hours = coalesce((p->>'review_hours')::int, review_hours),
    updated_at = now(), updated_by = me
  RETURNING to_jsonb(kyc_settings.*) INTO res;
  PERFORM public.kyc_log(NULL, NULL, NULL, me, 'admin', 'settings_updated', p);
  RETURN res;
END $$;

-- ── who may call what ─────────────────────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND (p.proname LIKE 'kyc\_%' OR p.proname LIKE 'admin\_kyc\_%' OR p.proname LIKE 'admin\_loan\_%'
                                           OR p.proname IN ('loan_claim_request', 'loan_withdraw_application', 'loan_application_from_request',
                                                            'loan_requests_to_application'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.loan_claim_request(text), public.kyc_give_consent(uuid, text, text), public.kyc_submit(uuid, boolean),
  public.loan_withdraw_application(uuid), public.kyc_missing_documents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kyc_applications(text, text, integer, integer), public.admin_kyc_detail(uuid),
  public.admin_kyc_document_action(uuid, text, text), public.admin_kyc_step_action(uuid, text, text, text),
  public.admin_kyc_decision(uuid, text, text), public.admin_loan_forward(uuid, text, text),
  public.admin_loan_record_decision(uuid, text, numeric, text), public.admin_kyc_update_settings(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kyc_service_state(uuid), public.kyc_service_save_pan(uuid, text, text, text, text, text, text),
  public.kyc_service_save_business(uuid, jsonb), public.kyc_service_save_bank(uuid, text, text, text, text, text, text, text),
  public.kyc_service_record_check(uuid, text, text, text, text, text, text, text, jsonb, text, jsonb),
  public.kyc_service_add_document(uuid, text, text, text, text, integer, text, text, text, text),
  public.kyc_service_remove_document(uuid, uuid), public.kyc_service_document_for(uuid, uuid),
  public.kyc_service_expired_documents(integer), public.kyc_service_mark_purged(uuid, uuid[]),
  public.kyc_missing_documents(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
