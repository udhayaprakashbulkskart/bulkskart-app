/**
 * razorpay-create-order
 *
 * Creates a Razorpay order for:
 * 1. Subscription plans and add-ons (subscription_orders)
 * 2. Product Promotions (product_promotions)
 * 3. Auction posting fees (auction_fee_orders); the auction itself is published by razorpay-verify-payment
 *
 * Every amount is set here from pricing.ts. Amounts sent by the browser (price_inr, total_amount, ...) are ignored.
 *
 * POST body for subscription: { type: 'subscription', plan_tier, company_id }
 * POST body for promotion:    { type: 'promotion', product_id, promotion_type, duration_days, target_category, target_country, company_id }
 * POST body for auction fee:  { type: 'auction_fee', auction: { title, description, total_quantity, quantity_unit, starting_price,
 *                               reserve_price, min_bid_increment, duration: '1h' | '24h', delivery_location, lead_time, specs,
 *                               billing_name, tax_id, images } }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { auctionFeeTotalInr, promotionPrice, subscriptionPrice } from './pricing.ts';

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** The lot as the seller described it, checked and trimmed; it is stored with the order and published after payment. */
// deno-lint-ignore no-explicit-any
function auctionDraftFrom(input: any): { draft: Record<string, unknown> } | { error: string } {
  const title = cleanText(input?.title, 200);
  const quantity = Math.floor(Number(input?.total_quantity));
  const start = Number(input?.starting_price);
  const rawReserve = input?.reserve_price;
  const reserve = rawReserve === null || rawReserve === undefined || rawReserve === '' ? null : Number(rawReserve);
  const step = input?.min_bid_increment === undefined || input?.min_bid_increment === '' ? 2 : Number(input.min_bid_increment);
  if (!title) return { error: 'Please give the lot a title.' };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Please enter the quantity in the lot.' };
  if (!Number.isFinite(start) || start <= 0) return { error: 'Please enter a starting price greater than 0.' };
  if (reserve !== null && (!Number.isFinite(reserve) || reserve < start)) return { error: 'The reserve price cannot be lower than the starting price.' };
  if (!Number.isFinite(step) || step <= 0) return { error: 'The bid step must be greater than 0.' };
  const images = Array.isArray(input?.images)
    ? input.images.filter((url: unknown) => typeof url === 'string' && /^https:\/\//i.test(url) && url.length < 2000).slice(0, 8)
    : [];
  return {
    draft: {
      title,
      description: cleanText(input?.description, 4000),
      total_quantity: quantity,
      quantity_unit: cleanText(input?.quantity_unit, 40) || 'Pieces',
      starting_price: start,
      reserve_price: reserve ?? start,
      min_bid_increment: step,
      duration: input?.duration === '24h' ? '24h' : '1h',
      delivery_location: cleanText(input?.delivery_location, 200) || null,
      lead_time: cleanText(input?.lead_time, 80),
      specs: cleanText(input?.specs, 2000),
      billing_name: cleanText(input?.billing_name, 200),
      tax_id: cleanText(input?.tax_id, 40),
      images,
    },
  };
}

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
    const credentials = btoa(`${keyId}:${keySecret}`);

    // ========================================================
    // CASE 0: Auction posting fee (any signed-in seller)
    // ========================================================
    if (type === 'auction_fee') {
      const checked = auctionDraftFrom(body.auction);
      if ('error' in checked) {
        return new Response(JSON.stringify({ error: checked.error }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const amountPaise = Math.round(auctionFeeTotalInr() * 100);
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `auction_${Date.now()}`,
          notes: { type: 'auction_fee', user_id: user.id, lot_title: String(checked.draft.title).slice(0, 40) },
        }),
      });
      if (!rzpRes.ok) {
        const err = await rzpRes.text();
        console.error('Razorpay order creation failed for auction fee:', err);
        return new Response(JSON.stringify({ error: 'Failed to create the payment order', details: err }), {
          status: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const rzpOrder = await rzpRes.json();
      const { error: feeErr } = await supabase.from('auction_fee_orders').insert({
        user_id: user.id,
        razorpay_order_id: rzpOrder.id,
        amount_paise: amountPaise,
        currency: 'INR',
        status: 'pending',
        auction_draft: checked.draft,
      });
      if (feeErr) {
        console.error('Could not record the auction fee order:', feeErr);
        return new Response(JSON.stringify({ error: 'Could not record the payment order. Please try again.' }), {
          status: 500,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ order_id: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency, key_id: keyId }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
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

    // ========================================================
    // CASE A: Product Promotion Order
    // ========================================================
    if (type === 'promotion') {
      const {
        product_id,
        promotion_type = 'featured',
        duration_days = 7,
        target_category,
        target_country = 'All Countries',
      } = body;

      // The price comes from the server's table, never from the browser
      const price = promotionPrice(promotion_type, duration_days);
      if (!price) {
        return new Response(JSON.stringify({ error: 'Unknown promotion type or length' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

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

      const totalVal = price.totalInr;
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
            promotion_type: price.type,
            duration_days: String(price.days),
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
          promotion_type: price.type,
          target_category: target_category || null,
          target_country: target_country || 'All Countries',
          duration_days: price.days,
          base_amount: price.baseInr,
          gst_amount: price.gstInr,
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
    // The plan and its price come from the server's table, never from the browser
    const plan = subscriptionPrice(body.plan_tier);
    if (!plan) {
      return new Response(JSON.stringify({ error: 'This plan cannot be bought online. Please contact us.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const amount = Math.round(plan.totalInr * 100);

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
        notes: { plan_tier: plan.tier, plan_label: plan.label, company_id, user_id: user.id },
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
      plan_tier: plan.tier,
      plan_label: plan.label,
      price_inr: plan.totalInr,
      billing_cycle: plan.billingCycle,
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
