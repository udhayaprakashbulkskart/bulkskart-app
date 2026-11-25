import { describe, expect, it } from 'vitest';
import { parseEvent, secretName, sign, verifySignature } from '../../supabase/functions/credit-lender-webhook/verify';

const SECRET = 'test-secret-only-for-this-file';
const NOW = 1_800_000_000_000; // fixed clock
const TS = String(NOW / 1000);
const APP = '11111111-2222-4333-8444-555555555555';

describe('lender webhook signature', () => {
  it('accepts a correctly signed, fresh request', async () => {
    const body = JSON.stringify({ id: 'evt-1001', type: 'repayment.received', data: {} });
    const sig = `v1=${await sign(SECRET, TS, body)}`;
    expect(await verifySignature(SECRET, TS, sig, body, NOW)).toEqual({ ok: true });
  });
  it('refuses a changed body, a wrong secret, a missing or malformed signature', async () => {
    const body = '{"id":"evt-1001"}';
    const sig = `v1=${await sign(SECRET, TS, body)}`;
    expect(await verifySignature(SECRET, TS, sig, `${body} `, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifySignature('other-secret', TS, sig, body, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifySignature(SECRET, TS, null, body, NOW)).toEqual({ ok: false, reason: 'missing_signature' });
    expect(await verifySignature(SECRET, TS, 'v1=xyz', body, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('refuses replays older than 5 minutes and timestamps from the future', async () => {
    const body = '{}';
    const old = String(NOW / 1000 - 301);
    expect(await verifySignature(SECRET, old, `v1=${await sign(SECRET, old, body)}`, body, NOW)).toEqual({ ok: false, reason: 'stale_timestamp' });
    const future = String(NOW / 1000 + 400);
    expect(await verifySignature(SECRET, future, `v1=${await sign(SECRET, future, body)}`, body, NOW)).toEqual({ ok: false, reason: 'stale_timestamp' });
  });
  it('names the secret from the partner code and refuses odd codes', () => {
    expect(secretName('partner_a')).toBe('CREDIT_WEBHOOK_SECRET_PARTNER_A');
    expect(secretName('../x')).toBeNull();
    expect(secretName('A')).toBeNull();
  });
});

describe('lender webhook events', () => {
  const ev = (o: object) => JSON.stringify(o);
  it('accepts the four event types with their required fields', () => {
    const kfs = { sanctioned_amount: 500000 };
    expect(parseEvent(ev({ id: 'evt-0001', type: 'application.decision', data: { application_id: APP, decision: 'approved', approved_amount: 500000, kfs, lender_reference: 'L-1' } })).ok).toBe(true);
    expect(parseEvent(ev({ id: 'evt-0002', type: 'application.decision', data: { application_id: APP, decision: 'rejected', lender_reference: 'L-2' } })).ok).toBe(true);
    expect(parseEvent(ev({ id: 'evt-0003', type: 'disbursement.update', data: { disbursement_id: APP, status: 'disbursed', utr: 'UTR123456' } })).ok).toBe(true);
    expect(parseEvent(ev({ id: 'evt-0004', type: 'schedule.set', data: { application_id: APP, installments: [{ installment_no: 1 }] } })).ok).toBe(true);
    expect(parseEvent(ev({ id: 'evt-0005', type: 'repayment.received', data: { application_id: APP, amount: 1000, method: 'nach', reference: 'NACH-1' } })).ok).toBe(true);
  });
  it('refuses what would let money appear without the lender\'s evidence', () => {
    expect(parseEvent(ev({ id: 'evt-0006', type: 'application.decision', data: { application_id: APP, decision: 'approved', approved_amount: 500000, lender_reference: 'L-1' } }))).toEqual({ ok: false, reason: 'kfs_required' });
    expect(parseEvent(ev({ id: 'evt-0007', type: 'application.decision', data: { application_id: APP, decision: 'approved', approved_amount: 1, kfs: {} } }))).toEqual({ ok: false, reason: 'lender_reference_required' });
    expect(parseEvent(ev({ id: 'evt-0008', type: 'disbursement.update', data: { disbursement_id: APP, status: 'disbursed' } }))).toEqual({ ok: false, reason: 'utr_required' });
    expect(parseEvent(ev({ id: 'evt-0009', type: 'wallet.credit', data: {} }))).toEqual({ ok: false, reason: 'unknown_event_type' });
    expect(parseEvent(ev({ id: 'e1', type: 'schedule.set', data: { application_id: APP, installments: [1] } }))).toEqual({ ok: false, reason: 'event_id_required' });
    expect(parseEvent('not json')).toEqual({ ok: false, reason: 'invalid_json' });
  });
});
