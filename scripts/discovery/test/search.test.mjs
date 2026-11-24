import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, isCandidateHost, searchCompanySites } from '../src/search.mjs';

test('marketplaces, directories, social, news and government sites are never treated as company websites', () => {
  for (const h of ['www.indiamart.com', 'dir.indiamart.com', 'tradeindia.com', 'linkedin.com', 'en.wikipedia.org', 'gst.gov.in', 'mca.gov.in', 'iitb.ac.in', 'x.blogspot.com']) {
    assert.equal(isCandidateHost(h), false, h);
  }
  assert.equal(isCandidateHost('www.alpha.example'), true);
  assert.equal(isCandidateHost('alpha.example', ['alpha.example']), false, 'suppressed domains are skipped');
});

test('the query asks for manufacturers in India', () => {
  assert.equal(buildQuery({ query: 'pp woven sacks', location: 'Gujarat' }), 'pp woven sacks manufacturer Gujarat India');
  assert.equal(buildQuery({ query: 'cotton yarn manufacturers in India' }), 'cotton yarn manufacturers in India');
});

test('Brave results: one homepage per website, filtered', async () => {
  let req;
  const fetchImpl = async (url, init) => { req = { url, init }; return new Response(JSON.stringify({ web: { results: [
    { url: 'https://www.alpha.example/products/x', title: 'A' }, { url: 'https://alpha.example/about', title: 'A2' },
    { url: 'https://www.indiamart.com/alpha', title: 'IM' }, { url: 'https://beta.example/', title: 'B' }] } }), { status: 200 }); };
  const r = await searchCompanySites({ query: 'pp sacks', max_results: 5 }, { provider: 'brave', braveKey: 'k' }, { fetchImpl });
  assert.deepEqual(r.sites.map((s) => s.url), ['https://www.alpha.example/', 'https://beta.example/']);
  assert.equal(req.init.headers['X-Subscription-Token'], 'k');
  assert.match(req.url, /country=IN/);
});

test('Google Programmable Search results', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ items: [{ link: 'https://gamma.example/a', title: 'G' }] }), { status: 200 });
  const r = await searchCompanySites({ query: 'cnc parts', max_results: 3 }, { provider: 'google_cse', googleKey: 'k', googleCx: 'cx' }, { fetchImpl });
  assert.deepEqual(r.sites.map((s) => s.url), ['https://gamma.example/']);
});

test('no search API configured is a clear error', async () => {
  await assert.rejects(searchCompanySites({ query: 'x' }, { provider: '' }), /No search API is configured/);
});
