import { supabase } from '@/db/supabase';
import { monthlyInstallment, type LoanQuote } from '@/lib/orderFinance';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_LIMIT = 80;
const COMPANY_LIMIT = 120;
const CITY_LIMIT = 80;
const GOODS_LIMIT = 300;
const MAX_LOAN = 100_000_000;

export interface LoanRequestDraft {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  city: string;
  loanAmount: string;
  goodsNeeded: string;
  honeypot: string;
}

export interface LoanRequestErrors {
  fullName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  city?: string;
  loanAmount?: string;
  goodsNeeded?: string;
}

export interface LoanRequestPayload {
  user_id: string | null;
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  loan_amount: number;
  currency: string;
  order_amount: number;
  down_payment_pct: number;
  annual_rate_pct: number;
  tenure_months: number;
  monthly_installment: number;
  goods_needed: string | null;
  /** SHA-256 of a token kept in this browser, so a visitor can attach the request to their account after signing in. */
  claim_token_hash?: string | null;
}

export function emptyLoanDraft(): LoanRequestDraft {
  return {
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    city: '',
    loanAmount: '',
    goodsNeeded: '',
    honeypot: '',
  };
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateLoanRequest(draft: LoanRequestDraft): LoanRequestErrors {
  const errors: LoanRequestErrors = {};
  const fullName = clean(draft.fullName);
  const companyName = clean(draft.companyName);
  const email = clean(draft.email).toLowerCase();
  const city = clean(draft.city);
  const goods = clean(draft.goodsNeeded);
  const digits = phoneDigits(draft.phone);
  const amount = Number(draft.loanAmount);

  if (fullName.length < 2) errors.fullName = 'Enter your full name';
  else if (fullName.length > NAME_LIMIT) errors.fullName = 'Name is too long';

  if (companyName.length < 2) errors.companyName = 'Enter your company name';
  else if (companyName.length > COMPANY_LIMIT) errors.companyName = 'Company name is too long';

  if (!EMAIL_PATTERN.test(email) || email.length > 160) errors.email = 'Enter a valid email';

  if (digits.length < 10 || digits.length > 15) errors.phone = 'Enter a valid phone or WhatsApp number';

  if (city.length < 2) errors.city = 'Enter your city';
  else if (city.length > CITY_LIMIT) errors.city = 'City is too long';

  if (!Number.isFinite(amount) || amount <= 0) errors.loanAmount = 'Enter how much loan you need';
  else if (amount > MAX_LOAN) errors.loanAmount = 'Amount is above the limit we can review';

  if (goods.length > GOODS_LIMIT) errors.goodsNeeded = 'Keep this under 300 characters';

  return errors;
}

export function buildLoanRequestPayload(
  draft: LoanRequestDraft,
  quote: LoanQuote,
  currency: string,
  userId: string | null,
): LoanRequestPayload | null {
  if (Object.keys(validateLoanRequest(draft)).length > 0) return null;
  const loanAmount = Math.round(Number(draft.loanAmount) * 100) / 100;
  const goods = clean(draft.goodsNeeded);
  return {
    user_id: userId,
    full_name: clean(draft.fullName),
    company_name: clean(draft.companyName),
    email: clean(draft.email).toLowerCase(),
    phone: phoneDigits(draft.phone),
    city: clean(draft.city),
    country: 'India',
    loan_amount: loanAmount,
    currency: currency || 'INR',
    order_amount: quote.orderAmount,
    down_payment_pct: quote.downPaymentPct,
    annual_rate_pct: quote.annualRatePct,
    tenure_months: quote.months,
    monthly_installment: quote.emi,
    goods_needed: goods || null,
  };
}

/** Recompute the installment for the amount the buyer actually asked to finance. */
export function installmentForRequestedAmount(quote: LoanQuote, loanAmount: number): number {
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) return quote.emi;
  return monthlyInstallment(loanAmount, quote.annualRatePct, quote.months);
}

export async function submitLoanRequest(payload: LoanRequestPayload): Promise<void> {
  const { error } = await supabase.from('loan_requests').insert(payload);
  if (!error) return;
  // Before migration 00075 the claim column does not exist: the request itself must still go through.
  if (payload.claim_token_hash && /claim_token_hash/.test(error.message ?? '')) {
    const { claim_token_hash: _unused, ...rest } = payload;
    const retry = await supabase.from('loan_requests').insert(rest);
    if (retry.error) throw retry.error;
    return;
  }
  throw error;
}
