/**
 * Tests for the BulkSkart Claude Code skills' helper scripts.
 *
 *   cd docs/claude-skills/tests
 *   npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
 *   node run.mjs
 *
 * Builds demo SQL from the fixtures in a temporary folder, loads it into an in-memory Postgres (PGlite) whose
 * tables and triggers mirror production's, and checks the labels, the paused notification triggers, re-runs,
 * unknown categories and cleanup. It also runs the website's own demo filter (src/lib/seedData.ts) on the rows and
 * checks the demo feed checker. Nothing touches a real database.
 */
import { PGlite } from '@electric-sql/pglite';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const HELPER = path.join(repo, '.claude/skills/product-listing/scripts/demo_sql.mjs');
const FEED = path.join(repo, '.claude/skills/marketplace-content/scripts/check_feed.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkskart-skills-'));
let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) failed++;
};
const run = (args) => spawnSync(process.execPath, args, { encoding: 'utf8' });
const stage = (fixture) => {
  const dir = path.join(tmp, path.basename(fixture, '.json'));
  fs.mkdirSync(dir);
  fs.copyFileSync(path.join(here, 'fixtures', fixture), path.join(dir, 'data.json'));
  return dir;
};

// ── helper: validation and files ────────────────────────────────────────────
const good = stage('demo-good.json');
ok(run([HELPER, good, '--check']).status === 0, 'helper --check accepts the good fixture');
const built = run([HELPER, good]);
ok(built.status === 0 && ['insert.sql', 'cleanup.sql', 'summary.json'].every((f) => fs.existsSync(path.join(good, f))), 'helper writes insert.sql, cleanup.sql and summary.json');
const again = run([HELPER, good]);
ok(again.status === 1 && /Not overwriting/.test(again.stderr), 'helper refuses to overwrite its own files');
const bad = run([HELPER, stage('demo-bad.json')]);
const expected = ['is_verified', 'gst_number', 'legal suffix', 'real brand', 'email address', 'phone number', 'ISO 9001', 'real companies', 'price_min is above', 'BulkSkart storage', 'moq', 'Best selling', 'quote_count', 'before the day', 'category slug', 'quantity', 'Order placed'];
ok(bad.status === 1 && expected.every((e) => bad.stderr.includes(e)), `helper rejects every bad row (${expected.length} kinds of problem)`);
const badcat = stage('demo-unknown-category.json');
ok(run([HELPER, badcat]).status === 0, 'unknown slug passes the helper (only the database knows the categories)');

// ── database ────────────────────────────────────────────────────────────────
const db = new PGlite();
await db.exec(`
CREATE TYPE user_role AS ENUM ('buyer','supplier','admin');
CREATE TYPE verification_status AS ENUM ('unverified','pending','verified','rejected');
CREATE TYPE rfq_status AS ENUM ('active','closed','expired');
CREATE TABLE profiles (id uuid PRIMARY KEY, role user_role NOT NULL, status text DEFAULT 'active');
CREATE TABLE categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, parent_id uuid);
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES profiles(id), company_name text NOT NULL, slug text UNIQUE NOT NULL,
  description text, tagline text, business_type text, city text, state text, country text NOT NULL DEFAULT 'India', pincode text, year_established int, years_in_business int,
  employee_count_range text, annual_turnover_range text, export_destinations text[], key_products text[], payment_terms text[], production_capacity text, moq_policy text,
  packaging_details text, logo_url text, cover_url text, verification_status verification_status NOT NULL DEFAULT 'unverified', is_verified boolean DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false, rating_avg numeric DEFAULT 0, review_count int DEFAULT 0, total_quotes_sent int NOT NULL DEFAULT 0, total_products int NOT NULL DEFAULT 0, gst_number text);
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE, category_id uuid REFERENCES categories(id),
  name text NOT NULL, slug text UNIQUE NOT NULL, description text, specifications text, moq int NOT NULL DEFAULT 1, moq_unit text DEFAULT 'pcs', price_min numeric(12,2), price_max numeric(12,2),
  price_currency text DEFAULT 'INR', images text[] DEFAULT '{}', tags text[], export_destinations text[], is_active boolean DEFAULT true, is_featured boolean DEFAULT false, view_count int DEFAULT 0);
CREATE TABLE requirements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), req_number text UNIQUE, buyer_id uuid REFERENCES profiles(id), category_id uuid REFERENCES categories(id), title text NOT NULL,
  description text, specifications text, quantity integer, quantity_unit text DEFAULT 'pcs', destination_country text, destination_city text, deadline date, budget_min numeric(12,2),
  budget_max numeric(12,2), currency text NOT NULL DEFAULT 'INR', status rfq_status NOT NULL DEFAULT 'active', quote_count int NOT NULL DEFAULT 0, view_count int NOT NULL DEFAULT 0,
  is_verified_buyer boolean NOT NULL DEFAULT false, is_urgent boolean NOT NULL DEFAULT false, deal_status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, source_type text NOT NULL DEFAULT 'bulkskart' CHECK (source_type IN ('bulkskart','public_listing')), review_status text,
  CONSTRAINT requirements_bulkskart_rfq_complete CHECK (source_type <> 'bulkskart' OR (buyer_id IS NOT NULL AND quantity IS NOT NULL AND quantity_unit IS NOT NULL)));
-- stand-ins for production's notification triggers (00011, 00026): same names, but they only log
CREATE TABLE fired (tbl text);
CREATE FUNCTION log_fired() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO fired VALUES (TG_TABLE_NAME); RETURN NEW; END $$;
CREATE TRIGGER trg_match_on_new_manufacturer AFTER INSERT ON companies FOR EACH ROW EXECUTE FUNCTION log_fired();
CREATE TRIGGER trg_notify_followers AFTER INSERT ON products FOR EACH ROW EXECUTE FUNCTION log_fired();
CREATE TRIGGER trg_rfq_matching_on_new_req AFTER INSERT ON requirements FOR EACH ROW EXECUTE FUNCTION log_fired();
CREATE SEQUENCE req_number_seq START 1000;
CREATE FUNCTION generate_req_number() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.req_number := 'RFQ-' || nextval('req_number_seq'); RETURN NEW; END $$;
CREATE TRIGGER trg_req_number BEFORE INSERT ON requirements FOR EACH ROW EXECUTE FUNCTION generate_req_number();
INSERT INTO profiles VALUES ('00000000-0000-0000-0000-000000000001','supplier'), ('00000000-0000-0000-0000-000000000002','buyer'), ('11111111-1111-1111-1111-111111111111','supplier');
INSERT INTO categories (slug) VALUES ('textiles-apparel'),('construction-building'),('machinery-industrial'),('agriculture-food');
INSERT INTO companies (id, owner_id, company_name, slug) VALUES ('e1000001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Old Demo Pumps','old-demo-pumps'),
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Real Factory','real-factory');
INSERT INTO products (company_id, name, slug) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Real product','real-product'), ('e1000001-0000-0000-0000-000000000003','Old demo product','old-demo-product');
INSERT INTO requirements (buyer_id, title, quantity) VALUES ('00000000-0000-0000-0000-000000000002','Older demo - Lot #50001', 10);
DELETE FROM fired;`);
const one = async (sql) => (await db.query(sql)).rows[0];
const insert = fs.readFileSync(path.join(good, 'insert.sql'), 'utf8');
await db.exec(insert);
ok((await one('SELECT count(*)::int n FROM fired')).n === 0, 'no notification trigger fired during the load');
const c = (await db.query(`SELECT * FROM companies WHERE id::text LIKE 'e1000001-0000-0000-0000-dd0901%'`)).rows;
ok(c.length === 2 && c.every((r) => r.owner_id === '00000000-0000-0000-0000-000000000001' && r.verification_status === 'unverified' && !r.is_verified && !r.is_featured && Number(r.rating_avg) === 0 && r.review_count === 0 && r.gst_number === null),
  'demo companies: demo owner, unverified, not featured, no rating or reviews, no GSTIN');
ok(c.every((r) => / \(Demo\)$/.test(r.company_name) && r.slug.startsWith('demo-') && r.description.startsWith('DEMO LISTING:')), 'demo companies are labelled (Demo) / demo- / DEMO LISTING');
const p = (await db.query(`SELECT p.*, k.slug cat FROM products p LEFT JOIN categories k ON k.id = p.category_id WHERE p.slug LIKE 'demo-%-b901-%'`)).rows;
ok(p.length === 3 && p.every((r) => r.cat && / \(Demo\)$/.test(r.name) && r.tags.includes('demo') && r.description.startsWith('DEMO LISTING:') && !r.is_featured), 'demo products: category found, labelled, tagged demo, not featured');
ok(JSON.parse(p.find((r) => r.name.startsWith('Cotton')).specifications).GSM === '180 ± 5', 'specifications are a JSON object string, as ProductDetailPage reads them');
const rq = (await db.query(`SELECT * FROM requirements WHERE title LIKE '% - Lot #9901_____'`)).rows;
ok(rq.length === 2 && rq.every((r) => r.buyer_id === '00000000-0000-0000-0000-000000000002' && !r.is_verified_buyer && r.quote_count === 0 && r.req_number && r.source_type === 'bulkskart'),
  'demo requirements: demo buyer, not a verified buyer, no quotes, req_number assigned');
await db.exec(`INSERT INTO requirements (buyer_id, title, quantity) VALUES ('00000000-0000-0000-0000-000000000002','after', 1)`);
ok((await one('SELECT count(*)::int n FROM fired')).n === 1, 'notification triggers are on again after the load');
let err = '';
try { await db.exec(insert); } catch (e) { err = e.message; await db.exec('ROLLBACK'); }
ok(/already loaded/.test(err), 'loading the same batch twice stops with "already loaded"');
err = '';
try { await db.exec(fs.readFileSync(path.join(badcat, 'insert.sql'), 'utf8')); } catch (e) { err = e.message; await db.exec('ROLLBACK'); }
ok(/Unknown category slugs/.test(err), 'an unknown category slug stops the load');
const cleanup = fs.readFileSync(path.join(good, 'cleanup.sql'), 'utf8');
await db.exec(cleanup);
await db.exec(cleanup);
const left = await one(`SELECT (SELECT count(*)::int FROM companies WHERE id::text LIKE 'e1000001-0000-0000-0000-dd0901%') + (SELECT count(*)::int FROM products WHERE slug LIKE 'demo-%-b901-%')
  + (SELECT count(*)::int FROM requirements WHERE title LIKE '% - Lot #9901_____') batch, (SELECT count(*)::int FROM products) + (SELECT count(*)::int FROM companies) + (SELECT count(*)::int FROM requirements) other`);
ok(left.batch === 0 && left.other === 2 + 2 + 2, 'cleanup.sql removes only the batch, and can run twice');

// ── the website's own demo filter ────────────────────────────────────────────
const seedTs = path.join(tmp, 'seedData.ts');
fs.writeFileSync(seedTs, fs.readFileSync(path.join(repo, 'src/lib/seedData.ts'), 'utf8').replace('import.meta.env.VITE_INCLUDE_TEMPLATE_SEED_DATA', "'false'"));
const rows = { companies: c.map(({ id, owner_id }) => ({ id, owner_id })), requirements: rq.map(({ title, description }) => ({ title, description })) };
const probe = path.join(tmp, 'probe.mjs');
fs.writeFileSync(probe, `import { isSeededCompany, isSeededRequirement } from ${JSON.stringify(seedTs)};
const rows = ${JSON.stringify(rows)};
console.log(JSON.stringify({ c: rows.companies.every(isSeededCompany), r: rows.requirements.every(isSeededRequirement), real: isSeededRequirement({ title: 'Cotton T-shirts', description: 'Need 5000 pcs' }) }));`);
const site = run(['--experimental-strip-types', '--no-warnings', probe]);
const s = site.status === 0 ? JSON.parse(site.stdout) : {};
ok(s.c === true && s.r === true && s.real === false, "the site's isSeededCompany / isSeededRequirement hide every demo row, and not a real one");

// ── demo feed checker ────────────────────────────────────────────────────────
ok(run([FEED, path.join(here, 'fixtures/feed-good.json')]).status === 0, 'feed checker accepts labelled demo posts');
const fb = run([FEED, path.join(here, 'fixtures/feed-bad.json')]);
ok(fb.status === 1 && ['is_demo', '(Demo)', 'ISO 9001', 'superlative', 'completed order', 'real brand', 'platform statistic', 'phone number', 'not a bulkskart.com page'].every((e) => fb.stderr.includes(e)),
  'feed checker rejects unlabelled posts, claims, superlatives, shipments, brands, statistics, phones and outside links');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
