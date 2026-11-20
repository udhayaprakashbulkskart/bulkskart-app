/**
 * razorpay-create-order
 *
 * Creates a Razorpay order for:
 * 1. Subscription plans (subscription_orders)
 * 2. Product Promotions (product_promotions)
 * 3. Paying for an order online; razorpay-verify-payment then holds the money until the order is delivered
 *
 * POST body for subscription: { type: 'subscription', plan_tier, plan_label, price_inr, billing_cycle, company_id }
 * POST body for an order:     { type: 'order_payment', order_id }   (the amount is the order's own total)
 * POST body for promotion:    { type: 'promotion', product_id, promotion_type, duration_days, base_amount, gst_amount, total_amount, target_category, target_country, company_id }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const keyId       = (Deno.env.get('RAZORPAY_KEY_ID') || '').trim();
    const keySecret   = (Deno.env.get('RAZORPAY_KEY_SECRET') || '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!keyId || !keySecret) {
      console.error('Razorpay keys missing: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set on edge runtime');
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

    const body = await req.json();
    const { type = 'subscription', company_id } = body;

    // ========================================================
    // Paying for an order (the buyer of that order). The money is held by
    // BulkSkart and reaches the manufacturer's wallet only after delivery.
    // ========================================================
    if (type === 'order_payment') {
      const credentials = btoa(`${keyId}:${keySecret}`);
      const reply = (status: number, payload: unknown) =>
        new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, buyer_id, total_amount, currency, payment_status, order_status, supplier_company_id')
        .eq('id', String(body.order_id || ''))
        .maybeSingle();
      if (!order || order.buyer_id !== user.id) return reply(404, { error: 'Order not found' });
      if ((order.payment_status ?? 'pending') !== 'pending') return reply(409, { error: 'This order is already paid' });
      if (order.order_status === 'cancelled') return reply(409, { error: 'This order is cancelled' });
      if ((order.currency ?? 'INR') !== 'INR') {
        return reply(400, { error: 'Online payment is available for orders in rupees. Pay at the factory, or ask the manufacturer to quote in INR.' });
      }
      const amountPaise = Math.round(Number(order.total_amount) * 100);
      if (!Number.isFinite(amountPaise) || amountPaise < 100) return reply(400, { error: 'This order has no amount to pay' });

      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `ord_${String(order.order_number).slice(0, 30)}`,
          notes: { type: 'order_payment', order_id: order.id, order_number: order.order_number, buyer_id: user.id },
        }),
      });
      if (!rzpRes.ok) {
        const err = await rzpRes.text();
        console.error('Razorpay order creation failed for order payment:', err);
        return reply(502, { error: 'The payment could not be started. Large amounts may need netbanking, or a higher limit on the Razorpay account.', details: err });
      }
      const rzpOrder = await rzpRes.json();
      const { error: saveErr } = await supabase
        .from('orders')
        .update({ razorpay_order_id: rzpOrder.id, payment_method: 'online' })
        .eq('id', order.id);
      if (saveErr) {
        console.error('Could not record the payment order on the order:', saveErr);
        return reply(500, { error: 'Could not start the payment. Please try again.' });
      }
      return reply(200, { order_id: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency, key_id: keyId });
    }

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'Missing company_id' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership of the company or admin role
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('id, owner_id')
      .eq('id', company_id)
      .maybeSingle();

    if (compErr || !company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is owner or admin
    if (company.owner_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: You do not own this company profile' }), {
          status: 403,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    const credentials = btoa(`${keyId}:${keySecret}`);

    // ========================================================
    // CASE A: Product Promotion Order
    // ========================================================
    if (type === 'promotion') {
      const {
        product_id,
        promotion_type = 'featured',
        duration_days = 7,
        base_amount = 999,
        gst_amount = 179.82,
        total_amount = 1178.82,
        target_category,
        target_country = 'All Countries',
      } = body;

      if (!product_id) {
        return new Response(JSON.stringify({ error: 'Missing product_id for promotion' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // Verify product belongs to this company
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, name, company_id')
        .eq('id', product_id)
        .eq('company_id', company_id)
        .maybeSingle();

      if (prodErr || !product) {
        return new Response(JSON.stringify({ error: 'Product not found or does not belong to your company' }), {
          status: 404,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const totalVal = Math.max(1, Number(total_amount));
      const amountPaise = Math.round(totalVal * 100);

      // Create Razorpay Order
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `promo_${Date.now()}`,
          notes: {
            type: 'promotion',
            company_id,
            product_id,
            promotion_type,
            duration_days: String(duration_days),
            user_id: user.id,
            product_name: product.name,
          },
        }),
      });

      if (!rzpRes.ok) {
        const err = await rzpRes.text();
        console.error('Razorpay order creation failed for promotion:', err);
        return new Response(JSON.stringify({ error: 'Failed to create Razorpay order for promotion', details: err }), {
          status: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const rzpOrder = await rzpRes.json();

      // Record pending promotion in product_promotions table
      let promoRecordId: string | undefined;
      const { data: promoRecord, error: promoErr } = await supabase
        .from('product_promotions')
        .insert({
          company_id,
          product_id,
          promotion_type,
          target_category: target_category || null,
          target_country: target_country || 'All Countries',
          duration_days: Number(duration_days),
          base_amount: Number(base_amount),
          gst_amount: Number(gst_amount),
          total_budget: totalVal,
          payment_amount: totalVal,
          payment_currency: 'INR',
          payment_status: 'pending',
          payment_method: 'razorpay',
          razorpay_order_id: rzpOrder.id,
          status: 'pending_payment',
        })
        .select('id')
        .maybeSingle();

      if (promoErr) {
        console.error('Warning inserting pending product promotion:', promoErr);
      } else {
        promoRecordId = promoRecord?.id;
      }

      return new Response(
        JSON.stringify({
          order_id: rzpOrder.id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          key_id: keyId,
          promotion_id: promoRecordId,
          product_name: product.name,
        }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================
    // CASE B: Subscription Order
    // ========================================================
    const { plan_tier, plan_label, price_inr, billing_cycle } = body;

    if (!plan_tier || !price_inr) {
      return new Response(JSON.stringify({ error: 'Missing required plan_tier or price_inr' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const amount = Math.round(Number(price_inr) * 100);

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `sub_${Date.now()}`,
        notes: { plan_tier, plan_label, company_id, user_id: user.id },
      }),
    });

    if (!rzpRes.ok) {
      const err = await rzpRes.text();
      console.error('Razorpay order creation failed for subscription:', err);
      return new Response(JSON.stringify({ error: 'Razorpay order creation failed', details: err }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const rzpOrder = await rzpRes.json();

    const { error: dbErr } = await supabase.from('subscription_orders').insert({
      company_id,
      user_id: user.id,
      plan_tier,
      plan_label: plan_label ?? plan_tier,
      price_inr: Number(price_inr),
      billing_cycle: billing_cycle ?? 'monthly',
      razorpay_order_id: rzpOrder.id,
      status: 'pending',
    });

    if (dbErr) {
      console.error('DB insert error:', dbErr);
      return new Response(JSON.stringify({ error: 'DB error' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ order_id: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency, key_id: keyId }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Unhandled error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error', details: e?.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
