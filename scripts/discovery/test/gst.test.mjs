import test from 'node:test';
import assert from 'node:assert/strict';
import { findGstins, isoDate, isValidGstin, readTaxpayer, stateOfGstin, verifyGstin } from '../src/gst.mjs';
import { testGstin } from './helpers.mjs';

const G = testGstin('24AAACA1111A1Z');

test('check character and state', () => {
  assert.equal(isValidGstin(G), true);
  assert.equal(isValidGstin(G.slice(0, 14) + (G[14] === 'A' ? 'B' : 'A')), false);
  assert.equal(isValidGstin('24AAACA1111A1Z'), false);
  assert.equal(stateOfGstin(G), 'Gujarat');
});

test('GSTINs are found in page text, labelled ones marked', () => {
  const found = findGstins(`Regd office ... GSTIN: ${G.toLowerCase()} | other 24AAACA1111A1ZZ`);
  assert.equal(found.length, 1);
  assert.equal(found[0].gstin, G);
  assert.equal(found[0].labelled, true);
});

test('a GSTN-format provider answer is read', () => {
  const body = { status_cd: '1', data: { gstin: G, lgnm: 'ALPHA POLYMERS PRIVATE LIMITED', tradeNam: 'ALPHA POLYMERS', sts: 'Active', rgdt: '17/05/2018', ctb: 'Private Limited Company',
    pradr: { addr: { stcd: 'Gujarat', pncd: '396195' } } } };
  const t = readTaxpayer(body, G);
  assert.deepEqual([t.gst_status, t.legal_name, t.trade_name, t.registered_state, t.registered_pincode, t.registered_on], ['Active', 'ALPHA POLYMERS PRIVATE LIMITED', 'ALPHA POLYMERS', 'Gujarat', '396195', '2018-05-17']);
});

test('a camelCase provider answer is read, and an answer for another GSTIN is ignored', () => {
  const t = readTaxpayer({ result: { GSTIN: G, status: 'Cancelled', legalName: 'X', cancellationDate: '2024-01-02' } }, G);
  assert.equal(t.gst_status, 'Cancelled');
  assert.equal(t.cancelled_on, '2024-01-02');
  assert.equal(readTaxpayer({ data: { gstin: testGstin('27AAACB2222B1Z'), sts: 'Active' } }, G), null);
});

test('verify: not configured, found, not found, provider error', async () => {
  assert.equal((await verifyGstin(G, { url: '' })).result, 'not_configured');
  const cfg = { url: 'https://gsp.example/taxpayer/{gstin}', apiKey: 'k', authHeader: 'X-Api-Key', extraHeaders: {}, provider: 'gsp.example' };
  let seen;
  const ok = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ data: { gstin: G, sts: 'Active', lgnm: 'ALPHA' } }), { status: 200 }); };
  const r = await verifyGstin(G, cfg, { fetchImpl: ok });
  assert.equal(r.result, 'found');
  assert.equal(seen.url, `https://gsp.example/taxpayer/${G}`);
  assert.equal(seen.init.headers['X-Api-Key'], 'k');
  assert.equal((await verifyGstin(G, cfg, { fetchImpl: async () => new Response('{"error":{"error_cd":"SWEB_9035","message":"Invalid GSTIN / UID"}}', { status: 200 }) })).result, 'not_found');
  assert.equal((await verifyGstin(G, cfg, { fetchImpl: async () => new Response('busy', { status: 503 }) })).result, 'error');
  assert.equal((await verifyGstin(G, cfg, { fetchImpl: async () => { throw new Error('ETIMEDOUT'); } })).result, 'error');
  assert.equal(isoDate('5/1/2020'), '2020-01-05');
});
