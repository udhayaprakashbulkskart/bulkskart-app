// Sends queued WhatsApp messages (public.whatsapp_messages) through AiSensy.
// Called every minute by pg_cron while messages are pending. Calling it only
// sends what real events already queued, so a repeated call does no harm.
//
// Server settings (edge runtime environment):
//   AISENSY_API_KEY     the AiSensy API campaign key (never in the frontend)
//   AISENSY_CAMPAIGNS   campaign name per event, see logic.ts parseCampaigns
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aisensyBody, buildMessage, EVENTS, type MessageContext, type MessageEvent, parseCampaigns } from './logic.ts';

const AISENSY_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
const BATCH = 25;
const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 10;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Row {
  id: string;
  event: MessageEvent;
  user_id: string;
  ref_id: string;
  attempts: number;
}

// deno-lint-ignore no-explicit-any
type Db = any;

async function loadContext(db: Db, row: Row): Promise<MessageContext> {
  const { data: recipient } = await db.from('profiles').select('full_name, phone').eq('id', row.user_id).maybeSingle();
  const reqCols = 'title, quantity, quantity_unit, destination_city, destination_country, status';
  if (row.event === 'new_buy_lead') {
    const { data: requirement } = await db.from('requirements').select(reqCols).eq('id', row.ref_id).maybeSingle();
    return { recipient, requirement };
  }
  const { data: quotation } = await db
    .from('quotations')
    .select('unit_price, currency, moq_unit, requirement_id, supplier_company_id')
    .eq('id', row.ref_id)
    .maybeSingle();
  if (!quotation) return { recipient, quotation: null };
  const [{ data: requirement }, { data: company }] = await Promise.all([
    db.from('requirements').select(reqCols).eq('id', quotation.requirement_id).maybeSingle(),
    quotation.supplier_company_id
      ? db.from('companies').select('company_name').eq('id', quotation.supplier_company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { recipient, requirement, quotation, supplierCompany: company?.company_name ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const apiKey = (Deno.env.get('AISENSY_API_KEY') || '').trim();
  const campaigns = parseCampaigns(Deno.env.get('AISENSY_CAMPAIGNS'));
  // Without a key, leave the messages queued so they go out once it is set.
  if (!apiKey) return json({ sent: 0, reason: 'AISENSY_API_KEY is not set' });

  const db: Db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Release messages a crashed run left half-claimed.
  const stale = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  await db.from('whatsapp_messages').update({ status: 'pending' }).eq('status', 'sending').lt('claimed_at', stale);

  const { data: next } = await db
    .from('whatsapp_messages')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH);
  const ids = (next ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return json({ sent: 0 });

  // Claim them so two runs never send the same message.
  const { data: claimed, error: claimError } = await db
    .from('whatsapp_messages')
    .update({ status: 'sending', claimed_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id, event, user_id, ref_id, attempts');
  if (claimError) return json({ error: 'could not claim messages' }, 500);

  const counts = { sent: 0, skipped: 0, failed: 0, retry: 0 };
  const finish = (id: string, patch: Record<string, unknown>) => db.from('whatsapp_messages').update(patch).eq('id', id);

  for (const row of (claimed ?? []) as Row[]) {
    const campaign = EVENTS.includes(row.event) ? campaigns[row.event] : undefined;
    if (!campaign) {
      counts.skipped++;
      await finish(row.id, { status: 'skipped', error: `no AiSensy campaign set for ${row.event}` });
      continue;
    }
    const msg = buildMessage(row.event, await loadContext(db, row));
    if (!msg.ok) {
      counts.skipped++;
      await finish(row.id, { status: 'skipped', error: msg.reason });
      continue;
    }
    const attempts = row.attempts + 1;
    try {
      const res = await fetch(AISENSY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aisensyBody(apiKey, campaign, msg)),
      });
      if (res.ok) {
        counts.sent++;
        await finish(row.id, { status: 'sent', attempts, error: null, sent_at: new Date().toISOString() });
        continue;
      }
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`AiSensy ${res.status}: ${detail}`);
    } catch (err) {
      const last = attempts >= MAX_ATTEMPTS;
      counts[last ? 'failed' : 'retry']++;
      await finish(row.id, { status: last ? 'failed' : 'pending', attempts, error: String((err as Error)?.message ?? err).slice(0, 500) });
    }
  }

  return json(counts);
});
