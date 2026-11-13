/**
 * razorpay-create-order
 *
 * Creates a Razorpay order for a catalog price. The browser sends the SKU
 * (plan, add-on, promotion, or auction fee). Amounts from the client are ignored.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isUuid, json, keysMissingResponse, razorpayConfig } from '../_shared/http.ts';
import { createRazorpayOrder } from '../_shared/razorpayApi.ts';
import { quoteAddon, quoteAuctionFee, quotePlan, quotePromotion, type PriceQuote } from '../_shared/razorpayCore.ts';

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (authErr || !user) return json({ error: 'Unauthorized: Please log in' }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400);

    const type = typeof body.type === 'string' ? body.type : 'subscription';
    const companyId = body.company_id;
    if (!isUuid(companyId)) return json({ error: 'Missing company_id' }, 400);

    const { data: company, error: compErr } = await admin
      .from('companies')
      .select('id, owner_id')
      .eq('id', companyId)
      .maybeSingle();
    if (compErr || !company) return json({ error: 'Company not found' }, 404);
    if (company.owner_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (profile?.role !== 'admin') return json({ error: 'Forbidden: You do not own this company profile' }, 403);
    }

    if (type === 'promotion') {
      return await createPromotionOrder({ admin, userId: user.id, companyId, body, keyId, keySecret });
    }
    if (type === 'auction_fee') {
      return await createCatalogOrder({
        admin,
        userId: user.id,
        companyId,
        quote: quoteAuctionFee(),
        keyId,
        keySecret,
        receiptPrefix: 'auc',
      });
    }

    const tier = typeof body.plan_tier === 'string' ? body.plan_tier : '';
    const cycle = typeof body.billing_cycle === 'string' ? body.billing_cycle : 'monthly';
    const quote = quotePlan(tier, cycle) || quoteAddon(tier);
    if (!quote) return json({ error: 'This plan is not available for online payment', code: 'UNKNOWN_PLAN' }, 400);
    return await createCatalogOrder({
      admin,
      userId: user.id,
      companyId,
      quote,
      keyId,
      keySecret,
      receiptPrefix: quote.kind === 'addon' ? 'add' : 'sub',
    });
  } catch {
    console.error('Unhandled create-order error');
    return json({ error: 'Internal server error' }, 500);
  }
});

async function createPromotionOrder(input: {
  admin: any;
  userId: string;
  companyId: string;
  body: any;
  keyId: string;
  keySecret: string;
}) {
  const { admin, userId, companyId, body, keyId, keySecret } = input;
  if (!isUuid(body.product_id)) return json({ error: 'Missing product_id for promotion' }, 400);
  const quote = quotePromotion(String(body.promotion_type || ''), Number(body.duration_days));
  if (!quote?.promotionType || !quote.durationDays) {
    return json({ error: 'Unknown promotion or duration', code: 'UNKNOWN_PROMOTION' }, 400);
  }

  const { data: product, error: prodErr } = await admin
    .from('products')
    .select('id, name, company_id')
    .eq('id', body.product_id)
    .eq('company_id', companyId)
    .maybeSingle();
  if (prodErr || !product) return json({ error: 'Product not found or does not belong to your company' }, 404);

  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: reusable } = await admin
    .from('product_promotions')
    .select('id, razorpay_order_id')
    .eq('company_id', companyId)
    .eq('product_id', product.id)
    .eq('promotion_type', quote.promotionType)
    .eq('duration_days', quote.durationDays)
    .eq('payment_status', 'pending')
    .eq('status', 'pending_payment')
    .eq('total_budget', quote.totalInr)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reusable?.razorpay_order_id) {
    return orderResponse(keyId, reusable.razorpay_order_id, quote, { promotion_id: reusable.id, product_name: product.name });
  }

  const created = await createRazorpayOrder(keyId, keySecret, quote, `promo_${Date.now()}`, {
    type: 'promotion',
    company_id: companyId,
    product_id: product.id,
    promotion_type: quote.promotionType,
    duration_days: String(quote.durationDays),
    user_id: userId,
  });
  if ('error' in created) return json({ error: 'Failed to create Razorpay order for promotion' }, 502);

  const { data: promoRecord, error: promoErr } = await admin
    .from('product_promotions')
    .insert({
      company_id: companyId,
      product_id: product.id,
      promotion_type: quote.promotionType,
      target_category: typeof body.target_category === 'string' ? body.target_category : null,
      target_country: typeof body.target_country === 'string' ? body.target_country : 'All Countries',
      duration_days: quote.durationDays,
      base_amount: quote.baseInr,
      gst_amount: quote.gstInr,
      total_budget: quote.totalInr,
      payment_amount: quote.totalInr,
      payment_currency: 'INR',
      payment_status: 'pending',
      payment_method: 'razorpay',
      razorpay_order_id: created.id,
      status: 'pending_payment',
    })
    .select('id')
    .maybeSingle();
  if (promoErr || !promoRecord) {
    console.error('Pending promotion insert failed', promoErr?.code || promoErr?.message);
    return json({ error: 'Could not record the promotion order' }, 500);
  }

  return orderResponse(keyId, created.id, quote, { promotion_id: promoRecord.id, product_name: product.name });
}

async function createCatalogOrder(input: {
  admin: any;
  userId: string;
  companyId: string;
  quote: PriceQuote;
  keyId: string;
  keySecret: string;
  receiptPrefix: string;
}) {
  const { admin, userId, companyId, quote, keyId, keySecret, receiptPrefix } = input;
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: reusable } = await admin
    .from('subscription_orders')
    .select('razorpay_order_id')
    .eq('company_id', companyId)
    .eq('plan_tier', quote.sku)
    .eq('billing_cycle', quote.billingCycle)
    .eq('status', 'pending')
    .eq('price_inr', quote.totalInr)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reusable?.razorpay_order_id) return orderResponse(keyId, reusable.razorpay_order_id, quote);

  const created = await createRazorpayOrder(keyId, keySecret, quote, `${receiptPrefix}_${Date.now()}`, {
    type: quote.kind,
    sku: quote.sku,
    company_id: companyId,
    user_id: userId,
    billing_cycle: quote.billingCycle,
  });
  if ('error' in created) return json({ error: 'Razorpay order creation failed' }, 502);

  const { error: dbErr } = await admin.from('subscription_orders').insert({
    company_id: companyId,
    user_id: userId,
    plan_tier: quote.sku,
    plan_label: quote.label,
    price_inr: quote.totalInr,
    billing_cycle: quote.billingCycle,
    razorpay_order_id: created.id,
    status: 'pending',
  });
  if (dbErr) {
    console.error('Order insert failed', dbErr.code || dbErr.message);
    const constraint = String(dbErr.code || '') === '23514' || String(dbErr.message || '').includes('plan_tier');
    return json({
      error: constraint
        ? 'This purchase needs the payment plan migration before it can be recorded.'
        : 'Could not record the payment order',
      code: constraint ? 'PLAN_TIER_CONSTRAINT' : 'DB_ERROR',
    }, constraint ? 422 : 500);
  }

  return orderResponse(keyId, created.id, quote);
}

function orderResponse(keyId: string, orderId: string, quote: PriceQuote, extra: Record<string, unknown> = {}) {
  return json({
    order_id: orderId,
    amount: quote.amountPaise,
    currency: 'INR',
    key_id: keyId,
    livemode: keyId.startsWith('rzp_live_'),
    total_inr: quote.totalInr,
    description: quote.label,
    ...extra,
  });
}
