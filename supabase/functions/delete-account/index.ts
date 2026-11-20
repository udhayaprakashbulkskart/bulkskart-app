/**
 * delete-account
 *
 * Deletes the signed-in user's account for real:
 *  - removes their personal details from the profile, and marks it deleted
 *  - hides their products, closes their open requirements and live auctions, deactivates their company profile
 *    and removes their buyer profile
 *  - changes the login's e-mail to a placeholder (so the address can sign up again) and blocks the login
 *
 * Records other people depend on (quotations, orders, messages, reviews) are kept, so a counterparty's history does
 * not disappear; they now show the account as deleted. Refused while the account has orders still in progress.
 *
 * POST body: { reason?: string }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPEN_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json(401, { error: 'Please sign in again to delete your account.' });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;
    const uid = user.id;

    const { data: profile } = await admin.from('profiles').select('id, role').eq('id', uid).maybeSingle();
    if (profile?.role === 'admin') return json(403, { error: 'Admin accounts are removed by another admin.' });

    const { data: company } = await admin.from('companies').select('id').eq('owner_id', uid).maybeSingle();

    // ── orders in progress block the deletion ───────────────────────────────
    const asBuyer = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', uid).in('status', OPEN_ORDER_STATUSES);
    const asSeller = company
      ? await admin.from('orders').select('id', { count: 'exact', head: true }).eq('seller_company_id', company.id).in('status', OPEN_ORDER_STATUSES)
      : { count: 0 };
    const openOrders = (asBuyer.count ?? 0) + (asSeller.count ?? 0);
    if (openOrders > 0) {
      return json(409, { error: `You have ${openOrders} order(s) still in progress. Complete or cancel them first.`, open_orders: openOrders });
    }

    const steps: string[] = [];
    const now = new Date().toISOString();

    // ── listings ─────────────────────────────────────────────────────────────
    if (company) {
      const { error: productsErr } = await admin.from('products').update({ is_active: false }).eq('company_id', company.id);
      if (productsErr) steps.push(`products: ${productsErr.message}`);

      const { error: companyErr } = await admin
        .from('companies')
        .update({
          description: '[Account deleted by its owner]',
          website: null,
          address: null,
          pincode: null,
          logo_url: null,
          cover_url: null,
          gst_doc_url: null,
          iec_doc_url: null,
          reg_doc_url: null,
          verification_status: 'unverified',
          is_featured: false,
          updated_at: now,
        })
        .eq('id', company.id);
      if (companyErr) steps.push(`company: ${companyErr.message}`);

      // columns some databases have; each is cleared on its own so a missing one does not stop the rest
      for (const [column, value] of [
        ['tagline', null], ['banner_url', null], ['is_verified', false], ['phone', null], ['email', null],
        ['whatsapp', null], ['contact_email', null], ['contact_phone', null], ['has_ai_access', false],
      ] as const) {
        await admin.from('companies').update({ [column]: value }).eq('id', company.id);
      }

      await admin.from('subscriptions').update({ status: 'cancelled' }).eq('company_id', company.id);
    }

    const { error: reqErr } = await admin.from('requirements').update({ status: 'closed', updated_at: now }).eq('buyer_id', uid).eq('status', 'active');
    if (reqErr) steps.push(`requirements: ${reqErr.message}`);
    await admin.from('auctions').update({ status: 'cancelled', updated_at: now }).eq('seller_id', uid).in('status', ['live', 'scheduled', 'closing_soon']);
    await admin.from('buyer_profiles').delete().eq('user_id', uid);

    // ── the person ───────────────────────────────────────────────────────────
    const placeholder = `deleted-${uid}@deleted.bulkskart.invalid`;
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ full_name: 'Deleted user', email: placeholder, phone: null, avatar_url: null, status: 'deleted', updated_at: now })
      .eq('id', uid);
    if (profileErr) {
      console.error('Profile scrub failed:', profileErr);
      return json(500, { error: 'Your account could not be deleted. Nothing about your login was changed; please try again or contact support.' });
    }
    for (const column of ['company_name', 'whatsapp', 'city', 'state']) {
      await admin.from('profiles').update({ [column]: null }).eq('id', uid);
    }

    // ── the login: free the e-mail and block sign-in ─────────────────────────
    const { error: authUpdateErr } = await admin.auth.admin.updateUserById(uid, {
      email: placeholder,
      email_confirm: true,
      user_metadata: { deleted: true, deleted_at: now },
      ban_duration: '876000h',
    });
    if (authUpdateErr) {
      console.error('Login could not be blocked:', authUpdateErr);
      return json(500, { error: 'Your details were removed, but the login could not be closed. Please contact support.' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token) await admin.auth.admin.signOut(token, 'global').catch(() => undefined);

    await admin.from('account_deletions').insert({ user_id: uid, role: profile?.role ?? null, reason });
    if (steps.length) console.warn('Account deleted with warnings:', uid, steps);

    return json(200, { success: true });
  } catch (e) {
    console.error('delete-account failed:', e);
    return json(500, { error: 'Your account could not be deleted. Please try again or contact support.' });
  }
});
