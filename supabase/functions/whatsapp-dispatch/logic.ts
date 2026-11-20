/**
 * WhatsApp messages sent through AiSensy API campaigns.
 *
 * Pure helpers (no Deno or network), so they can be unit-tested. Each event
 * maps to an API campaign created in AiSensy whose approved template takes the
 * parameters in TEMPLATES, in that order. An event with no campaign name set
 * on the server is skipped, so nothing goes out until the campaign exists.
 */

export const EVENTS = ['new_quotation', 'quotation_accepted', 'new_buy_lead'] as const;
export type MessageEvent = (typeof EVENTS)[number];

/** Suggested template text for each campaign; {{n}} are the parameters, in order. */
export const TEMPLATES: Record<MessageEvent, { sendsTo: string; text: string; params: string[] }> = {
  new_quotation: {
    sendsTo: 'The buyer, when a manufacturer quotes on their requirement',
    text: 'Hi {{1}}, {{2}} has sent you a quotation for "{{3}}" at {{4}}. Compare and reply on BulkSkart: https://www.bulkskart.com/dashboard/buyer/quotes',
    params: ['Buyer name', 'Manufacturer company', 'Requirement title', 'Quoted price'],
  },
  quotation_accepted: {
    sendsTo: 'The manufacturer, when the buyer accepts their quotation',
    text: 'Hi {{1}}, the buyer has accepted your quotation for "{{2}}" at {{3}}. See the details on BulkSkart: https://www.bulkskart.com/dashboard/supplier/quotations',
    params: ['Manufacturer name', 'Requirement title', 'Quoted price'],
  },
  new_buy_lead: {
    sendsTo: 'Manufacturers matched to a new buyer requirement',
    text: 'Hi {{1}}, a buyer on BulkSkart needs "{{2}}" ({{3}}, delivery to {{4}}). Send your quotation: https://www.bulkskart.com/dashboard/supplier/rfqs',
    params: ['Manufacturer name', 'Requirement title', 'Quantity', 'Delivery place'],
  },
};

const isEvent = (v: string): v is MessageEvent => (EVENTS as readonly string[]).includes(v);

/**
 * Campaign names per event, from AISENSY_CAMPAIGNS: JSON such as
 * {"new_quotation":"bk_new_quote"} or "new_quotation=bk_new_quote,new_buy_lead=bk_lead".
 */
export function parseCampaigns(raw: string | null | undefined): Partial<Record<MessageEvent, string>> {
  const out: Partial<Record<MessageEvent, string>> = {};
  const text = (raw || '').trim();
  if (!text) return out;
  let pairs: [string, unknown][] = [];
  if (text.startsWith('{')) {
    try {
      pairs = Object.entries(JSON.parse(text) as Record<string, unknown>);
    } catch {
      return out;
    }
  } else {
    pairs = text.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)] as [string, unknown];
    });
  }
  for (const [k, v] of pairs) {
    const key = k.trim();
    const name = typeof v === 'string' ? v.trim() : '';
    if (isEvent(key) && name) out[key] = name;
  }
  return out;
}

/** A phone number as AiSensy expects it: digits with country code (India assumed for 10 digits). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^00[1-9]\d{9,13}$/.test(digits)) return digits.slice(2);
  if (/^[1-9]\d{10,14}$/.test(digits)) return digits;
  return null;
}

/** Template parameters cannot hold line breaks, tabs or long runs of spaces, and cannot be empty. */
export function cleanParam(value: unknown, max = 120): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function formatPrice(amount: number | string | null | undefined, currency?: string | null, unit?: string | null): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  const code = (currency || 'INR').toUpperCase();
  const value = n.toLocaleString(code === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 });
  const money = code === 'INR' ? `₹${value}` : `${code} ${value}`;
  const per = cleanParam(unit, 20);
  return per ? `${money} per ${per}` : money;
}

export interface MessageContext {
  recipient: { full_name: string | null; phone: string | null } | null;
  requirement?: {
    title: string | null;
    quantity: number | null;
    quantity_unit: string | null;
    destination_city: string | null;
    destination_country: string | null;
    status: string | null;
  } | null;
  quotation?: { unit_price: number | string | null; currency: string | null; moq_unit: string | null } | null;
  supplierCompany?: string | null;
}

export type BuiltMessage =
  | { ok: true; destination: string; userName: string; templateParams: string[] }
  | { ok: false; reason: string };

export function buildMessage(event: MessageEvent, ctx: MessageContext): BuiltMessage {
  const destination = normalizePhone(ctx.recipient?.phone);
  if (!destination) return { ok: false, reason: 'recipient has no valid phone number' };
  const name = cleanParam(ctx.recipient?.full_name, 60) || 'there';
  const userName = cleanParam(ctx.recipient?.full_name, 60) || 'BulkSkart user';
  const req = ctx.requirement;
  const title = cleanParam(req?.title);
  if (!title) return { ok: false, reason: 'requirement not found' };

  let params: string[];
  if (event === 'new_buy_lead') {
    if (req?.status !== 'active') return { ok: false, reason: 'requirement is no longer open' };
    const qty = Number(req?.quantity);
    const quantity = Number.isFinite(qty) && qty > 0
      ? cleanParam(`${qty.toLocaleString('en-IN')} ${req?.quantity_unit || 'units'}`)
      : 'quantity on request';
    const place = cleanParam([req?.destination_city, req?.destination_country].filter(Boolean).join(', ')) || 'India';
    params = [name, title, quantity, place];
  } else {
    const q = ctx.quotation;
    if (!q) return { ok: false, reason: 'quotation not found' };
    const price = formatPrice(q.unit_price, q.currency, req?.quantity_unit || q.moq_unit) || 'the quoted price';
    if (event === 'new_quotation') {
      const company = cleanParam(ctx.supplierCompany, 80) || 'A manufacturer';
      params = [name, company, title, price];
    } else {
      params = [name, title, price];
    }
  }
  return { ok: true, destination, userName, templateParams: params };
}

/** Request body for AiSensy's campaign API (POST https://backend.aisensy.com/campaign/t1/api/v2). */
export function aisensyBody(apiKey: string, campaignName: string, msg: { destination: string; userName: string; templateParams: string[] }) {
  return {
    apiKey,
    campaignName,
    destination: msg.destination,
    userName: msg.userName,
    templateParams: msg.templateParams,
    source: 'bulkskart',
  };
}
