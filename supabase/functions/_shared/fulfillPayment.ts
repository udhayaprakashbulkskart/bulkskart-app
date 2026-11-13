import {
  PLAN_LIMITS,
  paiseFromInr,
  quoteAddon,
  quoteAuctionFee,
  quotePlan,
  type PriceQuote,
} from './razorpayCore.ts';
import { json } from './http.ts';

type AdminClient = any;

function addMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

async function loadOrder(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from('subscription_orders')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();
  if (error) {
    console.error('Order lookup failed', error.code || error.message);
    return { error: json({ error: 'DB error' }, 500) };
  }
  return { order: data };
}

async function loadPromotion(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from('product_promotions')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();
  if (error) {
    console.error('Promotion lookup failed', error.code || error.message);
    return { error: json({ error: 'DB error' }, 500) };
  }
  return { promotion: data };
}

async function insertInvoice(
  admin: AdminClient,
  order: Record<string, any>,
  quoteHint: { baseInr: number; gstInr: number; totalInr: number },
  paymentId: string,
) {
  const { data: existing } = await admin
    .from('subscription_invoices')
    .select('id')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();
  if (existing?.id) return;

  const { data: company } = await admin
    .from('companies')
    .select('company_name, gst_number, address, city, state')
    .eq('id', order.company_id)
    .maybeSingle();

  const gst = Number(quoteHint.gstInr) || 0;
  const cgst = Math.round((gst / 2) * 100) / 100;
  const sgst = Math.round((gst - cgst) * 100) / 100;
  const address = [company?.address, company?.city, company?.state].filter(Boolean).join(', ');

  const { error } = await admin.from('subscription_invoices').insert({
    company_id: order.company_id,
    subscription_order_id: order.id,
    user_id: order.user_id,
    plan_tier: order.plan_tier,
    plan_label: order.plan_label,
    billing_cycle: order.billing_cycle,
    base_amount: quoteHint.baseInr,
    cgst_rate: 9,
    sgst_rate: 9,
    igst_rate: 0,
    cgst_amount: cgst,
    sgst_amount: sgst,
    igst_amount: 0,
    total_amount: quoteHint.totalInr,
    bill_to_company: company?.company_name ?? null,
    bill_to_name: company?.company_name ?? null,
    bill_to_gst: company?.gst_number ?? null,
    bill_to_address: address || null,
    razorpay_payment_id: paymentId,
    supply_type: 'intra',
    status: 'issued',
  });
  if (error) console.error('Invoice insert failed', error.code || error.message);
}

export function quoteForStoredOrder(order: { plan_tier?: string; billing_cycle?: string }): PriceQuote | null {
  const tier = String(order.plan_tier || '');
  if (tier === 'auction_fee') return quoteAuctionFee();
  return quotePlan(tier, order.billing_cycle || 'monthly') || quoteAddon(tier);
}

async function recordInvoice(admin: AdminClient, order: Record<string, any>, paymentId: string) {
  const quote = quoteForStoredOrder(order);
  const orderPaise = paiseFromInr(order.price_inr);
  const hint = quote && quote.amountPaise === orderPaise
    ? { baseInr: quote.baseInr, gstInr: quote.gstInr, totalInr: quote.totalInr }
    : { baseInr: Number(order.price_inr), gstInr: 0, totalInr: Number(order.price_inr) };
  await insertInvoice(admin, order, hint, paymentId);
}

async function ensureSubscription(admin: AdminClient, order: Record<string, any>, paymentId: string) {
  const tier = String(order.plan_tier || '').toLowerCase();
  if (tier === 'ai_accessibility') {
    await admin.from('companies').update({ has_ai_access: true }).eq('id', order.company_id);
    await admin.from('subscriptions').update({ has_ai_access: true }).eq('company_id', order.company_id);
    return;
  }
  if (tier === 'flash_sell_24h') {
    const anchor = new Date(order.completed_at || Date.now()).getTime();
    const proposed = anchor + 24 * 60 * 60 * 1000;
    const { data: company } = await admin
      .from('companies')
      .select('flash_sell_until')
      .eq('id', order.company_id)
      .maybeSingle();
    const current = company?.flash_sell_until ? new Date(company.flash_sell_until).getTime() : 0;
    if (!current || current < proposed) {
      await admin.from('companies').update({
        flash_sell_until: new Date(proposed).toISOString(),
        is_featured: true,
      }).eq('id', order.company_id);
    }
    return;
  }
  if (tier === 'auction_fee') return;

  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.starter;
  const months = order.billing_cycle === 'annual' ? 12 : 1;
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id, ends_at, status, tier, stripe_subscription_id')
    .eq('company_id', order.company_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.stripe_subscription_id === paymentId) return;

  const now = new Date();
  const periodStart = existing?.status === 'active' && existing?.tier === tier && existing?.ends_at && new Date(existing.ends_at) > now
    ? new Date(existing.ends_at)
    : now;
  const endsAt = addMonths(periodStart, months);
  const hasAiIncluded = tier === 'business' || tier === 'growth' || tier === 'enterprise';
  const row = {
    tier,
    price_inr: Number(order.price_inr),
    billing_cycle: order.billing_cycle || 'monthly',
    status: 'active',
    max_products: limits.max_products,
    max_rfq_leads: limits.max_rfq_leads,
    used_rfq_leads: 0,
    has_ai_access: hasAiIncluded,
    starts_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    updated_at: now.toISOString(),
    stripe_subscription_id: paymentId,
  };

  if (!existing) {
    const { error } = await admin.from('subscriptions').insert({ company_id: order.company_id, ...row });
    if (error) throw error;
  } else {
    const { error } = await admin
      .from('subscriptions')
      .update(row)
      .eq('id', existing.id)
      .neq('stripe_subscription_id', paymentId);
    if (error) throw error;
  }

  if (hasAiIncluded) {
    await admin.from('companies').update({ has_ai_access: true }).eq('id', order.company_id);
  }
}

async function ensurePromotion(admin: AdminClient, promo: Record<string, any>, paymentId: string, signature: string | null) {
  if (promo.payment_status === 'paid' && promo.razorpay_payment_id === paymentId) {
    return { promotionId: promo.id, productId: promo.product_id, duplicate: true as const };
  }
  const now = new Date();
  const days = Number(promo.duration_days) || 7;
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const { data: claimed, error } = await admin
    .from('product_promotions')
    .update({
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      payment_status: 'paid',
      status: 'active',
      paid_at: now.toISOString(),
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', promo.id)
    .eq('payment_status', 'pending')
    .select('id, product_id, promotion_type')
    .maybeSingle();
  if (error) throw error;
  if (!claimed) {
    return { promotionId: promo.id, productId: promo.product_id, duplicate: true as const };
  }

  const updateProduct: Record<string, unknown> = {
    is_promoted: true,
    updated_at: now.toISOString(),
  };
  if (claimed.promotion_type === 'featured' || claimed.promotion_type === 'campaign') updateProduct.is_featured = true;
  if (claimed.promotion_type === 'boost' || claimed.promotion_type === 'campaign') updateProduct.is_sponsored = true;
  await admin.from('products').update(updateProduct).eq('id', claimed.product_id);
  return {
    promotionId: claimed.id,
    productId: claimed.product_id,
    duplicate: false as const,
    activeUntil: endsAt.toISOString(),
  };
}

export async function fulfillCapturedPayment(input: {
  admin: AdminClient;
  orderId: string;
  paymentId: string;
  signature: string | null;
  expectedPaise: number;
}) {
  const { admin, orderId, paymentId, signature, expectedPaise } = input;
  const promoLookup = await loadPromotion(admin, orderId);
  if (promoLookup.error) return promoLookup.error;
  if (promoLookup.promotion) {
    const promo = promoLookup.promotion;
    const promoPaise = paiseFromInr(promo.total_budget ?? promo.payment_amount);
    if (promoPaise !== expectedPaise) {
      return json({ error: 'Payment amount does not match the promotion order' }, 400);
    }
    try {
      const result = await ensurePromotion(admin, promo, paymentId, signature);
      return json({
        success: true,
        duplicate: result.duplicate,
        type: 'promotion',
        promotion_id: result.promotionId,
        product_id: result.productId,
        active_until: result.activeUntil,
        message: 'Product promotion verified and campaign activated successfully',
      });
    } catch {
      console.error('Promotion activation failed');
      return json({ error: 'DB error activating promotion' }, 500);
    }
  }

  const orderLookup = await loadOrder(admin, orderId);
  if (orderLookup.error) return orderLookup.error;
  const order = orderLookup.order;
  if (!order) return json({ error: 'Order not found' }, 404);

  const orderPaise = paiseFromInr(order.price_inr);
  if (orderPaise !== expectedPaise) {
    return json({ error: 'Payment amount does not match the order' }, 400);
  }

  if (order.status === 'completed' && order.razorpay_payment_id === paymentId) {
    await ensureSubscription(admin, order, paymentId);
    await recordInvoice(admin, order, paymentId);
    return json({ success: true, duplicate: true, type: order.plan_tier, message: 'Payment already verified' });
  }
  if (order.status === 'completed' || order.status === 'failed' || order.status === 'cancelled') {
    return json({ error: 'Order is not payable' }, 409);
  }

  const { data: claimed, error: claimError } = await admin
    .from('subscription_orders')
    .update({
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (claimError) {
    console.error('Order claim failed', claimError.code || claimError.message);
    return json({ error: 'DB error updating order' }, 500);
  }

  if (!claimed) {
    const again = await loadOrder(admin, orderId);
    if (again.order?.status === 'completed' && again.order?.razorpay_payment_id === paymentId) {
      await ensureSubscription(admin, again.order, paymentId);
      await recordInvoice(admin, again.order, paymentId);
      return json({ success: true, duplicate: true, type: again.order.plan_tier, message: 'Payment already verified' });
    }
    return json({ error: 'Order is not payable' }, 409);
  }

  try {
    await ensureSubscription(admin, claimed, paymentId);
  } catch {
    console.error('Subscription activation failed');
    return json({ error: 'DB error activating subscription' }, 500);
  }

  await recordInvoice(admin, claimed, paymentId);

  return json({
    success: true,
    duplicate: false,
    type: claimed.plan_tier,
    tier: claimed.plan_tier,
    message: claimed.plan_tier === 'auction_fee'
      ? 'Auction fee verified'
      : claimed.plan_tier === 'ai_accessibility'
        ? 'AI Accessibility Add-on activated successfully'
        : claimed.plan_tier === 'flash_sell_24h'
          ? '24 Hours Sell Products Spotlight activated successfully'
          : 'Subscription activated successfully',
  });
}

export async function markPaymentFailed(_admin: AdminClient, orderId: string, paymentId: string) {
  // A failed attempt must not close the order. Razorpay can emit payment.failed
  // and then payment.captured for a later attempt on the same order.
  console.error('Razorpay reported a failed payment attempt', orderId, paymentId ? 'with payment id' : 'without payment id');
  return json({ success: true, received: true, order_id: orderId });
}
