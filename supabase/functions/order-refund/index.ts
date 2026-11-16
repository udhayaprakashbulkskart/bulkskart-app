/**
 * order-refund
 *
 * An admin returns a held order payment to the buyer through Razorpay (for example when the order was cancelled, or
 * a dispute was decided for the buyer). Only payments still held by BulkSkart ('escrow') can be refunded here; once a
 * payment is released to the manufacturer it is no longer BulkSkart's to return.
 *
 * POST body: { order_id, reason }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  try {
    const keyId = (Deno.env.get('RAZORPAY_KEY_ID') || '').trim();
    const keySecret = (Deno.env.get('RAZORPAY_KEY_SECRET') || '').trim();
    if (!keyId || !keySecret) return json(503, { error: 'Payment gateway is not configured.', code: 'RAZORPAY_KEYS_MISSING' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: 'Please sign in again.' });

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return json(403, { error: 'Only admins can refund payments.' });

    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
    if (!reason) return json(400, { error: 'Say why the payment is refunded.' });

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, buyer_id, supplier_company_id, payment_status, paid_amount, currency, razorpay_payment_id')
      .eq('id', String(body?.order_id || ''))
      .maybeSingle();
    if (!order) return json(404, { error: 'Order not found' });
    if (order.payment_status !== 'escrow') return json(409, { error: 'Only a payment still held by BulkSkart can be refunded here.' });
    if (!order.razorpay_payment_id) return json(409, { error: 'This order has no online payment to refund.' });

    const amountPaise = Math.round(Number(order.paid_amount) * 100);
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.razorpay_payment_id)}/refund`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, speed: 'normal', notes: { order_number: order.order_number, reason } }),
    });
    const refund = await rzpRes.json().catch(() => null);
    if (!rzpRes.ok || !refund?.id) {
      console.error('Razorpay refund failed:', refund);
      return json(502, { error: refund?.error?.description || 'Razorpay did not accept the refund. Nothing was changed.' });
    }

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from('orders')
      .update({ payment_status: 'refunded', refunded_at: now, refund_id: refund.id })
      .eq('id', order.id)
      .eq('payment_status', 'escrow');
    if (updErr) {
      console.error('Refund sent but the order could not be updated:', updErr);
      return json(500, { error: `The refund was sent (${refund.id}) but the order could not be updated. Please update it by hand.` });
    }
    await admin.from('order_payment_events').insert({ order_id: order.id, event: 'refunded', amount: order.paid_amount, actor_id: user.id, note: `${refund.id}: ${reason}` });

    const { data: company } = await admin.from('companies').select('owner_id').eq('id', order.supplier_company_id).maybeSingle();
    const notices = [
      { user_id: order.buyer_id, link: `/dashboard/buyer/orders/${order.id}`, message: `Order #${order.order_number}: ${order.currency} ${order.paid_amount} is being refunded to you. Banks usually take 5–7 working days. Reason: ${reason}` },
      ...(company?.owner_id ? [{ user_id: company.owner_id, link: `/dashboard/supplier/orders/${order.id}`, message: `Order #${order.order_number}: the buyer's held payment was refunded. Reason: ${reason}` }] : []),
    ];
    for (const notice of notices) {
      await admin.from('notifications').insert({ ...notice, title: 'Payment refunded', type: 'order_payment' });
    }

    return json(200, { success: true, refund_id: refund.id });
  } catch (e) {
    console.error('order-refund failed:', e);
    return json(500, { error: 'The refund could not be made. Nothing was changed.' });
  }
});
