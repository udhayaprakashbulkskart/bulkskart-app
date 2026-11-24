/**
 * Runs supabase/migrations/00074_supplier_discovery.sql on an in-memory Postgres (PGlite) with Supabase's roles and
 * checks the rules, the duplicate handling, the rechecks and who may call what.
 *
 *   cd docs/supplier-discovery/sql-tests
 *   npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
 *   node discovery_check.mjs
 *
 * Test inputs use the reserved ".example" domain and GSTIN-shaped strings built here with a valid check character.
 * They exist only inside this in-memory database.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
let failed = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✓' : '✗'} ${m}${!c && extra ? `\n    got: ${extra}` : ''}`); if (!c) failed++; };

// a GSTIN-shaped test string with the right check character
const A36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gst = (first14) => { let t = 0; for (let i = 0; i < 14; i++) { const p = A36.indexOf(first14[i]) * (i % 2 ? 2 : 1); t += Math.floor(p / 36) + (p % 36); } return first14 + A36[(36 - (t % 36)) % 36]; };
const G1 = gst('24AAACA1111A1Z'); // Gujarat
const G2 = gst('33AAACB2222B1Z'); // Tamil Nadu
const G3 = gst('27AAACC3333C1Z'); // Maharashtra
const G4 = gst('29AAACD4444D1Z'); // Karnataka
const BAD = G1.slice(0, 14) + (G1[14] === 'A' ? 'B' : 'A');

await run(`
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TABLE profiles (id uuid PRIMARY KEY, role user_role NOT NULL DEFAULT 'buyer');
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated, service_role;
-- what Supabase does for every new table and function in public
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
INSERT INTO profiles VALUES ('00000000-0000-0000-0000-0000000000a1', 'admin'), ('00000000-0000-0000-0000-0000000000b1', 'buyer');
`);
const mig = readFileSync(new URL('../../../supabase/migrations/00074_supplier_discovery.sql', import.meta.url), 'utf8');
await run(mig);
await run(mig); // safe to run twice
ok(true, 'migration runs twice without error');

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const BUYER = '00000000-0000-0000-0000-0000000000b1';
const as = async (who, sql) => {
  const setup = who === 'service' ? `SET ROLE service_role; SELECT set_config('app.uid', '', false);`
    : who === 'anon' ? `SET ROLE anon; SELECT set_config('app.uid', '', false);`
    : `SET ROLE authenticated; SELECT set_config('app.uid', '${who}', false);`;
  await run(setup);
  try { const rows = await q(sql); return rows.length === 1 && Object.keys(rows[0]).length === 1 ? Object.values(rows[0])[0] : rows; }
  catch (e) { return `ERROR: ${e.message}`; }
  finally { await run(`RESET ROLE; SELECT set_config('app.uid', '', false);`); }
};
const J = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const worker = (fn, args = '') => as('service', `SELECT public.${fn}(${args})`);
const admin = (sql) => as(ADMIN, sql);

// ── helpers ──
ok((await q(`SELECT discovery.gstin_ok('${G1}') a, discovery.gstin_ok('${BAD}') b, discovery.gstin_ok('24AAACA1111A1Z') c`))[0].a === true, 'a GSTIN with the right check character is accepted');
ok((await q(`SELECT discovery.gstin_ok('${BAD}') b`))[0].b === false, 'a GSTIN with a wrong check character is refused');
ok(Number((await q(`SELECT discovery.name_match('M/s Alpha Polymers Pvt. Ltd.', 'ALPHA POLYMERS PRIVATE LIMITED') v`))[0].v) === 1, 'name match ignores M/s, Pvt Ltd, Private Limited and case');
ok(Number((await q(`SELECT discovery.name_match('Alpha Polymers', 'Beta Textiles Mills') v`))[0].v) === 0, 'different names do not match');
ok((await q(`SELECT discovery.host_of('https://WWW.Alpha.example/about?x=1') v`))[0].v === 'alpha.example', 'website host is normalised');

// ── permissions ──
ok(String(await as('anon', `SELECT count(*) FROM discovery.suppliers`)).startsWith('ERROR: permission denied'), 'visitors cannot read the internal discovery tables');
ok(String(await as(BUYER, `SELECT count(*) FROM discovery.suppliers`)).startsWith('ERROR: permission denied'), 'signed-in users cannot read them either');
ok(String(await as('service', `SELECT count(*) FROM discovery.suppliers`)).startsWith('ERROR: permission denied'), 'the worker has no direct table access (functions only)');
ok(String(await as('anon', `SELECT public.discovery_worker_claim_job()`)).startsWith('ERROR: permission denied'), 'visitors cannot call worker functions');
ok(String(await as(BUYER, `SELECT public.discovery_worker_upsert_supplier('{}'::jsonb)`)).startsWith('ERROR: permission denied'), 'signed-in users cannot call worker functions');
ok(String(await as(BUYER, `SELECT public.admin_discovery_overview()`)).includes('admin_only'), 'non-admins get admin_only from admin functions');
ok(String(await as('anon', `SELECT public.admin_discovery_overview()`)).startsWith('ERROR: permission denied'), 'visitors cannot call admin functions');
ok(JSON.stringify(await as('anon', `SELECT public.directory_suppliers()`)) === JSON.stringify({ rows: [], total: 0 }), 'visitors can call the public directory (empty: no records exist)');

// ── jobs ──
ok((await worker('discovery_worker_claim_job')) === null, 'no queued job: the worker gets nothing');
ok(String(await admin(`SELECT public.admin_discovery_queue_job('search', '')`)).includes('query_required'), 'a search job needs a query');
ok(String(await admin(`SELECT public.admin_discovery_queue_job('seed_urls', NULL, NULL, NULL, ARRAY['not a url'])`)).includes('urls_required'), 'a URL job needs real http(s) addresses');
const job1 = await admin(`SELECT public.admin_discovery_queue_job('search', 'pp woven sacks manufacturer', 'Gujarat', 'packaging')`);
const claimed = await worker('discovery_worker_claim_job');
ok(claimed?.job?.id === job1 && claimed.job.status === 'running' && claimed.settings?.auto_publish === true, 'the worker claims the queued job with the publishing rules');

// ── supplier A: found, GST checked, products, published ──
const supA = (extra = {}) => ({ website_url: 'https://www.alpha.example/', source_url: 'https://www.alpha.example/contact', name_on_site: 'Alpha Polymers Pvt. Ltd.',
  gstin: G1, address: 'Plot 1, GIDC, Vapi, Gujarat 396195', city: 'Vapi', state: 'Gujarat', pincode: '396195', phones: ['+91 00000 00000'],
  emails: ['sales@alpha.example'], category_slugs: ['packaging'], found_via: 'search:brave', job_id: job1, evidence: { pages: ['https://www.alpha.example/contact'] }, ...extra });
let r = await worker('discovery_worker_upsert_supplier', J(supA()));
const A = r.id;
ok(r.created && r.verification_status === 'needs_review' && r.needs_gst_check === true && r.publish_status === 'internal', 'a new supplier waits for its GST check (needs review, not published)', JSON.stringify(r));
r = await worker('discovery_worker_record_gst', `'${A}', ${J({ gstin: G1, result: 'found', provider: 'gsp-test', gst_status: 'Active', legal_name: 'ALPHA POLYMERS PRIVATE LIMITED', trade_name: 'ALPHA POLYMERS', registered_pincode: '396195' })}`);
ok(r.verification_status === 'verified' && Number(r.name_score) === 1 && r.state_match === true, 'active GST + matching name + matching state = verified', JSON.stringify(r));
let s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.publish_status === 'internal', 'verified but no product yet: not published (minimum 1 product)');
r = await worker('discovery_worker_upsert_product', J({ supplier_id: A, name: 'PP Woven Sack 50 kg', source_url: 'https://www.alpha.example/products/pp-woven-sack',
  category_slug: 'packaging', specifications: { Size: '60 x 90 cm', Weight: '50 kg' }, description_source: 'Laminated sacks for cement and fertiliser.', price_text: null }));
const P1 = r.id;
await worker('discovery_worker_evaluate', `'${A}'`);
s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.publish_status === 'published' && s.published_products === 1, 'with a verified product from its own site, the supplier is published automatically', JSON.stringify(s.publish_status));
let dir = await as('anon', `SELECT public.directory_suppliers()`);
ok(dir.total === 1 && dir.rows[0].name === 'ALPHA POLYMERS' && dir.rows[0].sample_products[0] === 'PP Woven Sack 50 kg', 'the public directory lists it under its GST trade name');
const leak = JSON.stringify(await as('anon', `SELECT public.directory_supplier('${A}')`));
ok(!/alpha\.example|sales@|\+91|${G1}|source_url|Plot 1/.test(leak), 'public directory shows no phone, email, GSTIN, street address or source link', leak);
ok(/"image_url":null/.test(leak), 'product photos are not shown while "publish product images" is off');

// product from another website, same-name product at a second address, product duplicate source
r = await worker('discovery_worker_upsert_product', J({ supplier_id: A, name: 'BOPP Bag', source_url: 'https://shop.other.example/bopp' }));
await worker('discovery_worker_evaluate', `'${A}'`);
let pr = (await admin(`SELECT public.admin_discovery_products('needs_review')`)).rows.find((x) => x.name === 'BOPP Bag');
ok(pr && pr.verification_status === 'needs_review' && pr.publish_status === 'internal', 'a product page on another website is held for review, not published');
r = await worker('discovery_worker_upsert_product', J({ supplier_id: A, name: 'PP Woven Sack 50 KG', source_url: 'https://www.alpha.example/catalogue/sack-50' }));
ok(r.duplicate === true && r.id === P1, 'the same product at a second address is recorded as another source, not a second product');
ok((await admin(`SELECT public.admin_discovery_products('duplicates')`)).total >= 1, 'it shows in the Duplicates tab');
r = await worker('discovery_worker_upsert_product', J({ supplier_id: A, name: 'Something', source_url: 'https://www.alpha.example/products/pp-woven-sack' }));
ok(r.created === false && r.id === P1, 'the same product address updates the existing product');

// ── duplicates of suppliers ──
r = await worker('discovery_worker_upsert_supplier', J({ ...supA(), website_url: 'https://alpha-polymers.example', source_url: 'https://alpha-polymers.example/', pincode: '396191' }));
ok(r.duplicate_of === A && r.verification_status === 'rejected' && r.publish_status === 'internal', 'a second website with the same GSTIN is a duplicate, never published', JSON.stringify(r));
r = await worker('discovery_worker_upsert_supplier', J({ ...supA(), website_url: 'https://alphapolymers.example', source_url: 'https://alphapolymers.example/', gstin: null }));
ok(r.duplicate_of === A, 'same name and pincode without a GSTIN is also flagged as a duplicate', JSON.stringify(r));
ok((await admin(`SELECT public.admin_discovery_suppliers('duplicates')`)).total === 2, 'both show in the Duplicates tab');

// ── other outcomes ──
const mk = (host, name, gstin, state, pin) => ({ website_url: `https://${host}`, source_url: `https://${host}/about`, name_on_site: name, gstin, state, pincode: pin, city: 'City' });
r = await worker('discovery_worker_upsert_supplier', J(mk('beta.example', 'Beta Textiles', G2, 'Tamil Nadu', '641601')));
const B = r.id;
r = await worker('discovery_worker_record_gst', `'${B}', ${J({ gstin: G2, result: 'found', gst_status: 'Cancelled', legal_name: 'BETA TEXTILES' })}`);
ok(r.verification_status === 'rejected', 'a cancelled GST registration is rejected');
r = await worker('discovery_worker_upsert_supplier', J(mk('gamma.example', 'Gamma Engineering Works', G3, 'Maharashtra', '411001')));
const C = r.id;
r = await worker('discovery_worker_record_gst', `'${C}', ${J({ gstin: G3, result: 'found', gst_status: 'Active', legal_name: 'RAVI KUMAR', trade_name: 'GAMMA ENGG' })}`);
ok(r.verification_status === 'needs_review', 'active GST but a different name: held for review, not verified', JSON.stringify(r));
r = await worker('discovery_worker_upsert_supplier', J(mk('delta.example', 'Delta Pumps', G4, 'Gujarat', '380001')));
const D = r.id;
r = await worker('discovery_worker_record_gst', `'${D}', ${J({ gstin: G4, result: 'found', gst_status: 'Active', legal_name: 'DELTA PUMPS' })}`);
ok(r.verification_status === 'needs_review' && r.state_match === false, 'website address in another state than the GSTIN: held for review');
r = await worker('discovery_worker_upsert_supplier', J({ ...mk('eps.example', 'Epsilon Foods', BAD, 'Kerala', '682001') }));
ok(r.gstin === null && r.verification_status === 'needs_review', 'a GSTIN with a wrong check character is not stored; no GSTIN = needs review');
const E = r.id;
r = await worker('discovery_worker_upsert_supplier', J(mk('zeta.example', 'Zeta Chemicals', gst('24AAACZ5555Z1Z'), 'Gujarat', '396195')));
const Z = r.id;
r = await worker('discovery_worker_record_gst', `'${Z}', ${J({ gstin: gst('24AAACZ5555Z1Z'), result: 'not_configured' })}`);
ok(r.verification_status === 'needs_review', 'no GST provider configured: stays in review, never verified');
r = await worker('discovery_worker_record_gst', `'${Z}', ${J({ gstin: gst('24AAACA1111A1Z'), result: 'found', gst_status: 'Active' })}`);
ok(String(r).includes('gstin_mismatch'), 'a GST result for another GSTIN is refused');

// admin checks Gamma on the GST portal: trade name now matches
ok(String(await admin(`SELECT public.admin_discovery_supplier_action('${C}', 'gst_portal_check', '', '{"result":"found"}'::jsonb)`)).includes('note_required'), 'a portal check needs a note');
r = await admin(`SELECT public.admin_discovery_supplier_action('${C}', 'gst_portal_check', 'Checked services.gst.gov.in', ${J({ result: 'found', gst_status: 'Active', legal_name: 'GAMMA ENGINEERING WORKS LLP', trade_name: 'GAMMA ENGINEERING WORKS' })})`);
ok(r.verification_status === 'verified' && r.publish_status === 'internal', 'after an admin portal check that matches, Gamma is verified (not published: no products)', JSON.stringify(r));
ok(String(await admin(`SELECT public.admin_discovery_supplier_action('${B}', 'publish')`)).includes('only_verified_can_be_published'), 'an admin cannot publish an unverified supplier');
ok(String(await admin(`SELECT public.admin_discovery_supplier_action('${E}', 'publish')`)).includes('only_verified_can_be_published'), '...nor one without a GSTIN');

// ── rechecks ──
await run(`UPDATE discovery.suppliers SET next_recheck_at = now() - interval '1 minute' WHERE id = '${A}'`);
const due = await worker('discovery_worker_due_rechecks', '10');
ok(Array.isArray(due) && due.some((x) => x.id === A && x.gst_due === false && x.products.length >= 1), 'due rechecks list the supplier with its product pages');
r = await worker('discovery_worker_record_recheck', J({ entity: 'supplier', id: A, ok: false, gone: true, http_status: 404, url: 'https://www.alpha.example/contact' }));
ok(r.verification_status === 'suspended' && r.publish_status === 'internal', 'website gone (404): suspended and taken off the directory at once', JSON.stringify(r));
ok((await as('anon', `SELECT public.directory_suppliers()`)).total === 0, 'the directory no longer lists it');
r = await worker('discovery_worker_record_recheck', J({ entity: 'supplier', id: A, ok: true, http_status: 200 }));
ok(r.verification_status === 'verified' && r.publish_status === 'published', 'website back: verified and published again', JSON.stringify(r));
for (let i = 0; i < 2; i++) r = await worker('discovery_worker_record_recheck', J({ entity: 'supplier', id: A, ok: false, http_status: 503 }));
ok(r.verification_status === 'verified', 'two temporary failures (503) do not suspend');
r = await worker('discovery_worker_record_recheck', J({ entity: 'supplier', id: A, ok: false, http_status: 503 }));
ok(r.verification_status === 'suspended', 'the third failure in a row suspends');
await worker('discovery_worker_record_recheck', J({ entity: 'supplier', id: A, ok: true, http_status: 200 }));
r = await worker('discovery_worker_record_recheck', J({ entity: 'product', id: P1, ok: false, gone: true, http_status: 410 }));
ok(r.verification_status === 'suspended' && r.publish_status === 'internal', 'product page gone (410): product suspended and unpublished');
s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.publish_status === 'internal', 'with no verified product left, the supplier is unpublished too');
await worker('discovery_worker_record_recheck', J({ entity: 'product', id: P1, ok: true, http_status: 200 }));
s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.publish_status === 'published', 'product page back: both published again');
r = await worker('discovery_worker_record_gst', `'${A}', ${J({ gstin: G1, result: 'error', evidence: { error: 'timeout' } })}`);
ok(r.verification_status === 'verified', 'a GST provider error does not unverify a verified supplier');
r = await worker('discovery_worker_record_gst', `'${A}', ${J({ gstin: G1, result: 'found', gst_status: 'Suspended', legal_name: 'ALPHA POLYMERS PRIVATE LIMITED' })}`);
s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.verification_status === 'suspended' && s.publish_status === 'internal', 'GST later suspended: supplier suspended and unpublished');
await worker('discovery_worker_record_gst', `'${A}', ${J({ gstin: G1, result: 'found', gst_status: 'Active', legal_name: 'ALPHA POLYMERS PRIVATE LIMITED', trade_name: 'ALPHA POLYMERS' })}`);

// ── admin decisions ──
r = await admin(`SELECT public.admin_discovery_supplier_action('${A}', 'withhold', 'Waiting for photos')`);
ok(r.publish_status === 'withheld', 'withhold takes it off the directory');
await worker('discovery_worker_upsert_supplier', J(supA()));
s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.publish_status === 'withheld' && s.verification_status === 'verified', 'a later worker visit does not re-publish a withheld supplier');
r = await admin(`SELECT public.admin_discovery_supplier_action('${A}', 'publish')`);
ok(r.publish_status === 'published', 'an admin can publish a verified supplier again');
ok(String(await admin(`SELECT public.admin_discovery_supplier_action('${A}', 'reject', '')`)).includes('note_required'), 'rejecting needs a note');
r = await admin(`SELECT public.admin_discovery_supplier_action('${A}', 'reject', 'Trader, not a manufacturer')`);
ok(r.verification_status === 'rejected' && r.publish_status === 'internal', 'reject unpublishes');
await worker('discovery_worker_upsert_supplier', J(supA()));
await worker('discovery_worker_record_gst', `'${A}', ${J({ gstin: G1, result: 'found', gst_status: 'Active', legal_name: 'ALPHA POLYMERS PRIVATE LIMITED' })}`);
s = (await admin(`SELECT public.admin_discovery_supplier_detail('${A}')`)).supplier;
ok(s.verification_status === 'rejected', "an admin's rejection stands when the worker visits and the GST check passes again");
r = await admin(`SELECT public.admin_discovery_supplier_action('${A}', 'restore', 'Re-reviewed')`);
ok(r.verification_status === 'verified' && r.publish_status === 'published', 'restore applies the rules again (verified and published)', JSON.stringify(r));

// settings
await admin(`SELECT public.admin_discovery_update_settings('{"auto_publish": false}'::jsonb)`);
r = await worker('discovery_worker_upsert_product', J({ supplier_id: C, name: 'CNC Turned Part', source_url: 'https://gamma.example/products/cnc' }));
r = await worker('discovery_worker_evaluate', `'${C}'`);
ok(r.verification_status === 'verified' && r.publish_status === 'internal', 'with automatic publishing off, a verified supplier waits for an admin');
r = await admin(`SELECT public.admin_discovery_supplier_action('${C}', 'publish')`);
ok(r.publish_status === 'published', '...who can publish it');
await admin(`SELECT public.admin_discovery_update_settings('{"auto_publish": true}'::jsonb)`);

// removal request
r = await admin(`SELECT public.admin_discovery_supplier_action('${C}', 'suppress', 'Owner asked by email to be removed')`);
ok(r.verification_status === 'rejected' && r.publish_status === 'withheld', 'a removal request takes the company off at once');
r = await worker('discovery_worker_upsert_supplier', J(mk('gamma.example', 'Gamma Engineering Works', G3, 'Maharashtra', '411001')));
ok(r.skipped === 'suppressed', 'and it is never collected again');
const cd = (await admin(`SELECT public.admin_discovery_supplier_detail('${C}')`)).supplier;
ok(cd.public_phones.length === 0 && cd.public_emails.length === 0, 'its stored contacts are cleared');

// jobs end, stale jobs
await worker('discovery_worker_finish_job', `'${job1}', 'done', '{"suppliers_found": 3, "source_type": "brave"}'::jsonb`);
let jobs = await admin(`SELECT public.admin_discovery_jobs()`);
ok(jobs[0].status === 'done' && jobs[0].source_type === 'brave', 'a finished job keeps its stats and the search provider');
const job2 = await admin(`SELECT public.admin_discovery_queue_job('seed_urls', NULL, NULL, NULL, ARRAY['https://alpha.example'])`);
await worker('discovery_worker_claim_job');
await run(`UPDATE discovery.discovery_jobs SET started_at = now() - interval '4 hours' WHERE id = '${job2}'`);
r = await worker('discovery_worker_claim_job');
ok(r?.job?.id === job2 && r.job.attempts === 2, 'a job stuck for 3 hours is put back and tried again');
await run(`UPDATE discovery.discovery_jobs SET started_at = now() - interval '4 hours', attempts = 3 WHERE id = '${job2}'`);
await worker('discovery_worker_claim_job');
jobs = await admin(`SELECT public.admin_discovery_jobs()`);
ok(jobs.find((j) => j.id === job2).status === 'failed', 'after 3 tries it is marked failed');
await worker('discovery_worker_log_error', `'${job1}', 'https://broken.example', 'connect ETIMEDOUT'`);
const fails = await admin(`SELECT public.admin_discovery_logs('failures')`);
ok(fails.some((l) => l.action === 'fetch_failed') && fails.some((l) => l.action === 'recheck_failed') && fails.some((l) => l.action === 'job_failed'), 'failures list fetch errors, failed rechecks and failed jobs');

const ov = await admin(`SELECT public.admin_discovery_overview()`);
ok(ov.suppliers.verified >= 1 && ov.suppliers.duplicates === 2 && ov.suppliers.rejected >= 2 && ov.products.total >= 3, 'the overview counts every tab', JSON.stringify(ov.suppliers));
ok((await q(`SELECT count(*)::int n FROM discovery.suppliers WHERE publish_status = 'published' AND verification_status <> 'verified'`))[0].n === 0, 'no record is ever published without being verified');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
