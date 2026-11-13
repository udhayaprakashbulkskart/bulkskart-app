/**
 * razorpay-webhook
 *
 * Razorpay signs the raw body with the webhook secret (X-Razorpay-Signature).
 * This endpoint does not use a user JWT. Keep FUNCTIONS_VERIFY_JWT=false so
 * the edge runtime does not reject Razorpay before this code runs.
 *
 * Handled events: payment.captured, payment.failed, order.paid.
 * Razorpay Subscriptions events are not used. Supplier plans are one-time
 * orders, so subscription.charged and similar events are acknowledged only.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fulfillCapturedPayment, markPaymentFailed } from '../_shared/fulfillPayment.ts';
import { json, razorpayConfig } from '../_shared/http.ts';
import { confirmedPayment, fetchRazorpayPayment } from '../_shared/razorpayApi.ts';
import { isActivationEvent, parseWebhookEvent, verifyWebhookSignature } from '../_shared/razorpayCore.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type, x-razorpay-signature',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { keyId, keySecret, webhookSecret } = razorpayConfig();
    if (!webhookSecret || !keyId || !keySecret) {
      return json({ error: 'Webhook is not configured', code: 'RAZORPAY_WEBHOOK_NOT_CONFIGURED' }, 503);
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';
    const valid = await verifyWebhookSignature(webhookSecret, rawBody, signature);
    if (!valid) return json({ error: 'Invalid webhook signature' }, 400);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const eventName = typeof (parsed as { event?: string })?.event === 'string'
      ? (parsed as { event: string }).event
      : '';
    if (!isActivationEvent(eventName) && eventName !== 'payment.failed') {
      return json({ received: true, ignored: eventName || 'unknown' });
    }

    const event = parseWebhookEvent(parsed);
    if (!event?.orderId) return json({ error: 'Webhook payload is missing the order' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

    if (event.failed || eventName === 'payment.failed') {
      return await markPaymentFailed(admin, event.orderId, event.paymentId);
    }
    if (!event.paymentId) return json({ error: 'Webhook payload is missing the payment' }, 400);

    const payment = await fetchRazorpayPayment(keyId, keySecret, event.paymentId);
    if ('error' in payment) return json({ error: payment.error }, 502);

    const { data: promo } = await admin
      .from('product_promotions')
      .select('total_budget, payment_amount')
      .eq('razorpay_order_id', event.orderId)
      .maybeSingle();
    const { data: order } = await admin
      .from('subscription_orders')
      .select('price_inr')
      .eq('razorpay_order_id', event.orderId)
      .maybeSingle();
    const storedAmount = promo ? (promo.total_budget ?? promo.payment_amount) : order?.price_inr;
    if (storedAmount == null) return json({ received: true, ignored: 'unknown_order' });

    const expectedPaise = Math.round(Number(storedAmount) * 100);
    if (!confirmedPayment(payment, event.orderId, expectedPaise)) {
      console.error('Webhook payment did not match the stored order');
      return json({ error: 'Payment does not match the stored order' }, 400);
    }

    return await fulfillCapturedPayment({
      admin,
      orderId: event.orderId,
      paymentId: event.paymentId,
      signature: null,
      expectedPaise,
    });
  } catch {
    console.error('Unhandled webhook error');
    return json({ error: 'Internal server error' }, 500);
  }
});
