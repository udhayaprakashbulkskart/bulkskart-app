/**
 * razorpay-verify-payment
 *
 * Verifies Razorpay HMAC signature and securely activates:
 *  1. Subscription plan (subscriptions + subscription_orders)
 *  2. Product Promotion (product_promotions + products)
 *
 * POST body for subscription: { type: 'subscription', razorpay_order_id, razorpay_payment_id, razorpay_signature, company_id, plan_tier, billing_cycle }
 * POST body for an order:     { type: 'order_payment', razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * POST body for promotion:    { type: 'promotion', razorpay_order_id, razorpay_payment_id, razorpay_signature, company_id, product_id }
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const keySecret   = (Deno.env.get('RAZORPAY_KEY_SECRET') || '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!keySecret) {
      return new Response(JSON.stringify({
        error: 'Payment gateway is not configured. Please contact support.',
        code: 'RAZORPAY_KEYS_MISSING',
      }), {
        status: 503,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Please log in' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const {
      type,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      company_id,
      product_id,
      plan_tier,
      billing_cycle,
    } = payload;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || (!company_id && type !== 'order_payment')) {
      return new Response(JSON.stringify({ error: 'Missing required payment verification fields' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // HMAC-SHA256 verification: body = order_id + "|" + payment_id
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(keySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    const expectedSig = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSig !== razorpay_signature) {
      console.error('Signature mismatch: expected', expectedSig, 'received', razorpay_signature);
      return new Response(
        JSON.stringify({ error: 'Payment verification failed: invalid signature' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================
    // CASE 0: Order payment → BulkSkart holds it until the order is delivered
    // ========================================================
    if (type === 'order_payment') {
      const reply = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
      const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const isAdmin = callerProfile?.role === 'admin';
      const now = new Date();
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, buyer_id, total_amount, currency, payment_status, supplier_company_id')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();
      if (!order || (order.buyer_id !== user.id && !isAdmin)) return reply(404, { error: 'Order not found' });
      if (order.payment_status && order.payment_status !== 'pending') {
        return reply(200, { success: true, order_id: order.id, payment_status: order.payment_status });
      }
      const { data: held, error: holdErr } = await supabase
        .from('orders')
        .update({ payment_status: 'escrow', payment_method: 'online', paid_amount: order.total_amount, paid_at: now.toISOString(), razorpay_payment_id })
        .eq('id', order.id)
        .eq('payment_status', 'pending')
        .select('id');
      if (holdErr) {
        console.error('Could not mark the order paid:', holdErr);
        return reply(500, { error: 'Payment received, but the order could not be updated yet. Please contact support with your payment reference.', payment_id: razorpay_payment_id });
      }
      if (held && held.length > 0) {
        await supabase.from('order_payment_events').insert({ order_id: order.id, event: 'paid_online', amount: order.total_amount, actor_id: user.id, note: razorpay_payment_id });
        const { data: company } = await supabase.from('companies').select('owner_id').eq('id', order.supplier_company_id).maybeSingle();
        if (company?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: company.owner_id,
            title: 'Buyer paid online',
            message: `Order #${order.order_number}: the buyer paid ${order.currency} ${order.total_amount}. BulkSkart holds it until the buyer confirms delivery, then it moves to your BulkSkart wallet.`,
            type: 'order_payment',
            link: `/dashboard/supplier/orders/${order.id}`,
          });
        }
      }
      return reply(200, { success: true, order_id: order.id, payment_status: 'escrow' });
    }

    // ========================================================
    // CASE A: Promotion Verification & Activation
    // ========================================================
    if (type === 'promotion' || product_id) {
      // Find matching promotion in product_promotions
      const { data: promo, error: promoFindErr } = await supabase
        .from('product_promotions')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('company_id', company_id)
        .maybeSingle();

      if (promoFindErr) {
        console.error('Error finding promotion order:', promoFindErr);
      }

      const promoId = promo?.id;
      const targetProductId = promo?.product_id || product_id;
      const durationDays = promo?.duration_days || 7;
      const promoType = promo?.promotion_type || 'featured';

      const now = new Date();
      const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // 1. Update product_promotions row
      if (promoId) {
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
          .eq('id', promoId);

        if (promoUpdErr) {
          console.error('Error updating product promotion status:', promoUpdErr);
        }
      } else {
        // If row wasn't pre-created, insert active promotion directly
        await supabase.from('product_promotions').insert({
          company_id,
          product_id: targetProductId,
          promotion_type: promoType,
          duration_days: durationDays,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          payment_status: 'paid',
          status: 'active',
          paid_at: now.toISOString(),
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
        });
      }

      // 2. Update product flags in products table
      if (targetProductId) {
        const updateProductPayload: Record<string, any> = {
          is_promoted: true,
          updated_at: now.toISOString(),
        };

        if (promoType === 'featured' || promoType === 'campaign') {
          updateProductPayload.is_featured = true;
        }
        if (promoType === 'boost' || promoType === 'campaign') {
          updateProductPayload.is_sponsored = true;
        }

        const { error: prodUpdErr } = await supabase
          .from('products')
          .update(updateProductPayload)
          .eq('id', targetProductId);

        if (prodUpdErr) {
          console.error('Error updating product promotion flags:', prodUpdErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product promotion verified and campaign activated successfully',
          promotion_id: promoId,
          product_id: targetProductId,
          active_until: endsAt.toISOString(),
        }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================
    // CASE B: Subscription Verification & Activation
    // ========================================================
    const { error: orderErr } = await supabase
      .from('subscription_orders')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('company_id', company_id);

    if (orderErr) {
      console.error('Order update error:', orderErr);
      return new Response(
        JSON.stringify({ error: 'DB error updating order' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const tierToUse = plan_tier ? String(plan_tier).toLowerCase() : 'starter';
    const now = new Date();

    // Check if this is an Add-on purchase
    if (tierToUse === 'ai_accessibility' || tierToUse === 'ai_addon' || tierToUse === 'addon_ai') {
      // Activate AI Accessibility for company
      await supabase.from('companies').update({ has_ai_access: true }).eq('id', company_id);
      await supabase.from('subscriptions').update({ has_ai_access: true }).eq('company_id', company_id);

      return new Response(
        JSON.stringify({ success: true, message: 'AI Accessibility Add-on activated successfully' }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    if (tierToUse === 'flash_sell_24h' || tierToUse === 'flash_sell') {
      // Activate 24 Hours Sell Products Spotlight
      const flashUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('companies').update({ flash_sell_until: flashUntil, is_featured: true }).eq('id', company_id);

      return new Response(
        JSON.stringify({ success: true, message: '24 Hours Sell Products Spotlight activated successfully', expires_at: flashUntil }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const limits = PLAN_LIMITS[tierToUse] ?? PLAN_LIMITS.starter;
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + (billing_cycle === 'annual' ? 12 : 1));
    const hasAiIncluded = ['business', 'growth', 'enterprise'].includes(tierToUse);

    const priceMap: Record<string, number> = {
      starter: 2500,
      business: 7500,
      growth: 15000,
      enterprise: 35000,
    };

    const { error: subErr } = await supabase
      .from('subscriptions')
      .upsert(
        {
          company_id,
          tier: tierToUse,
          price_inr: priceMap[tierToUse] ?? 2500,
          billing_cycle: billing_cycle ?? 'monthly',
          status: 'active',
          max_products: limits.max_products,
          max_rfq_leads: limits.max_rfq_leads,
          has_ai_access: hasAiIncluded,
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: 'company_id' }
      );

    if (subErr) {
      console.error('Subscription upsert error:', subErr);
      return new Response(
        JSON.stringify({ error: 'DB error activating subscription' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    if (hasAiIncluded) {
      await supabase.from('companies').update({ has_ai_access: true }).eq('id', company_id);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Subscription activated successfully', tier: tierToUse }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Unhandled verification error:', e);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: e?.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
