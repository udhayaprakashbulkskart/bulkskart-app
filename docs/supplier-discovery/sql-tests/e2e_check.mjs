/**
 * End to end: the real worker code (scripts/discovery) reads a website served from memory, verifies the GSTIN with
 * a stubbed GST provider, and writes through the real migration 00074 running in PGlite as the service role.
 *
 *   cd scripts/discovery && npm ci && cd ../../docs/supplier-discovery/sql-tests
 *   npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17
 *   node e2e_check.mjs
 *
 * The website and GSTIN are test inputs on the reserved ".example" domain; they exist only in memory.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createFetcher } from '../../../scripts/discovery/src/net.mjs';
import { gstinCheckChar } from '../../../scripts/discovery/src/gst.mjs';
import { recheck, runJob } from '../../../scripts/discovery/src/worker.mjs';

let failed = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✓' : '✗'} ${m}${!c && extra ? `\n    got: ${extra}` : ''}`); if (!c) failed++; };
const G = '24AAACA1111A1Z' + gstinCheckChar('24AAACA1111A1Z');

const db = new PGlite();
await db.exec(`
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TABLE profiles (id uuid PRIMARY KEY, role user_role NOT NULL DEFAULT 'buyer');
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated, service_role;
INSERT INTO profiles VALUES ('00000000-0000-0000-0000-0000000000a1', 'admin');`);
await db.exec(readFileSync(new URL('../../../supabase/migrations/00074_supplier_discovery.sql', import.meta.url), 'utf8'));

const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
// the same calls the worker makes over the API, made directly as the service role
const rpc = async (fn, args = {}) => {
  await db.exec(`SET ROLE service_role`);
  try {
    const sql = `SELECT public.${fn}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(', ')}) AS r`;
    return (await db.query(sql)).rows[0].r;
  } finally { await db.exec('RESET ROLE'); }
};
const asAdmin = async (sql) => {
  await db.exec(`SET ROLE authenticated; SELECT set_config('app.uid', '00000000-0000-0000-0000-0000000000a1', false);`);
  try { return Object.values((await db.query(sql)).rows[0])[0]; } finally { await db.exec(`RESET ROLE; SELECT set_config('app.uid', '', false);`); }
};

// an in-memory website and GST provider
const routes = {
  'https://www.alpha.example/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /admin' },
  'https://www.alpha.example/': { html: '<html><head><title>Alpha Polymers Pvt. Ltd.</title></head><body><a href="/contact">Contact</a> <a href="/products">Products</a></body></html>' },
  'https://www.alpha.example/contact': { html: `<html><body><h1>Contact</h1><p>Address: Plot 12, GIDC, Vapi, Gujarat 396195</p><p>GSTIN ${G}</p><p>Phone: 98250 00000</p></body></html>` },
  'https://www.alpha.example/products': { html: '<html><body><h1>Products</h1><a href="/products/pp-sack">PP Woven Sack</a></body></html>' },
  'https://www.alpha.example/products/pp-sack': { html: '<html><body><h1>PP Woven Sack 50 kg</h1><p>Laminated woven sacks for cement and fertiliser packing, printed in up to four colours.</p><table><tr><th>Size</th><td>60 x 90 cm</td></tr><tr><th>GSM</th><td>80</td></tr></table></body></html>' },
};
const fetchImpl = async (url) => {
  const r = routes[url] ?? routes[url.replace(/\/$/, '')];
  if (!r) return new Response('nf', { status: 404, headers: { 'content-type': 'text/html' } });
  return new Response(r.html ?? r.body, { status: r.status ?? 200, headers: { 'content-type': r.type ?? 'text/html' } });
};
const lookup = async () => [{ address: '203.0.113.10', family: 4 }];
globalThis.fetch = async (url) => {
  if (String(url).startsWith('https://gsp.example/')) {
    return new Response(JSON.stringify({ data: { gstin: G, lgnm: 'ALPHA POLYMERS PRIVATE LIMITED', tradeNam: 'ALPHA POLYMERS', sts: 'Active', rgdt: '01/04/2019', pradr: { addr: { stcd: 'Gujarat', pncd: '396195' } } } }), { status: 200 });
  }
  throw new Error(`unexpected network call: ${url}`);
};
const cfg = { maxProductsPerSite: 60, gst: { url: 'https://gsp.example/search?gstin={gstin}', apiKey: 'test', authHeader: 'Authorization', extraHeaders: {}, provider: 'gsp.example' }, search: { provider: '' } };
const ctx = { rpc, fetcher: createFetcher({ fetchImpl, lookup, minDelayMs: 0 }), cfg, describe: null, deadline: Date.now() + 120_000 };

// admin queues the website; the worker runs the job
const jobId = await asAdmin(`SELECT public.admin_discovery_queue_job('seed_urls', NULL, NULL, NULL, ARRAY['https://www.alpha.example/'])`);
const claim = await rpc('discovery_worker_claim_job');
ok(claim?.job?.id === jobId, 'the worker claims the queued website job');
await runJob(claim, ctx);

const jobs = await asAdmin(`SELECT public.admin_discovery_jobs()`);
ok(jobs[0].status === 'done' && jobs[0].stats.suppliers_new === 1 && jobs[0].stats.products_new === 1 && jobs[0].stats.gst_checked === 1, 'the job finishes with its stats', JSON.stringify(jobs[0].stats));
const list = await asAdmin(`SELECT public.admin_discovery_suppliers('published')`);
const s = list.rows[0];
ok(list.total === 1 && s.verification_status === 'verified' && s.publish_status === 'published', 'active GST + matching name and state: verified and published automatically', JSON.stringify(s?.verification_status));
ok(s.source_url === 'https://www.alpha.example/contact' && s.website_host === 'alpha.example' && s.found_via === 'seed_url', 'it keeps the page it came from');
ok(s.latest_gst_check.method === 'gst_api' && s.latest_gst_check.provider === 'gsp.example' && Number(s.latest_gst_check.name_score) === 1, 'the GST check is stored with its provider and the name match');
const dir = await (async () => { await db.exec('SET ROLE anon'); try { return (await db.query('SELECT public.directory_supplier(id) r FROM (SELECT (public.directory_suppliers()->\'rows\'->0->>\'id\')::uuid id) x')).rows[0].r; } finally { await db.exec('RESET ROLE'); } })();
ok(dir?.name === 'ALPHA POLYMERS' && dir.products.length === 1 && dir.products[0].name === 'PP Woven Sack 50 kg' && dir.products[0].price_text === null, 'the public directory shows it with its product and no invented price');
ok(!JSON.stringify(dir).includes('98250') && !JSON.stringify(dir).includes(G) && !JSON.stringify(dir).includes('alpha.example'), 'no phone, GSTIN or source link in public');

// a second run of the same website: nothing duplicated
const job2 = await asAdmin(`SELECT public.admin_discovery_queue_job('seed_urls', NULL, NULL, NULL, ARRAY['https://alpha.example/'])`);
await runJob(await rpc('discovery_worker_claim_job'), ctx);
const again = await asAdmin(`SELECT public.admin_discovery_overview()`);
ok(again.suppliers.total === 1 && again.products.total === 1, 'reading the website again updates the same records (no duplicates)', JSON.stringify(again.suppliers));
void job2;

// the product page disappears: recheck takes it and then the supplier off the directory
delete routes['https://www.alpha.example/products/pp-sack'];
await db.exec(`UPDATE discovery.suppliers SET next_recheck_at = now() - interval '1 minute'`);
const due = await rpc('discovery_worker_due_rechecks', { p_limit: 10 });
for (const item of due) await recheck(item, ctx);
const after = (await asAdmin(`SELECT public.admin_discovery_suppliers('all')`)).rows[0];
ok(after.publish_status === 'internal' && after.published_products === 0, 'product page gone: product suspended, supplier no longer published (no product left)', JSON.stringify([after.publish_status, after.published_products]));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
