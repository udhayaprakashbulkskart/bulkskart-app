/**
 * razorpay-verify-payment
 *
 * Confirms the checkout signature (HMAC-SHA256 of order_id|payment_id) and
 * that Razorpay captured the catalog amount, then activates the stored order.
 * Plan and amount come from the order row, not from the browser.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fulfillCapturedPayment } from '../_shared/fulfillPayment.ts';
import { isUuid, json, keysMissingResponse, razorpayConfig } from '../_shared/http.ts';
import { confirmedPayment, fetchRazorpayPayment } from '../_shared/razorpayApi.ts';
import { verifyCheckoutSignature } from '../_shared/razorpayCore.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { keyId, keySecret } = razorpayConfig();
    if (!keyId || !keySecret) return keysMissingResponse();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (authErr || !user) return json({ error: 'Unauthorized: Please log in' }, 401);

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return json({ error: 'Invalid JSON body' }, 400);

    const orderId = typeof payload.razorpay_order_id === 'string' ? payload.razorpay_order_id : '';
    const paymentId = typeof payload.razorpay_payment_id === 'string' ? payload.razorpay_payment_id : '';
    const signature = typeof payload.razorpay_signature === 'string' ? payload.razorpay_signature : '';
    const companyId = payload.company_id;
    if (!orderId || !paymentId || !signature || !isUuid(companyId)) {
      return json({ error: 'Missing required payment verification fields' }, 400);
    }

    const signatureOk = await verifyCheckoutSignature(keySecret, orderId, paymentId, signature);
    if (!signatureOk) return json({ error: 'Payment verification failed: invalid signature' }, 400);

    const { data: company } = await admin.from('companies').select('id, owner_id').eq('id', companyId).maybeSingle();
    if (!company) return json({ error: 'Company not found' }, 404);
    if (company.owner_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (profile?.role !== 'admin') return json({ error: 'Forbidden: You do not own this company profile' }, 403);
    }

    const { data: promo } = await admin
      .from('product_promotions')
      .select('company_id, total_budget, payment_amount')
      .eq('razorpay_order_id', orderId)
      .maybeSingle();
    const { data: order } = await admin
      .from('subscription_orders')
      .select('company_id, price_inr')
      .eq('razorpay_order_id', orderId)
      .maybeSingle();

    const recordCompanyId = promo?.company_id || order?.company_id;
    const storedAmount = promo ? (promo.total_budget ?? promo.payment_amount) : order?.price_inr;
    if (!recordCompanyId || storedAmount == null) return json({ error: 'Order not found' }, 404);
    if (recordCompanyId !== companyId) return json({ error: 'Order does not belong to this company' }, 403);

    const expectedPaise = Math.round(Number(storedAmount) * 100);
    const payment = await fetchRazorpayPayment(keyId, keySecret, paymentId);
    if ('error' in payment) return json({ error: payment.error }, 502);
    if (!confirmedPayment(payment, orderId, expectedPaise)) {
      return json({ error: 'Payment is not captured for this order' }, 400);
    }

    return await fulfillCapturedPayment({
      admin,
      orderId,
      paymentId,
      signature,
      expectedPaise,
    });
  } catch {
    console.error('Unhandled verification error');
    return json({ error: 'Internal server error' }, 500);
  }
});
