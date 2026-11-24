import test from 'node:test';
import assert from 'node:assert/strict';
import { createDescriber, factsFor, isGrounded } from '../src/describe.mjs';

const product = { name: 'PP Woven Sack 50 kg', specifications: { Size: '60 x 90 cm', 'Fabric GSM': '70 - 90' }, description_source: 'Laminated sacks for cement and fertiliser.' };
const facts = factsFor(product);

test('a description is kept only when it adds no number, claim or link', () => {
  assert.equal(isGrounded('Laminated 50 kg polypropylene woven sack, 60 x 90 cm, for cement and fertiliser.', facts), true);
  assert.equal(isGrounded('A 50 kg sack with 5000 pieces in stock.', facts), false, 'new number');
  assert.equal(isGrounded('The best woven sack for cement.', facts), false, 'superlative');
  assert.equal(isGrounded('ISO certified sacks.', facts), false, 'certification not in the facts');
  assert.equal(isGrounded('See www.alpha.example for more.', facts), false, 'link');
});

const fakeClient = (reply) => ({ beta: { messages: { create: async (req) => { fakeClient.last = req; return reply; } } } });

test('the request uses the configured model, low effort and refusal fallbacks', async () => {
  const describe = createDescriber({ enabled: true, model: 'claude-opus-5-5' }, { client: fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Laminated 50 kg woven sack, 60 x 90 cm, for cement and fertiliser.' }] }) });
  assert.equal(await describe(product), 'Laminated 50 kg woven sack, 60 x 90 cm, for cement and fertiliser.');
  assert.equal(fakeClient.last.model, 'claude-opus-5-5');
  assert.deepEqual(fakeClient.last.output_config, { effort: 'low' });
  assert.equal(fakeClient.last.fallbacks, 'default');
  assert.ok(fakeClient.last.betas.includes('server-side-fallback-2026-07-01'));
});

test('an ungrounded answer, a refusal or INSUFFICIENT falls back to the page text (null)', async () => {
  for (const reply of [
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Supplied to 300 clients across India.' }] },
    { stop_reason: 'refusal', content: [] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'INSUFFICIENT' }] },
  ]) {
    assert.equal(await createDescriber({ enabled: true, model: 'claude-opus-5-5' }, { client: fakeClient(reply) })(product), null);
  }
  assert.equal(createDescriber({ enabled: false }), null, 'off without an API key');
});
