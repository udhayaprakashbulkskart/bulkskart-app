/**
 * BulkSkart Business Credit (migration 00077). Everything goes through database functions that check the caller;
 * approved and withdrawable amounts come only from the lending partner's recorded decision.
 */
import { supabase } from '@/db/supabase';

export type CreditStage = 'draft' | 'submitted' | 'platform_approved' | 'platform_rejected' | 'with_lender' | 'lender_approved' | 'lender_rejected'
  | 'agreement_accepted' | 'active' | 'closed' | 'cancelled';

export interface Kfs {
  sanctioned_amount: number;
  tenure_months: number;
  interest_rate_pct: number;
  apr_pct: number;
  processing_fee: number;
  emi_amount: number;
  installments: number;
  total_repayable: number;
  cooling_off_days: number;
}

export interface CreditApplication {
  id: string;
  user_id: string;
  company_id: string | null;
  product_id: string | null;
  partner_id: string | null;
  requested_amount: number;
  tenure_months: number;
  purpose: string | null;
  stage: CreditStage;
  share_consent_at: string | null;
  submitted_at: string | null;
  platform_note: string | null;
  platform_decided_at: string | null;
  sent_to_lender_at: string | null;
  lender_reference: string | null;
  lender_decision: 'approved' | 'rejected' | null;
  lender_decision_source: 'lender_api' | 'admin_from_lender' | null;
  lender_decided_at: string | null;
  lender_note: string | null;
  approved_amount: number | null;
  kfs: Kfs | null;
  kfs_sha256: string | null;
  agreement_url: string | null;
  agreement_accepted_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  eligibility_snapshot?: Checks;
}

export interface Disbursement {
  id: string;
  amount: number;
  status: 'requested' | 'sent_to_lender' | 'disbursed' | 'failed' | 'cancelled';
  bank_account_last4: string;
  bank_ifsc: string;
  utr: string | null;
  lender_reference: string | null;
  note: string | null;
  requested_at: string;
  disbursed_at: string | null;
}
export interface Installment { id: string; installment_no: number; due_date: string; principal: number; interest: number; amount: number; paid_amount: number; paid_at: string | null }
export interface Repayment { id: string; amount: number; paid_at: string; method: string; reference: string; source: string }
export interface CreditDoc { id: string; kind: 'kfs' | 'loan_agreement' | 'sanction_letter' | 'other'; file_name: string; uploaded_at: string }

export interface Checks { subscription: boolean; kyc: boolean; business: boolean; bank: boolean; lender: boolean }

export interface Partner {
  name: string;
  legal_name: string;
  entity_type: 'bank' | 'nbfc';
  rbi_registration_no: string | null;
  grievance_officer_name: string | null;
  grievance_email: string | null;
  grievance_phone: string | null;
  website: string | null;
}
export interface Program {
  live: boolean;
  product_id?: string;
  product_name?: string;
  max_amount: number;
  min_amount: number;
  tenure_months: number;
  interest_rate_pct?: number | null;
  zero_interest_confirmed: boolean;
  processing_fee_pct?: number | null;
  partner?: Partner;
}

export interface AppBundle {
  application: CreditApplication;
  withdrawable: number;
  drawn: number;
  documents: CreditDoc[];
  disbursements: Disbursement[];
  schedule: Installment[];
  repayments: Repayment[];
}

export interface CreditState {
  checks: Checks;
  program: Program;
  limit: { status: 'active' | 'suspended'; sanctioned_limit: number | null; platform_cap: number | null; sanctioned_at: string | null } | null;
  eligible_amount: number;
  available_limit: number | null;
  outstanding: number;
  next_emi_date: string | null;
  applications: AppBundle[];
  bank: { last4: string; ifsc: string; bank_name: string | null; status: string } | null;
  history: { action: string; actor_role: string; detail: Record<string, unknown>; created_at: string }[];
}

export const OPEN_STAGES: CreditStage[] = ['draft', 'submitted', 'platform_approved', 'with_lender', 'lender_approved', 'agreement_accepted', 'active'];

export const STAGE_LABEL: Record<CreditStage, string> = {
  draft: 'Amount selected',
  submitted: 'Submitted: BulkSkart is checking eligibility',
  platform_approved: 'Eligible: being sent to the lending partner',
  platform_rejected: 'Not eligible',
  with_lender: 'With the lending partner',
  lender_approved: 'Approved by the lender: review the KFS and agreement',
  lender_rejected: 'Declined by the lender',
  agreement_accepted: 'Agreement accepted: you can withdraw',
  active: 'Active loan',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/** The eight steps of the workflow, and which one an application is on. */
export const WORKFLOW = ['Check eligibility', 'Select amount', 'KYC & business verification', 'Submit application', 'Lender approval', 'KFS & agreement', 'Withdraw', 'Repay'] as const;
export function workflowStep(s: CreditState): number {
  const a = s.applications.find((b) => OPEN_STAGES.includes(b.application.stage))?.application;
  if (!a) return s.checks.subscription ? 1 : 0;
  if (a.stage === 'draft') return s.checks.kyc && s.checks.business && s.checks.bank ? 3 : 2;
  if (['submitted', 'platform_approved', 'with_lender'].includes(a.stage)) return 4;
  if (a.stage === 'lender_approved') return 5;
  if (a.stage === 'agreement_accepted') return 6;
  return 7;
}

const MESSAGES: Record<string, string> = {
  sign_in_required: 'Please sign in again.',
  suppliers_only: 'Business credit is for manufacturers.',
  credit_suspended: 'Business credit is paused for your account. Please contact BulkSkart support.',
  invalid_amount: 'Choose an amount within the range, in steps of ₹1,000.',
  application_in_progress: 'You already have an application in progress.',
  not_eligible: 'Complete the eligibility checks first.',
  share_consent_required: 'Please confirm that your details may be shared with the lending partner.',
  wrong_stage: 'This step is not available for the application right now.',
  cannot_cancel: 'This application can no longer be cancelled.',
  kfs_missing: 'The lender has not issued the Key Fact Statement yet.',
  agreement_missing: 'The lender has not shared the loan agreement yet.',
  kfs_changed: 'The Key Fact Statement changed. Please reload and read it again.',
  amount_above_withdrawable: 'That is more than you can withdraw.',
  bank_not_verified: 'Your bank account must be verified first.',
  lender_reference_required: "Enter the lender's reference for this decision.",
  kfs_incomplete: 'Fill in every Key Fact Statement field, with the sanctioned amount equal to the approved amount.',
  invalid_agreement_url: 'The agreement link must start with https://',
  utr_required: 'Enter the UTR of the payment (at least 6 characters).',
  note_required: 'Please write the reason.',
  already_final: 'This payout is already final.',
  schedule_required: 'Record the repayment schedule first.',
  schedule_above_approved: 'The schedule is larger than the approved amount.',
  repayments_exist: 'Repayments are already recorded against this schedule.',
  amount_above_outstanding: 'That is more than is outstanding.',
  partner_not_live: 'The lending partner or product is not live.',
  amount_outside_product: "The amount is outside the product's range.",
  admin_only: 'Only admins can do this.',
  not_found: 'This item no longer exists.',
};
export function creditError(message: string | null | undefined): string {
  if (!message) return 'Something went wrong. Please try again.';
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  if (code === 'not_eligible') return MESSAGES.not_eligible;
  return code ? MESSAGES[code] : message;
}
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(creditError(error.message));
  return data as T;
}

// ── supplier ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const myCredit = () => rpc<CreditState>('credit_my_state');
export const saveDraft = (amount: number, purpose: string) => rpc<string>('credit_save_draft', { p_amount: amount, p_purpose: purpose || null });
export const submitCredit = (id: string) => rpc<string>('credit_submit', { p_app: id, p_share_consent: true });
export const cancelCredit = (id: string) => rpc<string>('credit_cancel', { p_app: id });
export const acceptAgreement = (id: string, kfsSha: string) => rpc<string>('credit_accept_agreement', { p_app: id, p_kfs_sha256: kfsSha });
export const requestWithdrawal = (id: string, amount: number) => rpc<string>('credit_request_withdrawal', { p_app: id, p_amount: amount });

/** Opens a lender document (decrypted by the kyc edge function, which logs who opened it). */
export async function openCreditDoc(id: string): Promise<void> {
  const tab = window.open('', '_blank');
  const { data, error } = await supabase.functions.invoke('kyc', { body: { action: 'credit_doc', id } });
  if (error || !(data instanceof Blob)) { tab?.close(); throw new Error('The document could not be opened (secure storage may not be connected yet).'); }
  const url = URL.createObjectURL(data);
  if (tab) tab.location.href = url; else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── admin ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface AdminRow {
  id: string; user_id: string; stage: CreditStage; requested_amount: number; approved_amount: number | null; submitted_at: string | null; updated_at: string;
  created_at: string; lender_reference: string | null; full_name: string | null; email: string | null; company_name: string | null; partner_name: string | null;
  withdrawable: number; pending_withdrawals: number;
}
export interface AdminDetail extends AppBundle {
  checks_now: Checks;
  supplier: { full_name: string | null; email: string | null; phone: string | null } | null;
  company: { id: string; company_name: string; city: string | null; verification_status: string } | null;
  limit: { platform_cap: number | null; sanctioned_limit: number | null; status: string; lender_reference: string | null; notes: string | null } | null;
  logs: { id: number; action: string; actor_role: string; detail: Record<string, unknown>; created_at: string }[];
}
export interface PartnerRow extends Partner {
  id: string; code: string; integration_mode: 'manual' | 'api'; status: 'draft' | 'active' | 'paused'; notes: string | null; created_at: string;
}
export interface ProductRow {
  id: string; partner_id: string; name: string; min_amount: number; max_amount: number; tenure_months: number; interest_rate_pct: number | null;
  rate_confirmed_at: string | null; rate_confirmation_ref: string | null; processing_fee_pct: number | null; status: 'draft' | 'active' | 'paused';
}
export interface LimitRow {
  user_id: string; platform_cap: number | null; sanctioned_limit: number | null; status: string; lender_reference: string | null; notes: string | null;
  updated_at: string; full_name: string | null; email: string | null; company_name: string | null;
}

export const adminList = (filter: string, search: string) => rpc<{ rows: AdminRow[]; counts: Record<string, number> }>('admin_credit_applications', { p_filter: filter, p_search: search || null });
export const adminDetail = (id: string) => rpc<AdminDetail>('admin_credit_detail', { p_app: id });
export const adminPlatformDecision = (id: string, action: 'approve' | 'reject', note?: string) => rpc<string>('admin_credit_platform_decision', { p_app: id, p_action: action, p_note: note ?? null });
export const adminSendToLender = (id: string, product: string, reference?: string) => rpc<string>('admin_credit_send_to_lender', { p_app: id, p_product: product, p_reference: reference || null });
export const adminLenderDecision = (id: string, decision: 'approved' | 'rejected', amount: number | null, kfs: Kfs | null, ref: string, agreementUrl?: string, note?: string) =>
  rpc<string>('admin_credit_record_lender_decision', { p_app: id, p_decision: decision, p_amount: amount, p_kfs: kfs, p_lender_ref: ref, p_agreement_url: agreementUrl || null, p_note: note || null });
export const adminDisbursement = (id: string, status: 'sent_to_lender' | 'disbursed' | 'failed', utr?: string, ref?: string, note?: string) =>
  rpc<string>('admin_credit_update_disbursement', { p_disb: id, p_status: status, p_utr: utr || null, p_lender_ref: ref || null, p_note: note || null });
export const adminSetSchedule = (id: string, rows: Omit<Installment, 'id' | 'paid_amount' | 'paid_at'>[]) => rpc<number>('admin_credit_set_schedule', { p_app: id, p_rows: rows });
export const adminRepayment = (id: string, amount: number, paidAt: string, method: string, reference: string) =>
  rpc<string>('admin_credit_record_repayment', { p_app: id, p_amount: amount, p_paid_at: paidAt, p_method: method, p_reference: reference });
export const adminSetLimit = (user: string, cap: number | null, status: 'active' | 'suspended', note?: string) =>
  rpc<LimitRow>('admin_credit_set_limit', { p_user: user, p_platform_cap: cap, p_status: status, p_note: note || null });
export const adminLimits = (search: string) => rpc<LimitRow[]>('admin_credit_limits', { p_search: search || null });
export const adminSavePartner = (p: Partial<PartnerRow>) => rpc<string>('admin_credit_upsert_partner', { p });
export const adminSaveProduct = (p: Partial<ProductRow> & { rate_confirmed?: boolean }) => rpc<string>('admin_credit_upsert_product', { p });
export async function adminPartners(): Promise<{ partners: PartnerRow[]; products: ProductRow[] }> {
  const [a, b] = await Promise.all([
    supabase.from('lending_partners').select('*').order('created_at'),
    supabase.from('credit_products').select('*').order('created_at'),
  ]);
  if (a.error || b.error) throw new Error(creditError((a.error ?? b.error)?.message));
  return { partners: (a.data ?? []) as PartnerRow[], products: (b.data ?? []) as ProductRow[] };
}
export async function adminUploadCreditDoc(applicationId: string, kind: CreditDoc['kind'], file: File): Promise<string> {
  const form = new FormData();
  form.append('action', 'credit_doc_upload');
  form.append('application_id', applicationId);
  form.append('kind', kind);
  form.append('file', file);
  const { data, error } = await supabase.functions.invoke('kyc', { body: form });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const parsed = ctx ? await ctx.clone().json().catch(() => null) as { error?: string } | null : null;
    throw new Error(parsed?.error ? creditError(parsed.error) : 'Upload failed: secure storage (the kyc function) is not connected yet.');
  }
  if ((data as { outcome?: string })?.outcome === 'integration_pending') throw new Error('Secure document storage is not set up yet (integration pending).');
  return (data as { id: string }).id;
}

/**
 * A schedule worked out from the lender's KFS terms, for an admin to compare with the lender's own schedule before saving.
 * Equal instalments; with interest, a reducing-balance split at the KFS rate.
 */
export function scheduleFromKfs(kfs: Kfs, principal: number, firstDue: string): Omit<Installment, 'id' | 'paid_amount' | 'paid_at'>[] {
  const n = kfs.installments;
  const r = kfs.interest_rate_pct / 1200;
  const emi = r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
  const rows: Omit<Installment, 'id' | 'paid_amount' | 'paid_at'>[] = [];
  let left = principal;
  const start = new Date(`${firstDue}T00:00:00Z`);
  for (let i = 1; i <= n; i++) {
    const interest = Math.round(left * r * 100) / 100;
    let p = Math.round((emi - interest) * 100) / 100;
    if (i === n) p = Math.round(left * 100) / 100;
    left -= p;
    const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i - 1, start.getUTCDate()));
    rows.push({ installment_no: i, due_date: due.toISOString().slice(0, 10), principal: p, interest, amount: Math.round((p + interest) * 100) / 100 });
  }
  return rows;
}

export const isOverdue = (i: Installment) => i.paid_amount < i.amount && new Date(`${i.due_date}T23:59:59`) < new Date();
