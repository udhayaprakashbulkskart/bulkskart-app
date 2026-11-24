/**
 * Runs supabase/migrations/00073_remove_gem_listings.sql against an in-memory Postgres (PGlite) holding tables shaped
 * like production's, with GeM rows and real rows side by side, and checks that only the GeM rows go.
 *
 *   cd docs/gem-removal
 *   npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
 *   node remove_gem_check.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, '../../supabase/migrations/00073_remove_gem_listings.sql'), 'utf8');
let failed = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };

const GEM_BUYER = '5e8d0a1c-0000-4000-8000-67656d666565';
const REAL_BUYER = '11111111-1111-1111-1111-111111111111';
const SELLER = '22222222-2222-2222-2222-222222222222';
const R = (n) => `aaaaaaaa-0000-0000-0000-00000000000${n}`;
const A = (n) => `bbbbbbbb-0000-0000-0000-00000000000${n}`;

const schema = `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TYPE user_role AS ENUM ('buyer','supplier','admin');
CREATE TABLE profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, role user_role, full_name text);
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE, company_name text);
CREATE TABLE requirements (id uuid PRIMARY KEY, buyer_id uuid REFERENCES profiles(id), title text, description text, specifications text, req_number text);
CREATE TABLE auctions (id uuid PRIMARY KEY, auction_number text UNIQUE, seller_id uuid REFERENCES profiles(id), seller_company_id uuid REFERENCES companies(id),
  title text, description text, specifications jsonb DEFAULT '{}'::jsonb);
CREATE TABLE quotations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE);
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid REFERENCES requirements(id), note text);
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid REFERENCES requirements(id), amount numeric);
CREATE TABLE rfq_lead_views (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL REFERENCES requirements(id));
CREATE TABLE auction_bids (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE);
CREATE TABLE auction_fee_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auction_id uuid REFERENCES auctions(id) ON DELETE SET NULL);
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES profiles(id) ON DELETE CASCADE, link text, reference_id uuid);
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid bigint PRIMARY KEY, jobname text, command text);
CREATE FUNCTION cron.unschedule(job_id bigint) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid = job_id RETURNING true $$;

INSERT INTO auth.users VALUES ('${GEM_BUYER}', 'gem@placeholder'), ('${REAL_BUYER}', 'buyer@x'), ('${SELLER}', 'seller@x');
INSERT INTO profiles VALUES ('${GEM_BUYER}', 'buyer', 'GeM Public Procurement (government buyers)'), ('${REAL_BUYER}', 'buyer', 'Real buyer'), ('${SELLER}', 'supplier', 'Real seller');
INSERT INTO companies (id, owner_id, company_name) VALUES ('cccccccc-0000-0000-0000-000000000001', '${SELLER}', 'Real Co');
INSERT INTO requirements VALUES
  ('${R(1)}', '${GEM_BUYER}', 'All Terrain Vehicle (MHA)', 'Government buyer requirement published on GeM (Government e-Marketplace). Bid GEM/2026/B/8283895.', NULL, 'RFQ-1001'),
  ('${R(2)}', '${GEM_BUYER}', 'Office chairs', 'Government buyer requirement published on GeM (Government e-Marketplace). Bid GEM/2026/B/1.', '{"source_url":"https://bidplus.gem.gov.in/x"}', 'RFQ-1002'),
  ('${R(3)}', '${GEM_BUYER}', 'LED lights', 'Government buyer requirement published on GeM (Government e-Marketplace).', NULL, 'RFQ-1003'),
  ('${R(4)}', '${REAL_BUYER}', 'Steel chairs', 'Need chairs as per GeM specification, 500 pcs', NULL, 'RFQ-1004'),
  ('${R(5)}', '${REAL_BUYER}', 'Cotton T-shirts', '5000 pcs to Chennai', 'GSM: 180', 'RFQ-1005'),
  ('${R(6)}', '${REAL_BUYER}', 'Loose gem stones', 'Precious gem stones, 2 kg', NULL, 'RFQ-1006');
INSERT INTO auctions VALUES
  ('${A(1)}', 'GEM-FA-1', NULL, NULL, 'Scrap lot', 'Forward auction on GeM', '{"external_listing": true, "source": "GeM", "source_url": "https://forwardauction.gem.gov.in/a/1", "source_auction_id": "1"}'),
  ('${A(2)}', 'GEM-FA-2', NULL, NULL, 'Old vehicles', NULL, '{"external_listing": "true", "seller_org": "Org", "reference_no": "R-2"}'),
  ('${A(3)}', 'GEM-FA-3', NULL, NULL, 'Furniture', 'See https://bidplus.gem.gov.in/all-bids/GEM/2026/B/3', '{}'),
  ('${A(4)}', 'AUC-0004', '${SELLER}', 'cccccccc-0000-0000-0000-000000000001', 'Steel coils', 'Also sold on GeM earlier', '{"Grade":"IS 2062"}'),
  ('${A(5)}', 'AUC-0005', '${SELLER}', 'cccccccc-0000-0000-0000-000000000001', 'Gem stones lot', 'Ruby gem stones', '{"Stone":"ruby"}'),
  ('${A(6)}', 'AUC-0006', NULL, NULL, 'Unsold stock', 'Plain lot with no seller yet', '{"Grade":"A"}');
INSERT INTO quotations (requirement_id) VALUES ('${R(1)}'), ('${R(5)}');
INSERT INTO conversations (requirement_id, note) VALUES ('${R(2)}', 'chat about a GeM tender'), ('${R(5)}', 'real chat');
INSERT INTO orders (requirement_id, amount) VALUES ('${R(3)}', 100), ('${R(5)}', 200);
INSERT INTO rfq_lead_views (requirement_id) VALUES ('${R(1)}'), ('${R(5)}');
INSERT INTO auction_bids (auction_id) VALUES ('${A(1)}'), ('${A(4)}');
INSERT INTO auction_fee_payments (auction_id) VALUES ('${A(2)}');
INSERT INTO notifications (user_id, link, reference_id) VALUES
  ('${REAL_BUYER}', '/requirements/${R(5)}', NULL),
  ('${SELLER}', '/dashboard/supplier/rfqs?req=${R(1).toUpperCase()}', NULL),
  ('${SELLER}', NULL, '${R(2)}'),
  ('${SELLER}', '/auctions/GEM-FA-2', NULL),
  ('${SELLER}', '/auctions/AUC-0004', NULL),
  ('${GEM_BUYER}', '/requirements/${R(3)}', NULL);
INSERT INTO cron.job VALUES (1, 'gem-import', 'select net.http_post(''https://x/functions/v1/gem-sync'')'), (2, 'nightly-cleanup', 'delete from supplier_map_changes'),
  (3, 'pull-bids', 'select fetch(''https://bidplus.gem.gov.in/'')');
`;

const db = new PGlite();
await db.exec(schema);
const one = async (sql) => (await db.query(sql)).rows[0];
const ids = async (table) => (await db.query(`SELECT id::text FROM ${table} ORDER BY id`)).rows.map((r) => r.id);

const notices = [];
const res = await db.exec(migration, { onNotice: (n) => notices.push(n.message) });
const check = res.at(-2)?.rows?.[0] ?? res.find((r) => r.rows?.[0]?.result)?.rows[0];
ok(check && Number(check.gem_auctions_left) === 0 && Number(check.gem_requirements_left) === 0 && Number(check.gem_account_left) === 0, `the final check reports 0 GeM auctions, requirements and accounts left (${JSON.stringify(check)})`);
ok(JSON.stringify(await ids('requirements')) === JSON.stringify([R(4), R(5), R(6)]), 'requirements: the 3 GeM ones are gone; a real buyer\'s RFQ that mentions GeM, a normal one and "gem stones" stay');
ok(JSON.stringify(await ids('auctions')) === JSON.stringify([A(4), A(5), A(6)]), 'auctions: the 3 GeM lots are gone; a seller\'s lot that mentions GeM, a "gem stones" lot and a plain lot stay');
ok((await one(`SELECT count(*)::int n FROM quotations`)).n === 1 && (await one(`SELECT count(*)::int n FROM auction_bids`)).n === 1, 'quotations and bids on GeM rows went with them (cascade); the real ones stay');
ok((await one(`SELECT count(*)::int n FROM conversations WHERE requirement_id IS NULL AND note = 'chat about a GeM tender'`)).n === 1 && (await one(`SELECT count(*)::int n FROM conversations`)).n === 2, 'a conversation about a GeM tender is kept, with its link cleared');
ok((await one(`SELECT count(*)::int n FROM orders WHERE requirement_id IS NULL`)).n === 1 && (await one(`SELECT count(*)::int n FROM orders`)).n === 2, 'orders are never deleted; the GeM link is cleared');
ok((await one(`SELECT count(*)::int n FROM rfq_lead_views`)).n === 1, 'the lead view of a GeM requirement is removed, the real one stays');
ok((await one(`SELECT count(*)::int n FROM auction_fee_payments WHERE auction_id IS NULL`)).n === 1, 'a fee payment row on a GeM lot stays, its link set to NULL');
const links = (await db.query(`SELECT coalesce(link, reference_id::text) l FROM notifications ORDER BY l`)).rows.map((r) => r.l);
ok(JSON.stringify(links) === JSON.stringify(['/auctions/AUC-0004', `/requirements/${R(5)}`]), `notifications about GeM rows are removed (by id, upper-case id, reference_id and auction number); real ones stay: ${links.join(', ')}`);
ok((await one(`SELECT count(*)::int n FROM auth.users WHERE id = '${GEM_BUYER}'`)).n === 0 && (await one(`SELECT count(*)::int n FROM profiles`)).n === 2, 'the placeholder GeM account is removed; the real accounts stay');
ok(JSON.stringify((await db.query(`SELECT jobname FROM cron.job ORDER BY jobid`)).rows.map((r) => r.jobname)) === JSON.stringify(['nightly-cleanup']), 'the GeM import cron jobs are unscheduled, the other job stays');
ok(notices.some((n) => /Kept 1 other requirement/.test(n)), `it reports the real RFQ that mentions GeM instead of deleting it ("${notices.find((n) => /Kept/.test(n))}")`);

const again = await db.exec(migration);
const check2 = again.find((r) => r.rows?.[0]?.result)?.rows[0];
ok(check2 && Number(check2.gem_auctions_left) === 0 && Number(check2.auctions_kept) === 3 && (await ids('requirements')).length === 3, 'running it a second time changes nothing');

// a table the migration does not know about, NOT NULL reference: it must stop and change nothing
const db2 = new PGlite();
await db2.exec(schema);
await db2.exec(`CREATE TABLE tender_documents (id serial PRIMARY KEY, requirement_id uuid NOT NULL REFERENCES requirements(id)); INSERT INTO tender_documents (requirement_id) VALUES ('${R(1)}');`);
let err = '';
try { await db2.exec(migration); } catch (e) { err = e.message; await db2.exec('ROLLBACK'); }
ok(/Stopped: 1 row\(s\) in tender_documents\.requirement_id/.test(err), `an unknown table that refers to a GeM row stops it: "${err}"`);
ok((await db2.query('SELECT count(*)::int n FROM requirements')).rows[0].n === 6 && (await db2.query('SELECT count(*)::int n FROM auctions')).rows[0].n === 6 && (await db2.query('SELECT count(*)::int n FROM cron.job')).rows[0].n === 3, '...and nothing was changed');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
