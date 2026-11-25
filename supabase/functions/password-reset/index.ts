/**
 * password-reset — reset a forgotten password with a 6-digit code sent on WhatsApp (migration 00078). No e-mail link.
 *
 * POST { action: 'request', email }                    → sends the code to the WhatsApp number on the account
 * POST { action: 'reset', email, code, password }      → checks the code, saves the new password, signs out everywhere
 *
 * Answers { status }: sent (with phone_hint) | ok | no_account | no_phone | too_soon | rate_limited | not_configured |
 * send_failed | wrong_code (with attempts_left) | expired | locked | weak_password | invalid_email | error.
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AISENSY_API_KEY (already used by whatsapp-dispatch),
 * AISENSY_OTP_CAMPAIGN (the AiSensy API campaign whose approved template takes the code as its only parameter),
 * optional AISENSY_OTP_COPY_BUTTON=true for an "authentication" template with a copy-code button.
 * Codes and passwords are never logged.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aisensyOtpBody, clientIp, generateCode, isEmail, normalizePhone, passwordProblem, phoneHint } from './logic.ts';

const AISENSY_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ status: 'error' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ status: 'error' }, 500);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const ip = clientIp(req.headers);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!isEmail(email)) return json({ status: 'invalid_email' });

    if (body.action === 'request') {
      const apiKey = (Deno.env.get('AISENSY_API_KEY') || '').trim();
      const campaign = (Deno.env.get('AISENSY_OTP_CAMPAIGN') || '').trim();
      if (!apiKey || !campaign) return json({ status: 'not_configured' });

      const { data: found, error: e1 } = await db.rpc('pwreset_service_lookup', { p_email: email, p_ip: ip });
      if (e1) throw e1;
      if (found.status !== 'ok') return json({ status: found.status });
      const phone = normalizePhone(found.phone);
      if (!phone) return json({ status: 'no_phone' });

      const code = generateCode();
      const { data: made, error: e2 } = await db.rpc('pwreset_service_create', { p_user: found.user_id, p_code: code, p_ip: ip, p_phone_last2: phone.slice(-2) });
      if (e2) throw e2;
      if (made.status !== 'ok') return json({ status: made.status });

      let sent = false;
      try {
        const res = await fetch(AISENSY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aisensyOtpBody(apiKey, campaign, phone, String(found.full_name ?? ''), code, Deno.env.get('AISENSY_OTP_COPY_BUTTON') === 'true')),
          signal: AbortSignal.timeout(20_000),
        });
        sent = res.ok;
        if (!sent) console.error('password-reset: AiSensy refused', res.status);
      } catch {
        console.error('password-reset: AiSensy unreachable');
      }
      if (!sent) {
        await db.rpc('pwreset_service_void', { p_id: made.id });
        return json({ status: 'send_failed' });
      }
      return json({ status: 'sent', phone_hint: phoneHint(phone) });
    }

    if (body.action === 'reset') {
      const code = String(body.code ?? '').replace(/\D/g, '');
      const password = String(body.password ?? '');
      const weak = passwordProblem(password);
      if (weak) return json({ status: 'weak_password', message: weak });
      if (code.length !== 6) return json({ status: 'wrong_code' });
      const { data: v, error: e3 } = await db.rpc('pwreset_service_verify', { p_email: email, p_code: code, p_ip: ip });
      if (e3) throw e3;
      if (v.status !== 'ok') return json(v);
      const { error: e4 } = await db.auth.admin.updateUserById(v.user_id, { password });
      if (e4) {
        console.error('password-reset: could not save the password');
        return json({ status: 'error' });
      }
      await db.rpc('pwreset_service_finish', { p_user: v.user_id, p_ip: ip });
      return json({ status: 'ok' });
    }

    return json({ status: 'error' }, 400);
  } catch (e) {
    console.error('password-reset: failure', e instanceof Error ? e.name : 'error');
    return json({ status: 'error' }, 500);
  }
});
