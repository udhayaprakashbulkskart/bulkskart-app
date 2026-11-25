/**
 * Forgotten password without an e-mail link, an OTP or an admin (migration 00079): e-mail + the mobile number registered on
 * the account + the new password. A matching number changes it at once; admin accounts wait for a super admin.
 */
import { supabase } from '@/db/supabase';

export type ResetRequestStatus = 'changed' | 'queued' | 'no_match' | 'invalid_email' | 'invalid_phone' | 'weak_password' | 'too_many' | 'error';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An Indian mobile number as 10 digits (+91, a leading 0, spaces and dashes are fine); null when it is not one. Same rule as the server. */
export function normalizeMobile(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Same rule as the server: 8–72 characters (bytes), letters and at least one number. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (new TextEncoder().encode(pw).length > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.';
  return null;
}

export async function requestPasswordReset(input: { email: string; phone: string; password: string }): Promise<ResetRequestStatus> {
  const { data, error } = await supabase.rpc('pwreset_request', {
    p_email: input.email.trim().toLowerCase(),
    p_phone: input.phone,
    p_password: input.password,
  });
  if (error) return 'error';
  const status = (data as { status?: string } | null)?.status;
  return (['changed', 'queued', 'no_match', 'invalid_email', 'invalid_phone', 'weak_password', 'too_many'] as const).find((s) => s === status) ?? 'error';
}

export function resetRequestMessage(status: ResetRequestStatus): string {
  switch (status) {
    case 'invalid_email': return 'Please enter a valid e-mail address.';
    case 'invalid_phone': return 'Enter your 10-digit mobile number.';
    case 'weak_password': return 'Use 8 to 72 characters, with letters and at least one number.';
    case 'no_match': return 'This e-mail and mobile number do not match an account. Use the mobile number you registered with.';
    case 'too_many': return 'Too many tries for now. Please try again tomorrow, or contact BulkSkart support.';
    default: return 'The request could not be sent. Check your connection and try again.';
  }
}

/* ── admin ── */

export type ResetRequestState = 'pending' | 'approved' | 'rejected' | 'expired' | 'superseded' | 'changed' | 'no_match';

export interface AdminResetRequest {
  id: string;
  status: ResetRequestState;
  email: string;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  note: string | null;
  ip: string | null;
  phone_given: string;
  phone_registered: string | null;
  phone_match: boolean | null;
  full_name: string | null;
  role: string | null;
  company_name: string | null;
  account_created_at: string | null;
  requests_same_ip_24h: number;
  decided_by_name: string | null;
}

export async function loadResetRequests(view: 'pending' | 'done'): Promise<{ rows: AdminResetRequest[]; pending: number }> {
  const { data, error } = await supabase.rpc('admin_pwreset_requests', { p_view: view });
  if (error) throw new Error(error.message);
  const out = (data ?? {}) as { rows?: AdminResetRequest[]; pending?: number };
  return { rows: out.rows ?? [], pending: out.pending ?? 0 };
}

export type DecideResult = 'approved' | 'rejected' | 'account_gone' | 'already_decided';

export async function decideResetRequest(id: string, approve: boolean, note: string): Promise<DecideResult> {
  const { data, error } = await supabase.rpc('admin_pwreset_decide', { p_id: id, p_approve: approve, p_note: note.trim() || null });
  if (error) {
    if (error.message.includes('super_admin_only')) throw new Error('Only a super admin can reset the password of an admin account.');
    throw new Error(error.message);
  }
  const status = String((data as { status?: string } | null)?.status ?? '');
  if (status === 'approved' || status === 'rejected' || status === 'account_gone') return status;
  return 'already_decided';
}
