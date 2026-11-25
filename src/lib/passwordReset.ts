/** Forgotten password: a 6-digit code on WhatsApp, then a new password (password-reset edge function, migration 00078). */
import { supabase } from '@/db/supabase';

export type ResetStatus = 'sent' | 'ok' | 'no_account' | 'no_phone' | 'too_soon' | 'rate_limited' | 'not_configured' | 'send_failed'
  | 'wrong_code' | 'expired' | 'locked' | 'weak_password' | 'invalid_email' | 'error';

export interface ResetAnswer { status: ResetStatus; phone_hint?: string; attempts_left?: number; message?: string }

async function call(body: Record<string, unknown>): Promise<ResetAnswer> {
  const { data, error } = await supabase.functions.invoke('password-reset', { body });
  if (!error) return (data ?? { status: 'error' }) as ResetAnswer;
  const ctx = (error as { context?: Response }).context;
  if (ctx?.status === 404) return { status: 'not_configured' };
  const parsed = ctx ? ((await ctx.clone().json().catch(() => null)) as ResetAnswer | null) : null;
  return parsed?.status ? parsed : { status: 'error' };
}

export const requestResetCode = (email: string) => call({ action: 'request', email: email.trim().toLowerCase() });
export const resetWithCode = (email: string, code: string, password: string) =>
  call({ action: 'reset', email: email.trim().toLowerCase(), code: code.replace(/\D/g, ''), password });

export function resetMessage(a: ResetAnswer): string {
  switch (a.status) {
    case 'no_account': return 'No BulkSkart account uses this e-mail. Check the spelling, or sign up.';
    case 'no_phone': return 'This account has no WhatsApp number, so a code cannot be sent. Please contact BulkSkart support.';
    case 'too_soon': return 'A code was just sent. Please wait a minute before asking for another.';
    case 'rate_limited': return 'Too many attempts. Please try again in an hour.';
    case 'not_configured': return 'Password reset on WhatsApp is not set up yet. Please contact BulkSkart support.';
    case 'send_failed': return 'The WhatsApp message could not be sent. Please try again in a few minutes.';
    case 'wrong_code': return a.attempts_left != null ? `That code is not right. ${a.attempts_left} tr${a.attempts_left === 1 ? 'y' : 'ies'} left.` : 'That code is not right.';
    case 'expired': return 'This code has expired. Ask for a new one.';
    case 'locked': return 'Too many wrong codes. Ask for a new one.';
    case 'weak_password': return a.message ?? 'Choose a stronger password.';
    case 'invalid_email': return 'Please enter a valid e-mail address.';
    default: return 'Something went wrong. Please try again.';
  }
}

/** Same rule as the server: 8–72 characters, letters and at least one number. */
export function passwordHint(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.';
  return null;
}
