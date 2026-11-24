import test from 'node:test';
import assert from 'node:assert/strict';
import { createFetcher } from '../src/net.mjs';
import { checkUrl, processSite } from '../src/worker.mjs';
import { fakeWeb, testGstin } from './helpers.mjs';

const G = testGstin('24AAACA1111A1Z');
const site = {
  'https://www.alpha.example/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /admin' },
  'https://alpha.example/': { redirect: 'https://www.alpha.example/' },
  'https://www.alpha.example/': { html: `<html><head><title>Alpha Polymers Pvt. Ltd.</title></head><body><a href="/contact">Contact</a> <a href="/products">Products</a> <a href="/admin/x">Admin</a></body></html>` },
  'https://www.alpha.example/contact': { html: `<html><body><h1>Contact</h1><p>Address: Plot 12, GIDC, Vapi, Gujarat 396195</p><p>GSTIN ${G}</p><p>Phone: 98250 00000</p></body></html>` },
  'https://www.alpha.example/products': { html: '<html><body><h1>Products</h1><a href="/products/pp-sack">PP Woven Sack</a> <a href="/products/bopp-bag">BOPP Bag</a></body></html>' },
  'https://www.alpha.example/products/pp-sack': { html: '<html><body><h1>PP Woven Sack 50 kg</h1><table><tr><th>Size</th><td>60 x 90 cm</td></tr><tr><th>GSM</th><td>80</td></tr></table></body></html>' },
  'https://www.alpha.example/products/bopp-bag': { html: '<html><body><h1>BOPP Laminated Bag</h1><table><tr><th>Print</th><td>8 colour</td></tr><tr><th>Width</th><td>40 cm</td></tr></table></body></html>' },
  'https://www.alpha.example/products/gone': { status: 404, html: 'gone' },
};

function fakeRpc() {
  const calls = [];
  const rpc = async (fn, args) => {
    calls.push({ fn, args });
    if (fn === 'discovery_worker_upsert_supplier') return { id: 'sup-1', created: true, duplicate_of: null, gstin: args.p.gstin, needs_gst_check: true };
    if (fn === 'discovery_worker_upsert_product') return { id: `prod-${calls.length}`, created: true, duplicate: false };
    if (fn === 'discovery_worker_evaluate') return { verification_status: 'needs_review', publish_status: 'internal' };
    if (fn === 'discovery_worker_record_gst') return { verification_status: 'verified' };
    return null;
  };
  return { rpc, calls };
}

test('a company website becomes one supplier with its products, source pages and evidence', async () => {
  const web = fakeWeb(site);
  const { rpc, calls } = fakeRpc();
  const stats = { pages_read: 0, not_company: 0, suppressed: 0, suppliers_new: 0, suppliers_updated: 0, duplicates: 0, products_new: 0, products_updated: 0, product_duplicates: 0, gst_checked: 0, gst_errors: 0 };
  const gstFetch = [];
  const cfg = { maxProductsPerSite: 60, gst: { url: '' } };
  await processSite('https://alpha.example/', { rpc, fetcher: createFetcher({ ...web, minDelayMs: 0 }), settings: { max_pages_per_site: 25 }, cfg, describe: null, stats, job: { id: 'job-1' }, foundVia: 'seed_url', deadline: Date.now() + 60_000 });
  const sup = calls.find((c) => c.fn === 'discovery_worker_upsert_supplier').args.p;
  assert.equal(sup.website_url, 'https://www.alpha.example/');
  assert.equal(sup.name_on_site, 'Alpha Polymers Pvt. Ltd.');
  assert.equal(sup.gstin, G);
  assert.equal(sup.source_url, 'https://www.alpha.example/contact', 'the page the GSTIN was read on');
  assert.equal(sup.city, 'Vapi');
  assert.deepEqual(sup.category_slugs, ['packaging']);
  const products = calls.filter((c) => c.fn === 'discovery_worker_upsert_product').map((c) => c.args.p);
  assert.deepEqual(products.map((p) => p.name).sort(), ['BOPP Laminated Bag', 'PP Woven Sack 50 kg']);
  assert.ok(products.every((p) => p.source_url.startsWith('https://www.alpha.example/products/') && p.price_text === null && p.description_generated === false));
  assert.equal(stats.products_new, 2);
  assert.ok(!web.calls.some((u) => u.includes('/admin/')), 'robots.txt Disallow was obeyed');
  assert.ok(!calls.some((c) => c.fn === 'discovery_worker_record_gst'), 'no GST provider configured: no GST result is recorded');
  assert.equal(calls.at(-1).fn, 'discovery_worker_evaluate');
  void gstFetch;
});

test('rechecks tell a removed page (gone) from a temporary failure', async () => {
  const f = createFetcher({ ...fakeWeb(site), minDelayMs: 0 });
  assert.deepEqual(await checkUrl(f, 'https://www.alpha.example/products/gone'), { ok: false, gone: true, http_status: 404, url: 'https://www.alpha.example/products/gone' });
  assert.equal((await checkUrl(f, 'https://www.alpha.example/products/pp-sack')).ok, true);
  assert.equal((await checkUrl(f, 'https://nxdomain.alpha.example/')).gone, true, 'a domain that no longer exists is gone');
});
