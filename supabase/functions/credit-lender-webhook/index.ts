/**
 * credit-lender-webhook — the lending partner reports its decisions, payouts, schedules and repayments here.
 *
 *   POST /functions/v1/credit-lender-webhook?partner=<partner code>
 *   X-BulkSkart-Timestamp, X-BulkSkart-Signature (see verify.ts)
 *   { "id": "<unique event id>", "type": "application.decision" | "disbursement.update" | "schedule.set" | "repayment.received", "data": { … } }
 *
 * The partner's secret is CREDIT_WEBHOOK_SECRET_<CODE> in this function's environment, and the partner must be set to
 * integration "api" in Admin → Business Credit → Partners. The database applies the same rules as for admins and
 * records the source as "lender_api". Request bodies are never logged.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseEvent, secretName, verifySignature } from './verify.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const url = new URL(req.url);
  const partner = (url.searchParams.get('partner') || '').toLowerCase();
  const name = secretName(partner);
  const secret = name ? Deno.env.get(name) : undefined;
  if (!secret) return json(404, { error: 'unknown_partner' });

  const raw = await req.text();
  if (raw.length > 256 * 1024) return json(413, { error: 'too_large' });
  const sig = await verifySignature(secret, req.headers.get('x-bulkskart-timestamp'), req.headers.get('x-bulkskart-signature'), raw);
  if (!sig.ok) return json(401, { error: sig.reason });
  const parsed = parseEvent(raw);
  if (!parsed.ok) return json(400, { error: parsed.reason });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'server_not_configured' });
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('credit_service_lender_event', {
    p_partner_code: partner, p_event_id: parsed.event.id, p_type: parsed.event.type, p_payload: parsed.event.data,
  });
  if (error) {
    const code = (error.message || '').match(/^[a-z_]+/)?.[0] ?? 'rejected';
    console.error('credit-lender-webhook: rejected', partner, parsed.event.type, code);
    return json(code === 'not_found' || code === 'unknown_partner' ? 404 : 409, { error: code });
  }
  return json(200, data ?? { result: 'ok' });
});
