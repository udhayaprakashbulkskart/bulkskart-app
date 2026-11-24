import test from 'node:test';
import assert from 'node:assert/strict';
import { createFetcher, FetchBlocked, isPrivateAddress, publicUrl } from '../src/net.mjs';
import { fakeWeb } from './helpers.mjs';

test('private and reserved addresses are recognised', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '203.0.113.10', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('only public http(s) addresses on default ports are opened', () => {
  assert.ok(publicUrl('https://alpha.example/a'));
  for (const u of ['ftp://alpha.example', 'http://localhost/', 'http://10.0.0.1/', 'http://alpha.example:8080/', 'https://user:pw@alpha.example/', 'http://intranet/', 'http://box.local/']) {
    assert.equal(publicUrl(u), null, u);
  }
});

test('robots.txt is obeyed', async () => {
  const web = fakeWeb({ 'https://alpha.example/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /private' }, 'https://alpha.example/ok': { html: '<h1>ok</h1>' } });
  const f = createFetcher({ ...web, minDelayMs: 0 });
  assert.equal((await f.page('https://alpha.example/ok')).status, 200);
  await assert.rejects(f.page('https://alpha.example/private/x'), (e) => e instanceof FetchBlocked && e.reason === 'robots_disallowed');
});

test('a robots.txt the server cannot give (5xx) means: do not crawl', async () => {
  const web = fakeWeb({ 'https://beta.example/robots.txt': { status: 503, body: '' }, 'https://beta.example/': { html: 'x' } });
  await assert.rejects(createFetcher({ ...web, minDelayMs: 0 }).page('https://beta.example/'), (e) => e.reason === 'robots_disallowed');
});

test('a host that resolves to a private address is never fetched, also after a redirect', async () => {
  const web = fakeWeb({ 'https://alpha.example/go': { redirect: 'https://inside.example/admin' } }, { privateHosts: ['inside.example'] });
  const f = createFetcher({ ...web, minDelayMs: 0 });
  await assert.rejects(f.page('https://inside.example/'), (e) => e.reason === 'private_address');
  await assert.rejects(f.page('https://alpha.example/go'), (e) => e.reason === 'private_address');
  assert.ok(!web.calls.some((u) => u.includes('inside.example/admin')), 'the private page was not requested');
});

test('non-HTML is refused and big pages are cut off', async () => {
  const web = fakeWeb({ 'https://alpha.example/file.zip': { type: 'application/zip', body: 'x' }, 'https://alpha.example/big': { html: 'a'.repeat(5000) } });
  const f = createFetcher({ ...web, minDelayMs: 0, maxBytes: 1000 });
  await assert.rejects(f.page('https://alpha.example/file.zip'), (e) => e.reason === 'not_html');
  assert.ok((await f.page('https://alpha.example/big')).html.length <= 1000);
});

test('requests to one site are spaced out', async () => {
  const web = fakeWeb({ 'https://alpha.example/a': { html: 'a' }, 'https://alpha.example/b': { html: 'b' } });
  const f = createFetcher({ ...web, minDelayMs: 120 });
  const t = Date.now();
  await f.page('https://alpha.example/a');
  await f.page('https://alpha.example/b');
  assert.ok(Date.now() - t >= 110, `took ${Date.now() - t} ms`);
});
