import { buildRazorpayOrderBody, paymentMatchesOrder, type PriceQuote, type RazorpayPaymentCheck } from './razorpayCore.ts';

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

export async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  quote: PriceQuote,
  receipt: string,
  notes: Record<string, string>,
): Promise<{ id: string; amount: number; currency: string } | { error: string }> {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: basicAuth(keyId, keySecret),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRazorpayOrderBody(quote, receipt, notes)),
  });
  if (!response.ok) {
    console.error('Razorpay order creation failed', response.status);
    return { error: 'Razorpay order creation failed' };
  }
  const order = await response.json();
  if (!order?.id || order.amount !== quote.amountPaise) {
    console.error('Razorpay returned an unexpected order amount');
    return { error: 'Razorpay order creation failed' };
  }
  return { id: order.id, amount: order.amount, currency: order.currency || 'INR' };
}

export async function fetchRazorpayPayment(
  keyId: string,
  keySecret: string,
  paymentId: string,
): Promise<RazorpayPaymentCheck | { error: string }> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: basicAuth(keyId, keySecret) },
  });
  if (!response.ok) {
    console.error('Razorpay payment lookup failed', response.status);
    return { error: 'Could not confirm the payment with Razorpay' };
  }
  const payment = await response.json();
  return {
    id: String(payment.id || paymentId),
    orderId: String(payment.order_id || ''),
    amountPaise: Number(payment.amount || 0),
    currency: String(payment.currency || ''),
    status: String(payment.status || ''),
  };
}

export function confirmedPayment(
  payment: RazorpayPaymentCheck,
  orderId: string,
  expectedPaise: number,
): boolean {
  return paymentMatchesOrder(payment, orderId, expectedPaise);
}
