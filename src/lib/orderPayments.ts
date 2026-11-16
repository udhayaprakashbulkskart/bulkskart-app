/**
 * Paying for orders, payouts and factory visits.
 *
 * Every step that moves money or changes a payment runs on the server (database functions in
 * migration 00063 and the razorpay-* / order-refund functions); this file only calls them and words the results.
 *
 *   online:      buyer pays → BulkSkart holds it ('escrow') → buyer releases on delivery → 98% to the
 *                manufacturer's payout balance (2% commission) → payout request → admin transfers it to the bank
 *   at factory:  buyer pays the manufacturer directly → the manufacturer records it ('paid')
 */
import { supabase } from '@/db/supabase';
import { loadRazorpayScript } from '@/hooks/useRazorpay';

export type PaymentStatus = 'pending' | 'paid' | 'escrow' | 'released' | 'refunded';
export type PaymentMethod = 'online' | 'at_factory';
export type PaymentViewer = 'buyer' | 'supplier' | 'admin';

/** BulkSkart's commission on online payments, in percent (also stored on each order). */
export const COMMISSION_PCT = 2;

export interface OrderPaymentFields {
  id: string;
  order_number: string;
  total_amount: number;
  currency: string;
  order_status?: string | null;
  payment_status?: PaymentStatus | null;
  payment_method?: PaymentMethod | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  payout_amount?: number | null;
  commission_amount?: number | null;
  commission_pct?: number | null;
  released_at?: string | null;
  refunded_at?: string | null;
}

/** What the manufacturer receives and what BulkSkart keeps, when a held payment is released. */
export function commissionSplit(amount: number, pct: number = COMMISSION_PCT): { commission: number; payout: number } {
  const commission = Math.round(amount * pct) / 100;
  return { commission, payout: Math.round((amount - commission) * 100) / 100 };
}

export function money(amount: number | null | undefined, currency = 'INR'): string {
  const value = Number(amount ?? 0);
  try {
    const whole = Number.isInteger(Math.round(value * 100) / 100);
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export type PaymentTone = 'waiting' | 'held' | 'done' | 'returned';

/** A short badge and a sentence saying where the money is, from the point of view of the person looking. */
export function describePayment(order: OrderPaymentFields, viewer: PaymentViewer): { badge: string; tone: PaymentTone; text: string } {
  const status = order.payment_status ?? 'pending';
  const paid = order.paid_amount ?? order.total_amount;
  const pct = order.commission_pct ?? COMMISSION_PCT;
  const cancelled = order.order_status === 'cancelled';

  if (status === 'escrow') {
    const { payout } = commissionSplit(paid, pct);
    if (cancelled) {
      return { badge: 'Refund due', tone: 'held', text: viewer === 'supplier'
        ? `The order is cancelled; BulkSkart will return the buyer's ${money(paid, order.currency)}.`
        : `The order is cancelled; BulkSkart will refund ${money(paid, order.currency)} to the buyer.` };
    }
    return {
      badge: 'Held by BulkSkart',
      tone: 'held',
      text: viewer === 'supplier'
        ? `The buyer paid ${money(paid, order.currency)} on ${day(order.paid_at)}. BulkSkart holds it until the buyer confirms delivery; then ${money(payout, order.currency)} (after ${pct}% commission) comes to your payout balance.`
        : `${money(paid, order.currency)} paid on ${day(order.paid_at)} and held by BulkSkart. The manufacturer gets it only when you confirm delivery.`,
    };
  }
  if (status === 'released') {
    return {
      badge: 'Released',
      tone: 'done',
      text: viewer === 'supplier'
        ? `${money(order.payout_amount, order.currency)} added to your payout balance on ${day(order.released_at)} (BulkSkart commission ${money(order.commission_amount, order.currency)}).`
        : `Released to the manufacturer on ${day(order.released_at)}.`,
    };
  }
  if (status === 'paid') {
    return { badge: 'Paid at factory', tone: 'done', text: `${money(paid, order.currency)} paid directly at the factory on ${day(order.paid_at)}.` };
  }
  if (status === 'refunded') {
    return { badge: 'Refunded', tone: 'returned', text: `${money(paid, order.currency)} refunded to the buyer on ${day(order.refunded_at)}.` };
  }
  if (cancelled) return { badge: 'Not paid', tone: 'waiting', text: 'The order was cancelled before any payment.' };
  if (order.payment_method === 'at_factory') {
    return { badge: 'Pay at factory', tone: 'waiting', text: viewer === 'supplier'
      ? 'The buyer will pay you directly at the factory. Record the payment when you receive it.'
      : 'You chose to pay the manufacturer directly at the factory.' };
  }
  if (order.payment_method === 'online') {
    return { badge: 'Not paid yet', tone: 'waiting', text: viewer === 'supplier'
      ? 'The buyer chose to pay online but has not paid yet.'
      : 'You chose to pay online. The payment has not gone through yet.' };
  }
  return { badge: 'Not paid yet', tone: 'waiting', text: viewer === 'supplier'
    ? 'Waiting for the buyer to choose how to pay.'
    : 'Choose how you want to pay for this order.' };
}

/** Whether the buyer may release a held payment now (the server checks the same). */
export function canRelease(order: OrderPaymentFields): boolean {
  return order.payment_status === 'escrow' && ['shipped', 'delivered'].includes(order.order_status ?? '');
}

/** The server's own words from a failed database function, without the technical prefix. */
function rpcError(error: { message?: string } | null): string | null {
  if (!error) return null;
  return (error.message || 'Something went wrong').replace(/^.*?ERROR:\s*/i, '');
}

async function functionError(error: unknown, data: unknown): Promise<string | null> {
  const fromBody = (data as { error?: unknown } | null)?.error;
  if (typeof fromBody === 'string') return fromBody;
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      /* not JSON */
    }
  }
  return error ? (error as Error).message || 'Something went wrong' : null;
}

export async function chooseOrderPaymentMethod(orderId: string, method: PaymentMethod): Promise<string | null> {
  const { error } = await supabase.rpc('choose_order_payment_method', { p_order_id: orderId, p_method: method });
  return rpcError(error);
}

export async function confirmFactoryPayment(orderId: string, amount: number, note: string): Promise<string | null> {
  const { error } = await supabase.rpc('confirm_factory_payment', { p_order_id: orderId, p_amount: amount, p_note: note });
  return rpcError(error);
}

export async function releaseOrderPayment(orderId: string): Promise<{ payout: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('release_order_payment', { p_order_id: orderId });
  return { payout: error ? null : Number(data), error: rpcError(error) };
}

export async function requestPayout(amount: number, note: string): Promise<string | null> {
  const { error } = await supabase.rpc('request_payout', { p_amount: amount, p_note: note });
  return rpcError(error);
}

export async function adminResolvePayout(requestId: string, approve: boolean, reference: string, note: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_resolve_payout', { p_request_id: requestId, p_approve: approve, p_reference: reference, p_note: note });
  return rpcError(error);
}

export async function refundOrderPayment(orderId: string, reason: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('order-refund', { body: { order_id: orderId, reason } });
  const problem = await functionError(error, data);
  return problem || (data?.success ? null : 'The refund could not be made.');
}

/**
 * Pay for an order online: the server creates a Razorpay order for the order's own total, the buyer pays, and the
 * server checks the payment and marks it held. Resolves with null when the money is held, or an error to show.
 */
export async function payOrderOnline(order: OrderPaymentFields, buyer: { name?: string; email?: string; phone?: string }): Promise<string | null> {
  if (!(await loadRazorpayScript()) || !window.Razorpay) return 'The payment window could not be loaded. Check your connection and try again.';
  const { data, error } = await supabase.functions.invoke('razorpay-create-order', { body: { type: 'order_payment', order_id: order.id } });
  const problem = await functionError(error, data);
  if (problem || !data?.order_id) return problem || 'The payment could not be started.';

  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key: data.key_id,
      amount: data.amount,
      currency: data.currency || 'INR',
      order_id: data.order_id,
      name: 'BulkSkart B2B Marketplace',
      description: `Order #${order.order_number} (held until you confirm delivery)`,
      image: '/brand/bulkskart-icon.png',
      prefill: { name: buyer.name ?? '', email: buyer.email ?? '', contact: buyer.phone ?? '' },
      theme: { color: '#FF5A00' },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const { data: verified, error: verifyError } = await supabase.functions.invoke('razorpay-verify-payment', {
          body: { type: 'order_payment', ...response },
        });
        const verifyProblem = await functionError(verifyError, verified);
        resolve(verifyProblem || (verified?.success ? null : 'The payment could not be confirmed. Contact support with your payment reference.'));
      },
      modal: { ondismiss: () => resolve('Payment window closed. Nothing was paid.') },
    });
    rzp.on('payment.failed', (resp: { error?: { description?: string } }) => resolve(`Payment failed: ${resp.error?.description || 'declined'}`));
    rzp.open();
  });
}

export interface PaymentEvent {
  id: string;
  event: 'method_chosen' | 'paid_online' | 'paid_at_factory' | 'released' | 'refunded';
  amount: number | null;
  note: string | null;
  created_at: string;
}

export async function getOrderPaymentEvents(orderId: string): Promise<PaymentEvent[]> {
  const { data } = await supabase.from('order_payment_events').select('id,event,amount,note,created_at').eq('order_id', orderId).order('created_at');
  return (data ?? []) as PaymentEvent[];
}

export function describeEvent(event: PaymentEvent, currency: string): string {
  switch (event.event) {
    case 'method_chosen':
      return event.note === 'at_factory' ? 'Buyer chose to pay at the factory' : 'Buyer chose to pay online';
    case 'paid_online':
      return `Paid online: ${money(event.amount, currency)} (held by BulkSkart)`;
    case 'paid_at_factory':
      return `Paid at the factory: ${money(event.amount, currency)}${event.note ? ` (${event.note})` : ''}`;
    case 'released':
      return `Released to the manufacturer: ${money(event.amount, currency)}`;
    case 'refunded':
      return `Refunded to the buyer: ${money(event.amount, currency)}`;
    default:
      return event.event;
  }
}

// ── factory visits ───────────────────────────────────────────────────────────
export type VisitStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface FactoryVisit {
  id: string;
  company_id: string;
  buyer_id: string;
  order_id: string | null;
  requested_at: string;
  confirmed_at: string | null;
  visitors: number;
  purpose: string | null;
  contact_phone: string | null;
  status: VisitStatus;
  manufacturer_note: string | null;
  created_at: string;
  companies?: { company_name: string; slug: string | null; address: string | null; city: string | null; state: string | null } | null;
  buyer?: { full_name: string | null; email: string | null } | null;
}

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  requested: 'Waiting for the manufacturer',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Visited',
};

export async function bookFactoryVisit(input: {
  companyId: string;
  when: Date;
  visitors: number;
  purpose: string;
  phone: string;
  orderId?: string | null;
}): Promise<string | null> {
  const { error } = await supabase.rpc('book_factory_visit', {
    p_company_id: input.companyId,
    p_when: input.when.toISOString(),
    p_visitors: input.visitors,
    p_purpose: input.purpose,
    p_phone: input.phone,
    p_order_id: input.orderId ?? null,
  });
  return rpcError(error);
}

export async function respondFactoryVisit(visitId: string, action: 'confirm' | 'decline' | 'complete', when: Date | null, note: string): Promise<string | null> {
  const { error } = await supabase.rpc('respond_factory_visit', {
    p_visit_id: visitId,
    p_action: action,
    p_when: when ? when.toISOString() : null,
    p_note: note,
  });
  return rpcError(error);
}

export async function cancelFactoryVisit(visitId: string): Promise<string | null> {
  const { error } = await supabase.rpc('cancel_factory_visit', { p_visit_id: visitId });
  return rpcError(error);
}

export async function getBuyerVisits(buyerId: string): Promise<FactoryVisit[]> {
  const { data } = await supabase
    .from('factory_visits')
    .select('*, companies:company_id(company_name,slug,address,city,state)')
    .eq('buyer_id', buyerId)
    .order('requested_at', { ascending: false });
  return (data ?? []) as FactoryVisit[];
}

export async function getCompanyVisits(companyId: string): Promise<FactoryVisit[]> {
  const { data } = await supabase
    .from('factory_visits')
    .select('*, buyer:profiles!buyer_id(full_name,email)')
    .eq('company_id', companyId)
    .order('requested_at', { ascending: true });
  return (data ?? []) as FactoryVisit[];
}

export function visitTime(visit: Pick<FactoryVisit, 'requested_at' | 'confirmed_at'>): string {
  return new Date(visit.confirmed_at ?? visit.requested_at).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
