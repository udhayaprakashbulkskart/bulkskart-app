/**
 * razorpay-verify-payment
 *
 * Verifies the Razorpay HMAC signature and then activates what the order was for:
 *  1. Subscription plan or add-on (subscriptions + subscription_orders)
 *  2. Product Promotion (product_promotions + products)
 *  3. Auction posting fee: publishes the auction stored with the order (auction_fee_orders + auctions)
 *
 * What gets activated always comes from the order row saved by razorpay-create-order (plan, promotion, lot), and
 * that row must belong to the signed-in user. The plan or company named in the request is never trusted.
 * Calling it again for an order that is already done returns the same success without doing anything twice.
 *
 * POST body: { type: 'subscription' | 'promotion' | 'auction_fee', razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_LIMITS: Record<string, { max_products: number; max_rfq_leads: number }> = {
  starter:    { max_products: 5,         max_rfq_leads: 5      },
  business:   { max_products: 50,        max_rfq_leads: 50     },
  growth:     { max_products: 999999,    max_rfq_leads: 999999 },
  enterprise: { max_products: 999999,    max_rfq_leads: 999999 },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Compares two hex strings in constant time. */
function sameSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function expectedSignature(secret: string, orderId: string, paymentId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${orderId}|${paymentId}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newAuctionNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `BS-REV-${Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 6).toUpperCase()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const keySecret   = (Deno.env.get('RAZORPAY_KEY_SECRET') || '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!keySecret) {
      return json(503, { error: 'Payment gateway is not configured. Please contact support.', code: 'RAZORPAY_KEYS_MISSING' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json(401, { error: 'Unauthorized: Please log in' });

    const payload = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
    const type = payload.type === 'promotion' || payload.type === 'auction_fee' ? payload.type : 'subscription';

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(400, { error: 'Missing required payment verification fields' });
    }

    // HMAC-SHA256 over "order_id|payment_id": proves Razorpay took this payment for this order
    const expected = await expectedSignature(keySecret, String(razorpay_order_id), String(razorpay_payment_id));
    if (!sameSignature(expected, String(razorpay_signature))) {
      console.error('Signature mismatch for order', razorpay_order_id);
      return json(400, { error: 'Payment verification failed: invalid signature' });
    }

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const isAdmin = callerProfile?.role === 'admin';
    const now = new Date();

    // ========================================================
    // CASE A: Auction posting fee → publish the stored lot
    // ========================================================
    if (type === 'auction_fee') {
      const { data: order } = await supabase
        .from('auction_fee_orders')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();
      if (!order || (order.user_id !== user.id && !isAdmin)) return json(404, { error: 'Payment order not found' });
      if (order.status === 'paid' && order.auction_id) {
        return json(200, { success: true, auction_id: order.auction_id, payment_id: order.razorpay_payment_id });
      }

      // Claim the order first, so a second call cannot publish the lot twice
      const { data: claimed } = await supabase
        .from('auction_fee_orders')
        .update({ status: 'paid', razorpay_payment_id, paid_at: now.toISOString() })
        .eq('id', order.id)
        .eq('status', 'pending')
        .select('id');
      if (!claimed || claimed.length === 0) {
        const { data: again } = await supabase.from('auction_fee_orders').select('auction_id').eq('id', order.id).maybeSingle();
        return json(200, { success: true, auction_id: again?.auction_id ?? null, payment_id: razorpay_payment_id });
      }

      const draft = order.auction_draft ?? {};
      const hours = draft.duration === '24h' ? 24 : 1;
      const quantity = Number(draft.total_quantity);
      const unit = String(draft.quantity_unit || 'Pieces');
      const fee = `₹${(order.amount_paise / 100).toLocaleString('en-IN')} (India, incl. 18% GST)`;
      const { data: sellerCompany } = await supabase.from('companies').select('id').eq('owner_id', order.user_id).maybeSingle();

      const row = {
        auction_type: 'reverse',
        title: draft.title,
        description: draft.description || `Bulk lot of ${quantity} ${unit} for ${hours === 24 ? '24-hour' : '60-minute'} bidding.`,
        total_quantity: quantity,
        moq: Math.max(1, Math.floor(quantity * 0.1)),
        quantity_unit: unit,
        starting_price: Number(draft.starting_price),
        reserve_price: Number(draft.reserve_price ?? draft.starting_price),
        min_bid_increment: Number(draft.min_bid_increment) || 2,
        current_highest_bid: Number(draft.starting_price),
        total_bids: 0,
        currency: 'INR',
        duration_minutes: hours * 60,
        start_time: now.toISOString(),
        end_time: new Date(now.getTime() + hours * 3_600_000).toISOString(),
        anti_sniping_enabled: true,
        anti_sniping_trigger_seconds: 120,
        anti_sniping_extend_seconds: 120,
        status: 'live',
        delivery_location: draft.delivery_location || null,
        freight_terms: draft.lead_time || null,
        seller_id: order.user_id,
        seller_company_id: sellerCompany?.id ?? null,
        specifications: {
          'Lot Quantity': `${quantity} ${unit}`,
          ...(draft.specs ? { 'Specs Note': draft.specs } : {}),
          'Auction Window': hours === 24 ? '24-Hour Bidding' : '60-Minute Bidding',
          ...(draft.lead_time ? { 'Dispatch Time': draft.lead_time } : {}),
          'Posting Fee Paid': fee,
          'Payment Ref': razorpay_payment_id,
          ...(draft.billing_name ? { 'Seller Billing Name': draft.billing_name } : {}),
          ...(draft.tax_id ? { 'Tax ID / GSTIN': draft.tax_id } : {}),
        },
        images: Array.isArray(draft.images) ? draft.images : [],
        fee_order_id: razorpay_order_id,
        fee_payment_id: razorpay_payment_id,
        fee_paid_at: now.toISOString(),
      };

      // auction numbers are unique; try a fresh one if a number is already taken
      let auctionId: string | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3 && !auctionId; attempt++) {
        const { data: created, error } = await supabase
          .from('auctions')
          .insert({ ...row, auction_number: newAuctionNumber() })
          .select('id')
          .single();
        if (created?.id) auctionId = created.id;
        else lastError = error;
      }
      if (!auctionId) {
        console.error('Auction publish failed after payment:', lastError);
        // hand the order back so the same payment can publish the lot on a retry
        await supabase.from('auction_fee_orders').update({ status: 'pending' }).eq('id', order.id);
        return json(500, { error: 'Payment received, but the auction could not be published yet. Please try again or contact support.', payment_id: razorpay_payment_id });
      }
      await supabase.from('auction_fee_orders').update({ auction_id: auctionId }).eq('id', order.id);
      return json(200, { success: true, auction_id: auctionId, payment_id: razorpay_payment_id });
    }

    // ========================================================
    // CASE B: Promotion Verification & Activation
    // ========================================================
    if (type === 'promotion') {
      const { data: promo } = await supabase
        .from('product_promotions')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();
      if (!promo) return json(404, { error: 'Promotion order not found' });

      const { data: owner } = await supabase.from('companies').select('owner_id').eq('id', promo.company_id).maybeSingle();
      if (owner?.owner_id !== user.id && !isAdmin) return json(403, { error: 'This promotion belongs to another company' });

      const durationDays = Number(promo.duration_days) || 7;
      const promoType = promo.promotion_type || 'featured';
      if (promo.payment_status === 'paid' && promo.status === 'active') {
        return json(200, { success: true, message: 'Promotion already active', promotion_id: promo.id, product_id: promo.product_id, active_until: promo.ends_at });
      }
      const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const { error: promoUpdErr } = await supabase
        .from('product_promotions')
        .update({
          razorpay_payment_id,
          razorpay_signature,
          payment_status: 'paid',
          status: 'active',
          paid_at: now.toISOString(),
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', promo.id);
      if (promoUpdErr) {
        console.error('Error updating product promotion status:', promoUpdErr);
        return json(500, { error: 'Payment received, but the promotion could not be switched on. Please contact support.' });
      }

      const updateProductPayload: Record<string, unknown> = { is_promoted: true, promotion_type: promoType, updated_at: now.toISOString() };
      if (promoType === 'featured' || promoType === 'campaign') updateProductPayload.is_featured = true;
      if (promoType === 'boost' || promoType === 'campaign') updateProductPayload.is_sponsored = true;
      const { error: prodUpdErr } = await supabase.from('products').update(updateProductPayload).eq('id', promo.product_id);
      if (prodUpdErr) console.error('Error updating product promotion flags:', prodUpdErr);

      return json(200, {
        success: true,
        message: 'Product promotion verified and campaign activated successfully',
        promotion_id: promo.id,
        product_id: promo.product_id,
        active_until: endsAt.toISOString(),
      });
    }

    // ========================================================
    // CASE C: Subscription Verification & Activation
    // ========================================================
    const { data: order } = await supabase
      .from('subscription_orders')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();
    if (!order) return json(404, { error: 'Subscription order not found' });
    if (order.user_id !== user.id && !isAdmin) return json(403, { error: 'This order belongs to another account' });
    if (order.status === 'completed') {
      return json(200, { success: true, message: 'Subscription already active', tier: order.plan_tier });
    }

    const companyId = order.company_id;
    const tier = String(order.plan_tier || '').toLowerCase();

    const { error: orderErr } = await supabase
      .from('subscription_orders')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: 'completed',
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', order.id);
    if (orderErr) {
      console.error('Order update error:', orderErr);
      return json(500, { error: 'DB error updating order' });
    }

    if (tier === 'ai_accessibility') {
      await supabase.from('companies').update({ has_ai_access: true }).eq('id', companyId);
      await supabase.from('subscriptions').update({ has_ai_access: true }).eq('company_id', companyId);
      return json(200, { success: true, message: 'AI Accessibility Add-on activated successfully' });
    }

    if (tier === 'flash_sell_24h') {
      const flashUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('companies').update({ flash_sell_until: flashUntil, is_featured: true }).eq('id', companyId);
      return json(200, { success: true, message: '24 Hours Sell Products Spotlight activated successfully', expires_at: flashUntil });
    }

    const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.starter;
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + (order.billing_cycle === 'annual' ? 12 : 1));
    const hasAiIncluded = ['business', 'growth', 'enterprise'].includes(tier);

    const { error: subErr } = await supabase
      .from('subscriptions')
      .upsert(
        {
          company_id: companyId,
          tier,
          price_inr: Number(order.price_inr) || 0,
          billing_cycle: order.billing_cycle ?? 'monthly',
          status: 'active',
          max_products: limits.max_products,
          max_rfq_leads: limits.max_rfq_leads,
          has_ai_access: hasAiIncluded,
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: 'company_id' },
      );
    if (subErr) {
      console.error('Subscription upsert error:', subErr);
      return json(500, { error: 'DB error activating subscription' });
    }

    if (hasAiIncluded) {
      await supabase.from('companies').update({ has_ai_access: true }).eq('id', companyId);
    }

    return json(200, { success: true, message: 'Subscription activated successfully', tier });
  } catch (e) {
    console.error('Unhandled verification error:', e);
    return json(500, { error: 'Internal server error', details: (e as Error)?.message });
  }
});
