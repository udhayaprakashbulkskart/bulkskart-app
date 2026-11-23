import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
await run(`
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TABLE profiles (id uuid PRIMARY KEY, email text, full_name text, role user_role NOT NULL DEFAULT 'buyer', status account_status NOT NULL DEFAULT 'active');
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES profiles(id), company_name text NOT NULL, slug text UNIQUE NOT NULL,
  description text, business_type text, trade_type text, city text, state text, logo_url text, cover_url text, banner_url text,
  verification_status verification_status NOT NULL DEFAULT 'unverified', verified_at timestamptz, verified_by uuid, verification_expiry_at timestamptz,
  rejection_reason text, is_verified boolean DEFAULT false, is_blocked boolean NOT NULL DEFAULT false, rating_avg numeric(3,2) DEFAULT 0, review_count integer DEFAULT 0,
  key_products text[] DEFAULT '{}', gallery_images text[] DEFAULT '{}', production_capacity text, year_established integer, created_at timestamptz DEFAULT now());
CREATE TABLE categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text, parent_id uuid);
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id), category_id uuid REFERENCES categories(id), name text NOT NULL,
  slug text, moq integer NOT NULL DEFAULT 1, moq_unit text DEFAULT 'pcs', price_min numeric, price_max numeric, price_currency text DEFAULT 'INR', images text[], tags text[],
  is_active boolean NOT NULL DEFAULT true, updated_at timestamptz DEFAULT now());
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION owns_company(c uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS (SELECT 1 FROM companies WHERE id = c AND owner_id = auth.uid()) $$;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_select ON companies FOR SELECT USING (true);
CREATE POLICY companies_update_own ON companies FOR UPDATE USING (owns_company(id) OR is_admin());
CREATE POLICY companies_insert_own ON companies FOR INSERT WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- what Supabase does for every new table and function
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`);
const mig = readFileSync(new URL('../../../supabase/migrations/00071_supplier_map.sql', import.meta.url), 'utf8');
// OLD_MIGRATION=<file>: run an earlier copy of 00071 first, to check the upgrade path
if (process.env.OLD_MIGRATION) await run(readFileSync(process.env.OLD_MIGRATION, 'utf8'));
await run(mig); await run(mig); // safe to run twice
const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const C = (n) => `c0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const DEMO_OWNER = '00000000-0000-0000-0000-000000000001';
await run(`
INSERT INTO profiles VALUES ('${DEMO_OWNER}', 'demo@x', 'Demo', 'supplier', 'active'), ('${U(90)}', 'admin@x', 'Admin', 'admin', 'active'), ('${U(91)}', 'buyer@x', 'Buyer', 'buyer', 'active'), ('${U(92)}', 'new@x', 'New', 'supplier', 'active');
INSERT INTO categories (id, name, slug) VALUES ('${C(99)}', 'Textiles', 'textiles');
`);
// companies: 10 Tiruppur verified; 11 pending; 12 rejected; 13 suspended; 14 blocked; 15 location pending; 16 owner suspended; 17 no products; 18 Mumbai verified; 19 demo
const cities = { 10: [11.1085, 77.3411], 11: [11.11, 77.34], 12: [11.12, 77.35], 13: [11.13, 77.36], 14: [11.10, 77.33], 15: [11.09, 77.32], 16: [11.14, 77.37], 17: [11.15, 77.38], 18: [19.076, 72.8777], 19: [11.1, 77.3] };
for (const n of Object.keys(cities).map(Number)) {
  const owner = n === 19 ? DEMO_OWNER : U(n);
  if (n !== 19) await run(`INSERT INTO profiles VALUES ('${owner}', 'm${n}@x', 'Maker ${n}', 'supplier', '${n === 16 ? 'suspended' : 'active'}')`);
  await run(`INSERT INTO companies (id, owner_id, company_name, slug, city, key_products) VALUES ('${C(n)}', '${owner}', 'Company ${n}', 'company-${n}', 'City', '{knitted fabric}')`);
  if (n !== 17) await run(`INSERT INTO products (company_id, category_id, name, slug, moq, images) VALUES ('${C(n)}', '${C(99)}', 'Cotton T-Shirt ${n}', 'p-${n}', ${n * 10}, '{img${n}.jpg}')`);
}
const r = {};
const as = async (uid, label, sql) => {
  await run(uid ? `SET ROLE authenticated; SELECT set_config('app.uid', '${uid}', false);` : `SET ROLE anon; SELECT set_config('app.uid', '', false);`);
  try { const rows = await q(sql); r[label] = rows.length === 1 && Object.keys(rows[0]).length === 1 ? Object.values(rows[0])[0] : rows.length ? rows : 'ok (0 rows)'; }
  catch (e) { r[label] = 'ERROR: ' + String(e.message).slice(0, 70); }
  await run(`RESET ROLE; SELECT set_config('app.uid', '', false);`);
};
const docs = (n) => `[{"kind":"gst","path":"${U(n)}/gst.pdf","name":"gst.pdf"}]`;
const apply = (n, extra = {}) => JSON.stringify({ entity_type: 'proprietorship', legal_name: `Company ${n}`, gstin: '33AAAAA0000A1Z5', registered_address: 'Addr', factory_address: 'Factory',
  contact_name: 'Owner', contact_phone: '9000000000', contact_email: `m${n}@x`, documents: JSON.parse(docs(n)), ...extra });

// ── attacks first ──
await as(U(10), 'owner self-verifies company', `UPDATE companies SET verification_status = 'verified', verified_at = now() WHERE id = '${C(10)}' RETURNING verification_status::text`);
await as(U(10), 'owner inserts approved application directly', `INSERT INTO business_verifications (company_id, entity_type, legal_name, registered_address, factory_address, contact_name, contact_phone, contact_email, status) VALUES ('${C(10)}', 'other', 'x', 'x', 'x', 'x', 'x', 'x', 'approved')`);
await as(U(10), 'owner submits GST-only Pvt Ltd', `SELECT supplier_submit_business_verification('${apply(10, { entity_type: 'private_limited' })}'::jsonb)`);
await as(U(10), 'owner submits docs from another user folder', `SELECT supplier_submit_business_verification('${apply(10, { documents: [{ kind: 'gst', path: U(11) + '/x.pdf' }] })}'::jsonb)`);
await as(U(10), 'owner submits bad GSTIN', `SELECT supplier_submit_business_verification('${apply(10, { gstin: 'ABC' })}'::jsonb)`);

// ── everyone applies and pins a location ──
for (const n of Object.keys(cities).map(Number)) {
  const uid = n === 19 ? DEMO_OWNER : U(n);
  const payload = n === 19 ? apply(n).replace(`${U(19)}/`, `${DEMO_OWNER}/`) : apply(n);
  await as(uid, `apply ${n}`, `SELECT supplier_submit_business_verification('${payload}'::jsonb)`);
  await as(uid, `pin ${n}`, `SELECT supplier_save_factory_location(${cities[n][0]}, ${cities[n][1]}, 'Plot ${n}', 'City', 'State', 'India', '641601')`);
}
await as(U(10), 'company status after applying', `SELECT verification_status::text FROM companies WHERE id = '${C(10)}'`);
await as(U(91), 'buyer calls admin decide', `SELECT admin_decide_business_verification('${C(10)}', 'approve', null, true, null, null)`);
await as(U(91), 'buyer lists applications', `SELECT count(*) FROM admin_list_business_verifications('all')`);
await as(U(10), 'owner verifies own location', `SELECT admin_decide_factory_location('${C(10)}', 'verify', null)`);
await as(U(10), 'owner updates location row directly', `UPDATE factory_locations SET status = 'verified' WHERE company_id = '${C(10)}' RETURNING status`);
await as(U(90), 'admin approves without checking registration', `SELECT admin_decide_business_verification('${C(10)}', 'approve', null, null, null, null)`);

// ── admin decisions ──
for (const n of [10, 12, 13, 14, 15, 16, 17, 18, 19]) await as(U(90), `admin approves ${n}`, `SELECT admin_decide_business_verification('${C(n)}', 'approve', 'GST checked on portal', true, null, null)`);
for (const n of [10, 11, 12, 13, 14, 16, 17, 18, 19]) await as(U(90), `admin verifies location ${n}`, `SELECT admin_decide_factory_location('${C(n)}', 'verify', null)`);
await as(U(90), 'admin rejects 12 without note', `SELECT admin_decide_business_verification('${C(12)}', 'reject', null, null, null, null)`);
await as(U(90), 'admin rejects 12', `SELECT admin_decide_business_verification('${C(12)}', 'reject', 'GSTIN cancelled on portal', null, null, null)`);
await as(U(90), 'admin suspends 13', `SELECT admin_decide_business_verification('${C(13)}', 'suspend', 'Complaints under review', null, null, null)`);
await run(`UPDATE companies SET is_blocked = true WHERE id = '${C(14)}'`);
await as(U(13), 'suspended company re-applies', `SELECT supplier_submit_business_verification('${apply(13)}'::jsonb)`);
await as(U(12), 'rejected company sets itself verified', `UPDATE companies SET verification_status = 'verified' WHERE id = '${C(12)}' RETURNING verification_status::text`);

// ── what buyers see ──
await as(null, 'anon: all India', `SELECT company_name, round(distance_km) AS km FROM map_search_suppliers(NULL, 11.0168, 76.9558) ORDER BY 1`);
await as(null, 'anon: 100 km of Coimbatore', `SELECT company_name, distance_km FROM map_search_suppliers(NULL, 11.0168, 76.9558, 100)`);
await as(null, 'anon: 10 km of Coimbatore', `SELECT count(*) FROM map_search_suppliers(NULL, 11.0168, 76.9558, 10)`);
await as(null, 'anon: search t-shirt', `SELECT company_name, matched_products->0->>'name' AS p, min_moq, total_count FROM map_search_suppliers('t-shirt')`);
await as(null, 'anon: search by key product', `SELECT company_name, product_count FROM map_search_suppliers('knitted')`);
await as(null, 'anon: max moq 150', `SELECT company_name FROM map_search_suppliers(NULL, NULL, NULL, NULL, NULL, 150)`);
await as(null, 'anon: category slug', `SELECT count(*) FROM map_search_suppliers(NULL, NULL, NULL, NULL, 'textiles')`);
await as(null, 'anon: require CIN', `SELECT count(*) FROM map_search_suppliers(p_require_cin => true)`);
await as(null, 'anon: viewport Maharashtra', `SELECT company_name FROM map_search_suppliers(p_south => 15, p_west => 70, p_north => 22, p_east => 80)`);
await as(null, 'anon: page 2 of 1', `SELECT count(*) FROM map_search_suppliers(p_limit => 1, p_offset => 1)`);
await as(null, 'anon: detail verified', `SELECT map_supplier_detail('${C(10)}', 11.0168, 76.9558)->>'distance_km'`);
await as(null, 'anon: detail pending', `SELECT map_supplier_detail('${C(11)}') IS NULL`);
await as(null, 'anon: detail suspended', `SELECT map_supplier_detail('${C(13)}') IS NULL`);
await as(null, 'anon: read applications', `SELECT count(*) FROM business_verifications`);
await as(null, 'anon: read locations', `SELECT count(*) FROM factory_locations`);
await as(null, 'anon: read audit', `SELECT count(*) FROM verification_audit_log`);
await as(null, 'anon: change signal readable', `SELECT count(*) > 0 FROM supplier_map_changes`);
await as(null, 'anon: calls visible ids', `SELECT count(*) FROM map_visible_company_ids()`);
await as(U(91), 'buyer: reads others applications', `SELECT count(*) FROM business_verifications`);

// ── changes take companies off the map ──
await as(U(18), 'Mumbai moves factory pin', `SELECT supplier_save_factory_location(19.2, 72.9, 'New plot', 'Thane', 'MH', 'India', null)`);
await as(U(10), 'Tiruppur updates availability', `SELECT supplier_update_availability(50000, 'pcs', 15, 'in_stock', 'bulk')`);
await as(U(10), 'Tiruppur map status', `SELECT jsonb_build_object('on_map', s->'on_map', 'business', s->'business'->>'status', 'location', s->'location'->>'status', 'products', s->'active_products') FROM supplier_map_status() s`);
await as(null, 'anon: after Mumbai pin change', `SELECT company_name, monthly_capacity, stock_status FROM map_search_suppliers()`);
await as(null, 'anon: min capacity 60000', `SELECT count(*) FROM map_search_suppliers(p_min_capacity => 60000)`);
await run(`UPDATE products SET is_active = false WHERE company_id = '${C(10)}'`);
await as(null, 'anon: after Tiruppur products off', `SELECT count(*) FROM map_search_suppliers()`);
await run(`UPDATE products SET is_active = true WHERE company_id = '${C(10)}'`);
await as(U(10), 'approved company edits application', `SELECT supplier_submit_business_verification('${apply(10, { legal_name: 'Company 10 Pvt' })}'::jsonb)`);
await as(null, 'anon: after Tiruppur re-applies', `SELECT count(*) FROM map_search_suppliers()`);
await as(U(90), 'admin recheck', `SELECT admin_decide_business_verification('${C(10)}', 'approve', 'Re-checked', true, null, null)`);
await as(U(90), 'admin history', `SELECT count(*) FROM admin_verification_history()`);
await as(U(90), 'admin history 12', `SELECT action || ':' || coalesce(from_status,'-') || '>' || to_status || ' ' || coalesce(note,'') FROM admin_verification_history('${C(12)}') WHERE subject = 'business'`);
await as(U(90), 'admin list pending locations', `SELECT company_name FROM admin_list_business_verifications('locations')`);
await as(U(90), 'existing admin page verifies 11 directly', `UPDATE companies SET verification_status = 'verified' WHERE id = '${C(11)}' RETURNING verification_status::text`);
await as(null, 'anon: 11 verified by old admin page, application still pending', `SELECT count(*) FROM map_search_suppliers() WHERE company_id = '${C(11)}'`);
await as(U(92), 'new supplier inserts company as verified', `INSERT INTO companies (owner_id, company_name, slug, verification_status, verified_at) VALUES (auth.uid(), 'Sneaky', 'sneaky', 'verified', now()) RETURNING verification_status::text`);
await as(U(10), 'owner reads own application', `SELECT status FROM business_verifications`);
await as(U(10), 'owner deletes own application', `DELETE FROM business_verifications RETURNING company_id`);
await as(U(10), 'owner writes change signal', `INSERT INTO supplier_map_changes (kind) VALUES ('x')`);
await as(null, 'anon: calls admin list', `SELECT count(*) FROM admin_list_business_verifications('all')`);
await as(null, 'anon: submits application', `SELECT supplier_submit_business_verification('{}'::jsonb)`);
await as(U(90), 'admin needs_info 18', `SELECT admin_decide_business_verification('${C(18)}', 'needs_info', 'Upload a clearer GST certificate', null, null, null)`);
await run(`UPDATE business_verifications SET recheck_due_at = now() - interval '1 day' WHERE company_id = '${C(10)}'`);
await as(null, 'anon: Tiruppur after recheck overdue', `SELECT count(*) FROM map_search_suppliers() WHERE company_id = '${C(10)}'`);
await as(U(90), 'admin recheck_due list', `SELECT company_name FROM admin_list_business_verifications('recheck_due')`);
await as(U(90), 'admin re-approves after recheck', `SELECT admin_decide_business_verification('${C(10)}', 'approve', 'GST active on portal', true, null, null)`);
await as(null, 'anon: Tiruppur back + gallery', `SELECT map_supplier_detail('${C(10)}')->>'gallery_images'`);
// ── worldwide: a business registered outside India, and searches across the 180th meridian ──
const DXB = (n) => JSON.stringify({ entity_type: 'foreign_company', legal_name: `Gulf Packaging ${n} LLC`, registration_country: 'United Arab Emirates', registration_number: 'DMCC-12345',
  registered_address: 'JLT, Dubai', factory_address: 'Jebel Ali, Dubai', contact_name: 'Owner', contact_phone: '+971500000000', contact_email: `m${n}@x`, documents: JSON.parse(docs(n)) });
for (const n of [20, 21]) {
  await run(`INSERT INTO profiles VALUES ('${U(n)}', 'm${n}@x', 'Maker ${n}', 'supplier', 'active')`);
  await run(`INSERT INTO companies (id, owner_id, company_name, slug, city) VALUES ('${C(n)}', '${U(n)}', 'Company ${n}', 'company-${n}', 'City')`);
  await run(`INSERT INTO products (company_id, category_id, name, slug, moq) VALUES ('${C(n)}', '${C(99)}', 'Corrugated Box ${n}', 'p-${n}', 1000)`);
}
await as(U(20), 'abroad: country India refused', `SELECT supplier_submit_business_verification('${DXB(20).replace('United Arab Emirates', 'India')}'::jsonb)`);
await as(U(20), 'abroad: bad registry number refused', `SELECT supplier_submit_business_verification('${DXB(20).replace('DMCC-12345', '#')}'::jsonb)`);
await as(U(20), 'abroad: no GSTIN needed', `SELECT supplier_submit_business_verification('${DXB(20)}'::jsonb)`);
await as(U(21), 'Fiji applies', `SELECT supplier_submit_business_verification('${DXB(21).replace('United Arab Emirates', 'Fiji')}'::jsonb)`);
await as(U(20), 'Dubai pin', `SELECT supplier_save_factory_location(25.0118, 55.1060, 'Jebel Ali Free Zone', 'Dubai', 'Dubai', 'United Arab Emirates', null)`);
await as(U(21), 'Fiji pin', `SELECT supplier_save_factory_location(-18.1416, 178.4419, 'Walu Bay', 'Suva', 'Central', 'Fiji', null)`);
await as(U(90), 'admin approves abroad without registry tick', `SELECT admin_decide_business_verification('${C(20)}', 'approve', null, null, null, null, null)`);
await as(U(90), 'admin approves abroad with GST tick only', `SELECT admin_decide_business_verification('${C(20)}', 'approve', null, true, null, null, null)`);
await as(U(90), 'admin approves abroad after registry check', `SELECT admin_decide_business_verification('${C(20)}', 'approve', 'Checked in the UAE registry', null, null, null, true)`);
await as(U(90), 'admin approves Fiji', `SELECT admin_decide_business_verification('${C(21)}', 'approve', 'Checked in the Fiji registry', null, null, null, true)`);
for (const n of [20, 21]) await as(U(90), `admin verifies location ${n}`, `SELECT admin_decide_factory_location('${C(n)}', 'verify', null)`);
await as(null, 'world: everyone on the map', `SELECT string_agg(company_name || ' (' || country || ')', ', ' ORDER BY company_name) FROM map_search_suppliers()`);
await as(null, 'world: country filter UAE', `SELECT string_agg(company_name, ', ') FROM map_search_suppliers(p_country => 'united arab emirates')`);
await as(null, 'world: 50 km of Dubai', `SELECT string_agg(company_name || ' ' || distance_km, ', ') FROM map_search_suppliers(NULL, 25.2048, 55.2708, 50)`);
await as(null, 'world: 300 km across the 180th meridian', `SELECT string_agg(company_name || ' ' || distance_km, ', ') FROM map_search_suppliers(NULL, -18.0, -179.9, 300)`);
await as(null, 'world: viewport across the 180th meridian', `SELECT string_agg(company_name, ', ') FROM map_search_suppliers(p_south => -25, p_west => 170, p_north => -10, p_east => -170)`);
await as(null, 'world: detail shows registry check', `SELECT (d->>'registration_country') || ' / registry_verified=' || (d->>'registry_verified') FROM map_supplier_detail('${C(20)}') d`);
await as(U(90), 'admin list shows registry fields', `SELECT registration_country || ' ' || registration_number || ' ' || registry_verified FROM admin_list_business_verifications('approved') WHERE company_id = '${C(20)}'`);
r.companies = await q(`SELECT company_name, verification_status::text AS v, is_verified, rejection_reason FROM companies ORDER BY company_name`);
console.log(JSON.stringify(r, null, 1));
