/**
 * Business loan KYC (migration 00075 + the kyc edge function).
 * Reads go straight to the tables (row-level security returns only the applicant's own rows, or everything to an admin).
 * Every change goes through a database function or the kyc edge function; the browser never marks anything verified.
 */
import { supabase } from '@/db/supabase';
import {
  DOCUMENT_TYPES, type DocumentType, type EntityType, type KycStatus,
} from '../../../supabase/functions/kyc/validate';

export {
  DOCUMENT_TYPES, ENTITY_TYPES, isValidAccount, isValidCin, isValidGstin, isValidIfsc, isValidPan, isValidPersonName, isValidBusinessName,
  isValidUdyam, normaliseAccount, normaliseCin, normaliseGstin, normaliseIfsc, normalisePan, normaliseUdyam, panHolderKind,
  type DocumentType, type EntityType, type KycStatus,
} from '../../../supabase/functions/kyc/validate';

export type StepKey = 'pan' | 'aadhaar' | 'business' | 'bank' | 'review';
export type Stage = 'kyc' | 'verification' | 'partner_review' | 'decision' | 'withdrawn';
export type CheckState = 'production' | 'sandbox' | 'integration_pending';
export type Checks = Record<'documents' | 'pan' | 'aadhaar' | 'gstin' | 'bank', CheckState>;

export interface KycProfile {
  id: string;
  user_id: string;
  status: KycStatus;
  status_reason: string | null;
  pan_status: KycStatus;
  aadhaar_status: KycStatus;
  business_status: KycStatus;
  bank_status: KycStatus;
  review_status: KycStatus;
  step_notes: Partial<Record<StepKey, string>>;
  pan_masked: string | null;
  pan_name: string | null;
  pan_registered_name: string | null;
  pan_type: string | null;
  pan_verified_via: 'provider' | 'document_review' | null;
  aadhaar_last4: string | null;
  aadhaar_name: string | null;
  aadhaar_verified_via: 'digilocker' | null;
  entity_type: EntityType | null;
  business_name: string | null;
  gstin: string | null;
  gst_legal_name: string | null;
  gst_status: string | null;
  udyam_number: string | null;
  cin: string | null;
  business_pan_masked: string | null;
  business_verified_via: 'provider' | 'document_review' | null;
  consent_version: string | null;
  consent_at: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  updated_at: string;
}

export interface LoanApplication {
  id: string;
  user_id: string;
  loan_request_id: string | null;
  kyc_profile_id: string | null;
  amount: number;
  currency: string;
  tenure_months: number | null;
  purpose: string | null;
  stage: Stage;
  share_consent_at: string | null;
  lending_partner: string | null;
  partner_reference: string | null;
  forwarded_at: string | null;
  decision: 'approved_by_partner' | 'declined_by_partner' | null;
  decision_amount: number | null;
  decision_note: string | null;
  decided_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycDocument {
  id: string;
  step: 'pan' | 'business' | 'bank' | 'other';
  doc_type: DocumentType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: 'uploaded' | 'accepted' | 'rejected' | 'resubmission_required' | 'purged';
  review_note: string | null;
  reviewed_at: string | null;
  uploaded_at: string;
  delete_after: string;
}

export interface VerificationRequest {
  id: string;
  step: 'pan' | 'aadhaar' | 'business' | 'bank';
  check_type: 'pan' | 'aadhaar_digilocker' | 'gstin' | 'bank_account' | 'document_review';
  provider: string;
  environment: 'production' | 'sandbox' | 'none';
  status: 'integration_pending' | 'requested' | 'success' | 'review' | 'failed' | 'error' | 'expired' | 'consent_denied' | 'test_only';
  message: string | null;
  result: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface BankVerification {
  id: string;
  account_holder_name: string;
  account_last4: string;
  ifsc: string;
  bank_name: string | null;
  branch: string | null;
  name_at_bank: string | null;
  name_match_result: string | null;
  status: KycStatus;
  verified_via: 'provider' | 'document_review' | null;
}

export interface AuditLog {
  id: number;
  action: string;
  actor_role: 'applicant' | 'admin' | 'system';
  detail: Record<string, unknown>;
  created_at: string;
}

export interface KycSettings {
  document_retention_days: number;
  abandoned_retention_days: number;
  max_file_mb: number;
  consent_version: string;
}

export interface MyKyc {
  settings: KycSettings | null;
  profile: KycProfile | null;
  applications: LoanApplication[];
  documents: KycDocument[];
  checks: VerificationRequest[];
  bank: BankVerification | null;
  logs: AuditLog[];
  missing: string[];
}

// ── labels ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const STATUS_LABEL: Record<KycStatus, string> = {
  not_started: 'Not Started',
  pending: 'Pending',
  in_progress: 'Verification In Progress',
  verified: 'Verified',
  rejected: 'Rejected',
  resubmission_required: 'Resubmission Required',
};

export const STEP_LABEL: Record<StepKey, string> = {
  pan: 'PAN',
  aadhaar: 'Aadhaar (DigiLocker)',
  business: 'Business',
  bank: 'Bank account',
  review: 'Review & submit',
};

export const STAGES: { key: Exclude<Stage, 'withdrawn'>; label: string }[] = [
  { key: 'kyc', label: 'KYC' },
  { key: 'verification', label: 'Verification' },
  { key: 'partner_review', label: 'Lending partner review' },
  { key: 'decision', label: 'Loan decision' },
];

export const ENTITY_LABEL: Record<EntityType, string> = {
  proprietorship: 'Sole proprietorship',
  partnership: 'Partnership firm',
  llp: 'Limited liability partnership (LLP)',
  private_limited: 'Private limited company',
  public_limited: 'Public limited company',
  other: 'Other (trust, society, HUF …)',
};

export const DOC_LABEL: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DOCUMENT_TYPES).map(([k, v]) => [k, v.label])),
  bank_proof: 'Cancelled cheque or bank statement',
};

export const CHECK_LABEL: Record<VerificationRequest['check_type'], string> = {
  pan: 'PAN check',
  aadhaar_digilocker: 'Aadhaar through DigiLocker',
  gstin: 'GSTIN check',
  bank_account: 'Bank account check',
  document_review: 'Document review',
};

export const REQUEST_STATUS_LABEL: Record<VerificationRequest['status'], string> = {
  integration_pending: 'Integration Pending',
  requested: 'Waiting',
  success: 'Verified',
  review: 'Sent for review',
  failed: 'Not accepted',
  error: 'Could not complete',
  expired: 'Expired',
  consent_denied: 'Consent not given',
  test_only: 'Test result (not a verification)',
};

export const VERIFIED_VIA_LABEL: Record<string, string> = {
  provider: 'checked with the official records through our verification provider',
  document_review: 'verified by a BulkSkart reviewer from your documents',
  digilocker: 'shared by you through DigiLocker',
};

// ── consent ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const CONSENT_VERSION = '2026-11-24';
export const CONSENT_TEXT = [
  'I agree that BulkSkart may collect my PAN, my Aadhaar details shared by me through DigiLocker (name and the last 4 digits only), my business registration details (GSTIN, Udyam, CIN, business PAN), my bank account details and the documents I upload, to verify my identity and my business for this business loan application.',
  'These details are checked with the official records through BulkSkart\'s authorised verification provider, and reviewed by BulkSkart staff.',
  'BulkSkart is not a lender. My application and KYC are shared with a lending partner (a bank or NBFC) only after I submit it and confirm, and only for deciding on this loan. The lending partner makes the loan decision.',
  'Numbers and documents are stored encrypted, and only I and authorised BulkSkart reviewers can open my documents. They are deleted after the retention period shown on this page. I can withdraw an application at any time; withdrawing stops processing and starts the deletion period.',
];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── errors ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const MESSAGES: Record<string, string> = {
  sign_in_required: 'Please sign in again.',
  consent_required: 'Please give your consent to start KYC.',
  consent_outdated: 'The consent text has changed. Please reload the page and read it again.',
  kyc_rejected: 'Your KYC was rejected. Please contact BulkSkart support.',
  kyc_locked: 'Your KYC is under review, so it cannot be changed now.',
  step_locked: 'This step is verified or under review, so it cannot be changed now.',
  invalid_pan: 'Enter a valid 10-character PAN.',
  invalid_name: 'Enter the name exactly as on the document (letters, spaces, dots).',
  invalid_business_name: 'Enter the business name.',
  invalid_entity_type: 'Choose the type of business.',
  invalid_gstin: 'Enter a valid 15-character GSTIN.',
  invalid_udyam: 'Enter the Udyam number as UDYAM-XX-00-0000000.',
  invalid_cin: 'Enter a valid CIN (21 characters) or LLPIN (AAA-1234).',
  invalid_business_pan: 'Enter a valid business PAN.',
  invalid_account: 'Enter a valid account number.',
  invalid_ifsc: 'Enter a valid 11-character IFSC.',
  cin_required: 'Companies and LLPs must give their CIN or LLPIN.',
  business_pan_required: 'Enter the PAN of the business.',
  invalid_document_type: 'Choose what this document is.',
  file_required: 'Choose a file.',
  file_too_large: 'The file is too large.',
  unsupported_file: 'Only JPG, PNG and PDF files are accepted.',
  too_many_documents: 'You have uploaded the maximum number of documents.',
  details_missing: 'Please complete the PAN, business and bank steps first.',
  documents_missing: 'Some documents are still missing.',
  share_consent_required: 'Please confirm that your KYC may be shared with the lending partner.',
  resubmission_pending: 'Please update the steps marked "Resubmission Required" first.',
  not_found: 'This item no longer exists.',
  cannot_withdraw: 'This application can no longer be withdrawn.',
  admin_only: 'Only admins can do this.',
  note_required: 'Please write the reason: the applicant will see it.',
  accepted_document_required: 'Accept a document for this step first.',
  aadhaar_digilocker_only: 'Aadhaar can only be verified through DigiLocker.',
  steps_not_verified: 'Every step must be verified before KYC can be approved.',
  not_submitted: 'The applicant has not submitted yet.',
  kyc_not_verified: 'KYC must be verified first.',
  partner_required: 'Enter the lending partner\'s name.',
  wrong_stage: 'This application is not at that stage.',
  storage_error: 'The file could not be stored. Please try again.',
  key_rotated: 'This document was stored with an older key.',
  server_error: 'Something went wrong. Please try again.',
};

export function kycError(message: string | null | undefined): string {
  if (!message) return MESSAGES.server_error;
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  return code ? MESSAGES[code] : message;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(kycError(error.message));
  return data as T;
}

/** Result of a call to the kyc edge function. When the function is not deployed yet, everything is "Integration Pending". */
export interface FnResult {
  outcome?: string;
  message?: string | null;
  url?: string;
  id?: string;
  checks?: Checks;
  error?: string;
  purged?: number;
}

const PENDING_CHECKS: Checks = { documents: 'integration_pending', pan: 'integration_pending', aadhaar: 'integration_pending', gstin: 'integration_pending', bank: 'integration_pending' };

async function callKyc(body: Record<string, unknown> | FormData): Promise<FnResult> {
  const { data, error } = await supabase.functions.invoke('kyc', { body });
  if (!error) return (data ?? {}) as FnResult;
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.status === 'number') {
    if (ctx.status === 404 && !ctx.headers.get('content-type')?.includes('json')) return { outcome: 'integration_pending', checks: PENDING_CHECKS };
    const parsed = await ctx.clone().json().catch(() => null) as { error?: string } | null;
    if (parsed?.error) throw new Error(kycError(parsed.error));
    if (ctx.status === 404) return { outcome: 'integration_pending', checks: PENDING_CHECKS };
  }
  // network error or the function is not reachable: nothing was checked
  return { outcome: 'integration_pending', message: 'The verification service is not reachable (integration pending).', checks: PENDING_CHECKS };
}

// ── applicant ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function loadMyKyc(): Promise<MyKyc> {
  const [settings, profile, apps, docs, checks, bank, logs] = await Promise.all([
    supabase.from('kyc_settings').select('document_retention_days, abandoned_retention_days, max_file_mb, consent_version').maybeSingle(),
    supabase.from('kyc_profiles').select('*').maybeSingle(),
    supabase.from('loan_applications').select('*').order('created_at', { ascending: false }),
    supabase.from('kyc_documents').select('id, step, doc_type, file_name, mime_type, size_bytes, status, review_note, reviewed_at, uploaded_at, delete_after')
      .neq('status', 'purged').order('uploaded_at', { ascending: false }),
    supabase.from('verification_requests').select('id, step, check_type, provider, environment, status, message, result, created_at, completed_at')
      .order('created_at', { ascending: false }).limit(60),
    supabase.from('bank_verifications').select('id, account_holder_name, account_last4, ifsc, bank_name, branch, name_at_bank, name_match_result, status, verified_via')
      .eq('is_current', true).maybeSingle(),
    supabase.from('kyc_audit_logs').select('id, action, actor_role, detail, created_at').order('created_at', { ascending: false }).limit(60),
  ]);
  const firstError = [settings, profile, apps, docs, checks, bank, logs].find((r) => r.error)?.error;
  if (firstError) throw new Error(kycError(firstError.message));
  const p = (profile.data ?? null) as KycProfile | null;
  const missing = p ? await rpc<string[]>('kyc_missing_documents', { p_profile: p.id }) : [];
  return {
    settings: (settings.data ?? null) as KycSettings | null,
    profile: p,
    applications: (apps.data ?? []) as LoanApplication[],
    documents: (docs.data ?? []) as KycDocument[],
    checks: (checks.data ?? []) as VerificationRequest[],
    bank: (bank.data ?? null) as BankVerification | null,
    logs: (logs.data ?? []) as AuditLog[],
    missing: missing ?? [],
  };
}

export const integrationChecks = async (): Promise<Checks> => (await callKyc({ action: 'status' })).checks ?? PENDING_CHECKS;

export async function giveConsent(applicationId: string | null): Promise<string> {
  const sha = await sha256Hex(CONSENT_TEXT.join('\n'));
  return rpc<string>('kyc_give_consent', { p_application_id: applicationId, p_consent_version: CONSENT_VERSION, p_consent_text_sha256: sha });
}

export const savePan = (pan: string, name: string) => callKyc({ action: 'save_pan', pan, name });
export const startAadhaar = () => callKyc({ action: 'aadhaar_start' });
export const aadhaarStatus = (ref: string) => callKyc({ action: 'aadhaar_status', ref });
export const saveBusiness = (b: { entity_type: EntityType; business_name: string; gstin?: string; udyam_number?: string; cin?: string; business_pan?: string }) =>
  callKyc({ action: 'save_business', ...b });
export const saveBank = (b: { holder_name: string; account_number: string; ifsc: string }) => callKyc({ action: 'save_bank', ...b });
export const removeDocument = (id: string) => callKyc({ action: 'remove_document', id });

export async function uploadDocument(step: string, docType: DocumentType, file: File): Promise<FnResult> {
  const form = new FormData();
  form.append('action', 'upload');
  form.append('step', step);
  form.append('doc_type', docType);
  form.append('file', file);
  return callKyc(form);
}

/** Opens a document in a new tab (decrypted by the edge function, which logs who opened it). */
export async function openDocument(id: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const { data, error } = await supabase.functions.invoke('kyc', { body: { action: 'document', id } });
    if (error || !(data instanceof Blob)) throw new Error('not_found');
    const url = URL.createObjectURL(data);
    if (tab) tab.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw new Error(kycError(e instanceof Error ? e.message : null));
  }
}

export const submitKyc = (applicationId: string) => rpc<KycStatus>('kyc_submit', { p_application_id: applicationId, p_share_consent: true });
export const withdrawApplication = (applicationId: string) => rpc<null>('loan_withdraw_application', { p_application_id: applicationId });

// A visitor who requested a loan before signing in gets a token in this browser; after sign-in it attaches the request.
const CLAIM_KEY = 'bk-loan-claim';
export async function createClaimToken(): Promise<string | null> {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(CLAIM_KEY, token);
    return sha256Hex(token);
  } catch {
    return null;
  }
}
export async function claimPendingRequest(): Promise<string | null> {
  let token: string | null = null;
  try { token = window.localStorage.getItem(CLAIM_KEY); } catch { return null; }
  if (!token) return null;
  try {
    const id = await rpc<string | null>('loan_claim_request', { p_token: token });
    try { window.localStorage.removeItem(CLAIM_KEY); } catch { /* storage unavailable */ }
    return id;
  } catch {
    return null;
  }
}

/** What the applicant should do next, in order. */
export function nextSteps(k: MyKyc, checks: Checks): string[] {
  const p = k.profile;
  const active = k.applications.find((a) => a.stage !== 'withdrawn' && a.stage !== 'decision');
  if (!active) return k.applications.length ? [] : ['Request a loan from the loan calculator to start an application.'];
  if (!p?.consent_at) return ['Read and accept the KYC consent to start.'];
  if (p.status === 'rejected') return ['Your KYC was rejected. Contact BulkSkart support if you think this is a mistake.'];
  const out: string[] = [];
  for (const s of ['pan', 'aadhaar', 'business', 'bank'] as const) {
    const st = p[`${s}_status` as const];
    if (st === 'resubmission_required' || st === 'rejected') out.push(`Update ${STEP_LABEL[s]}: ${(p.step_notes?.[s] ?? 'see the note on that step').replace(/\.+$/, '')}.`);
  }
  if (!p.pan_masked) out.push('Enter your PAN.');
  if (p.aadhaar_status !== 'verified') out.push(checks.aadhaar === 'integration_pending' ? 'Aadhaar through DigiLocker: integration pending. You can finish the other steps now.' : 'Verify your Aadhaar through DigiLocker.');
  if (!p.entity_type) out.push('Add your business details.');
  if (!k.bank) out.push('Add the bank account for the loan.');
  for (const d of k.missing) {
    const sent = k.documents.find((x) => x.doc_type === d && (x.status === 'resubmission_required' || x.status === 'rejected'));
    out.push(sent?.review_note ? `Upload a new ${DOC_LABEL[d] ?? d}: ${sent.review_note.replace(/\.+$/, '')}.` : `Upload: ${DOC_LABEL[d] ?? d}.`);
  }
  for (const d of k.documents) {
    if ((d.status === 'resubmission_required' || d.status === 'rejected') && !k.missing.includes(d.doc_type)) {
      out.push(`Replace "${DOC_LABEL[d.doc_type]}"${d.review_note ? `: ${d.review_note.replace(/\.+$/, '')}.` : '.'}`);
    }
  }
  if (!out.length || out.every((t) => t.startsWith('Aadhaar') || t.startsWith('Verify your Aadhaar'))) {
    if (p.review_status === 'in_progress') out.push('Nothing to do now: BulkSkart is reviewing your KYC.');
    else if (p.review_status !== 'verified' || !active.share_consent_at) out.push('Review and submit your KYC.');
    else if (active.stage === 'verification') out.push('Your KYC is verified. BulkSkart will send your application to a lending partner.');
    else if (active.stage === 'partner_review') out.push(`Your application is with ${active.lending_partner}. They will contact you about the loan.`);
  }
  return out;
}

// ── admin ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface AdminRow extends LoanApplication {
  kyc_status: KycStatus | null;
  pan_status: KycStatus | null;
  aadhaar_status: KycStatus | null;
  business_status: KycStatus | null;
  bank_status: KycStatus | null;
  review_status: KycStatus | null;
  business_name: string | null;
  submitted_at: string | null;
  full_name: string | null;
  email: string | null;
  request_company: string | null;
  request_phone: string | null;
  request_city: string | null;
  docs_to_review: number;
}
export interface AdminList { total: number; rows: AdminRow[]; counts: Record<string, number> }
export interface AdminDetail {
  application: LoanApplication;
  applicant: { id: string; full_name: string | null; email: string | null; role: string } | null;
  request: { full_name: string; company_name: string; email: string; phone: string; city: string; goods_needed: string | null; created_at: string } | null;
  profile: KycProfile | null;
  missing_documents: string[];
  documents: (KycDocument & { reviewed_by: string | null })[];
  checks: VerificationRequest[];
  bank: BankVerification | null;
  logs: (AuditLog & { actor_id: string | null })[];
  other_applications: { id: string; amount: number; stage: Stage; created_at: string }[];
}

export const adminApplications = (filter: string, search: string) =>
  rpc<AdminList>('admin_kyc_applications', { p_filter: filter, p_search: search || null, p_limit: 100, p_offset: 0 });
export const adminDetail = (id: string) => rpc<AdminDetail>('admin_kyc_detail', { p_application_id: id });
export const adminDocumentAction = (id: string, action: 'accept' | 'reject' | 'request_resubmission', note?: string) =>
  rpc<string>('admin_kyc_document_action', { p_doc: id, p_action: action, p_note: note ?? null });
export const adminStepAction = (profileId: string, step: Exclude<StepKey, 'review'>, action: 'verify_by_document' | 'reject' | 'request_resubmission' | 'reopen', note?: string) =>
  rpc<KycStatus>('admin_kyc_step_action', { p_profile: profileId, p_step: step, p_action: action, p_note: note ?? null });
export const adminDecision = (profileId: string, action: 'approve' | 'reject' | 'request_resubmission' | 'reopen', note?: string) =>
  rpc<KycStatus>('admin_kyc_decision', { p_profile: profileId, p_action: action, p_note: note ?? null });
export const adminForward = (applicationId: string, partner: string, reference?: string) =>
  rpc<string>('admin_loan_forward', { p_application_id: applicationId, p_partner: partner, p_reference: reference || null });
export const adminRecordDecision = (applicationId: string, decision: 'approved_by_partner' | 'declined_by_partner', amount: number | null, note: string) =>
  rpc<string>('admin_loan_record_decision', { p_application_id: applicationId, p_decision: decision, p_amount: amount, p_note: note });
export const adminUpdateSettings = (s: Partial<KycSettings>) => rpc<KycSettings>('admin_kyc_update_settings', { p: s });
export const adminPurgeExpired = () => callKyc({ action: 'purge' });

// ── formatting ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function money(amount: number | null | undefined, currency = 'INR'): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-IN')}`;
  }
}
export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
