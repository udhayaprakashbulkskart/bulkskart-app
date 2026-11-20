import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aisensyBody,
  buildMessage,
  cleanParam,
  formatPrice,
  type MessageContext,
  normalizePhone,
  parseCampaigns,
  TEMPLATES,
} from '../../supabase/functions/whatsapp-dispatch/logic';

const requirement = {
  title: 'Cotton yarn 30s combed',
  quantity: 5000,
  quantity_unit: 'kg',
  destination_city: 'Tiruppur',
  destination_country: 'India',
  status: 'active',
};
const ctx = (over: Partial<MessageContext> = {}): MessageContext => ({
  recipient: { full_name: 'Ravi Kumar', phone: '98765 43210' },
  requirement,
  quotation: { unit_price: 245.5, currency: 'INR', moq_unit: 'kg' },
  supplierCompany: 'Sri Lakshmi Mills',
  ...over,
});

describe('AiSensy campaign settings', () => {
  it('reads JSON or name=value pairs and ignores unknown events', () => {
    expect(parseCampaigns('{"new_quotation":"bk_quote","other":"x","new_buy_lead":" "}')).toEqual({ new_quotation: 'bk_quote' });
    expect(parseCampaigns('new_buy_lead=bk_lead, quotation_accepted=bk_won')).toEqual({ new_buy_lead: 'bk_lead', quotation_accepted: 'bk_won' });
    expect(parseCampaigns('')).toEqual({});
    expect(parseCampaigns('{broken')).toEqual({});
  });
});

describe('phone numbers', () => {
  it('adds India code to 10-digit mobiles and keeps numbers that already have a code', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210');
    expect(normalizePhone('098765-43210')).toBe('919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizePhone('+1 415 555 0100')).toBe('14155550100');
    expect(normalizePhone('0044 20 7946 0958')).toBe('442079460958');
  });
  it('rejects missing or too-short numbers', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('0000000000')).toBeNull();
  });
});

describe('message text', () => {
  it('cleans parameters WhatsApp would reject', () => {
    expect(cleanParam('  two\nlines\tand     spaces ')).toBe('two lines and spaces');
    expect(cleanParam('x'.repeat(200)).length).toBe(120);
  });
  it('formats prices in rupees or the quoted currency', () => {
    expect(formatPrice(245.5, 'INR', 'kg')).toBe('₹245.5 per kg');
    expect(formatPrice(125000, 'INR', null)).toBe('₹1,25,000');
    expect(formatPrice(3.2, 'usd', 'pcs')).toBe('USD 3.2 per pcs');
    expect(formatPrice(0, 'INR', 'kg')).toBe('');
  });

  it('builds each event from real records, in template order', () => {
    const quote = buildMessage('new_quotation', ctx());
    expect(quote).toEqual({
      ok: true,
      destination: '919876543210',
      userName: 'Ravi Kumar',
      templateParams: ['Ravi Kumar', 'Sri Lakshmi Mills', 'Cotton yarn 30s combed', '₹245.5 per kg'],
    });
    const won = buildMessage('quotation_accepted', ctx());
    expect(won.ok && won.templateParams).toEqual(['Ravi Kumar', 'Cotton yarn 30s combed', '₹245.5 per kg']);
    const lead = buildMessage('new_buy_lead', ctx({ quotation: null }));
    expect(lead.ok && lead.templateParams).toEqual(['Ravi Kumar', 'Cotton yarn 30s combed', '5,000 kg', 'Tiruppur, India']);
    for (const [event, msg] of [['new_quotation', quote], ['quotation_accepted', won], ['new_buy_lead', lead]] as const) {
      expect(msg.ok && msg.templateParams.length).toBe(TEMPLATES[event].params.length);
    }
  });

  it('skips instead of sending when something is missing', () => {
    expect(buildMessage('new_quotation', ctx({ recipient: { full_name: 'A', phone: '' } }))).toEqual({ ok: false, reason: 'recipient has no valid phone number' });
    expect(buildMessage('new_quotation', ctx({ requirement: null }))).toEqual({ ok: false, reason: 'requirement not found' });
    expect(buildMessage('quotation_accepted', ctx({ quotation: null }))).toEqual({ ok: false, reason: 'quotation not found' });
    expect(buildMessage('new_buy_lead', ctx({ requirement: { ...requirement, status: 'closed' } }))).toEqual({ ok: false, reason: 'requirement is no longer open' });
  });

  it('never leaves a parameter empty', () => {
    const msg = buildMessage('new_quotation', ctx({ recipient: { full_name: null, phone: '9876543210' }, supplierCompany: null, quotation: { unit_price: null, currency: null, moq_unit: null } }));
    expect(msg.ok && msg.templateParams).toEqual(['there', 'A manufacturer', 'Cotton yarn 30s combed', 'the quoted price']);
    expect(msg.ok && msg.userName).toBe('BulkSkart user');
  });

  it('sends the AiSensy campaign request body', () => {
    expect(aisensyBody('key', 'bk_quote', { destination: '919876543210', userName: 'Ravi', templateParams: ['a'] })).toEqual({
      apiKey: 'key', campaignName: 'bk_quote', destination: '919876543210', userName: 'Ravi', templateParams: ['a'], source: 'bulkskart',
    });
  });
});

describe('key handling', () => {
  it('keeps the AiSensy key on the server only', () => {
    const fn = readFileSync(join(process.cwd(), 'supabase/functions/whatsapp-dispatch/index.ts'), 'utf8');
    expect(fn).toContain("Deno.env.get('AISENSY_API_KEY')");
    const env = readFileSync(join(process.cwd(), 'deploy/bulkskart/stack/.env.example'), 'utf8');
    expect(env).toMatch(/^AISENSY_API_KEY=$/m);
  });
});
