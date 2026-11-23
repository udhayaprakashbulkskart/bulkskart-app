// Migration 00072: only paid manufacturers, including existing profiles placed at their city.
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin'); CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TABLE profiles (id uuid PRIMARY KEY, email text, role user_role NOT NULL DEFAULT 'buyer', status account_status NOT NULL DEFAULT 'active');
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, company_name text, slug text, description text, business_type text, trade_type text,
  city text, state text, country text DEFAULT 'India', logo_url text, cover_url text, banner_url text,
  verification_status verification_status NOT NULL DEFAULT 'unverified', verified_at timestamptz, verified_by uuid, verification_expiry_at timestamptz,
  rejection_reason text, is_verified boolean, is_blocked boolean NOT NULL DEFAULT false, rating_avg numeric, review_count int, key_products text[], gallery_images text[],
  production_capacity text, year_established int, created_at timestamptz DEFAULT now());
CREATE TABLE subscriptions (id serial PRIMARY KEY, company_id uuid, status text, tier text, ends_at timestamptz);
CREATE TABLE categories (id uuid PRIMARY KEY, name text, slug text, parent_id uuid);
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, category_id uuid, name text, slug text, moq int, moq_unit text, price_min numeric, price_max numeric, price_currency text, images text[], tags text[], is_active boolean DEFAULT true, updated_at timestamptz DEFAULT now());
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION owns_company(c uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM companies WHERE id = c AND owner_id = auth.uid()) $$;
`);
const migration = (n) => readFileSync(new URL(`../../../supabase/migrations/${n}`, import.meta.url), 'utf8');
await run(migration('00071_supplier_map.sql'));
await run(migration('00072_supplier_map_paid_and_existing.sql'));
await run(migration('00072_supplier_map_paid_and_existing.sql')); // safe to run again

const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const C = (n) => `c0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const DEMO = '00000000-0000-0000-0000-000000000001';
await run(`INSERT INTO profiles VALUES ('${DEMO}', 'demo@x', 'supplier', 'active'), ('${U(90)}', 'admin@x', 'admin', 'active'), ('${U(91)}', 'buyer@x', 'buyer', 'active')`);
// n: [name, city, state, country, paid ('active'|'expired'|'trial'|null), extra SQL]
const cos = {
  10: ['Coimbatore paid, unverified, no pin', 'Coimbatore', 'Tamil Nadu', 'India', 'active'],
  11: ['Mumbai unpaid', 'Mumbai', null, 'India', null],
  12: ['Mumbai paid verified', 'mumbai', null, 'India', 'active', `UPDATE companies SET verification_status = 'verified', verified_at = now() WHERE id = '${C(12)}'`],
  13: ['Delhi paid (Nehru place)', 'Nehru place, Delhi', 'Delhi', 'India', 'active'],
  14: ['Swapped city/state', 'Maharashtra', 'Mumbai', 'India', 'active'],
  15: ['No city at all', null, null, 'India', 'active'],
  16: ['Own pin, not checked', 'Tiruppur', 'Tamil Nadu', 'India', 'active'],
  17: ['Checked pin', 'Erode', 'Tamil Nadu', 'India', 'active'],
  18: ['Blocked', 'Chennai', null, 'India', 'active', `UPDATE companies SET is_blocked = true WHERE id = '${C(18)}'`],
  19: ['Owner suspended', 'Chennai', null, 'India', 'active', `UPDATE profiles SET status = 'suspended' WHERE id = '${U(19)}'`],
  20: ['Admin rejected', 'Chennai', null, 'India', 'active', `UPDATE companies SET verification_status = 'rejected' WHERE id = '${C(20)}'`],
  21: ['Map application suspended', 'Chennai', null, 'India', 'active'],
  22: ['Demo company', 'Chennai', null, 'India', 'active'],
  23: ['Plan expired', 'Chennai', null, 'India', 'expired'],
  24: ['Trial only', 'Chennai', null, 'India', 'trial'],
  25: ['Navi Mumbai paid', 'Navi Mumbai', 'Maharashtra', 'India', 'active'],
  26: ['Verified but re-applying', 'Cuddalore', null, 'India', 'active', `UPDATE companies SET verification_status = 'verified', verified_at = now() WHERE id = '${C(26)}'`],
  27: ['Dubai paid', 'Dubai', null, 'United Arab Emirates', 'active'],
  28: ['Ernakulam paid (old name test: Cochin)', 'Cochin', 'Kerala', 'India', 'active'],
};
for (const [n, [name, city, state, country, plan, extra]] of Object.entries(cos)) {
  const owner = n === '22' ? DEMO : U(n);
  if (n !== '22') await run(`INSERT INTO profiles VALUES ('${owner}', 'm${n}@x', 'supplier', 'active')`);
  await run(`INSERT INTO companies (id, owner_id, company_name, slug, city, state, country, description) VALUES ('${C(n)}', '${owner}', '${name}', 'c-${n}', ${city ? `'${city}'` : 'NULL'}, ${state ? `'${state}'` : 'NULL'}, '${country}', 'We make cotton shirts')`);
  if (plan) await run(`INSERT INTO subscriptions (company_id, status, tier, ends_at) VALUES ('${C(n)}', '${plan === 'expired' ? 'active' : plan}', 'business', ${plan === 'expired' ? "now() - interval '1 day'" : "now() + interval '30 days'"})`);
  if (extra) await run(extra);
}
await run(`INSERT INTO factory_locations (company_id, latitude, longitude, address, city, state, country, status) VALUES
  ('${C(16)}', 11.12, 77.35, 'Plot 4, SIDCO', 'Tiruppur', 'Tamil Nadu', 'India', 'pending'),
  ('${C(17)}', 11.33, 77.72, 'Perundurai SIPCOT', 'Erode', 'Tamil Nadu', 'India', 'verified')`);
await run(`INSERT INTO business_verifications (company_id, entity_type, legal_name, gstin, registered_address, factory_address, contact_name, contact_phone, contact_email, status) VALUES
  ('${C(21)}', 'proprietorship', 'x', '33AAAAA0000A1Z5', 'a', 'b', 'c', 'd', 'e', 'suspended'),
  ('${C(26)}', 'proprietorship', 'x', '33AAAAA0000A1Z5', 'a', 'b', 'c', 'd', 'e', 'pending')`);

const r = {};
const as = async (uid, label, sql) => {
  await run(uid ? `SET ROLE authenticated; SELECT set_config('app.uid', '${uid}', false);` : `SET ROLE anon; SELECT set_config('app.uid', '', false);`);
  try { const rows = await q(sql); r[label] = rows.length === 1 && Object.keys(rows[0]).length === 1 ? Object.values(rows[0])[0] : rows; } catch (e) { r[label] = 'ERROR: ' + String(e.message).slice(0, 80); }
  await run(`RESET ROLE; SELECT set_config('app.uid', '', false);`);
};
await as(null, 'on the map (anyone)', `SELECT company_name || ' | ' || location_precision || ' | ' || city || ' | ' || CASE WHEN verified THEN 'verified' ELSE 'premium' END AS row FROM map_search_suppliers() ORDER BY company_name`);
await as(null, 'verified only', `SELECT string_agg(company_name, ', ') FROM map_search_suppliers(p_verified_only => true)`);
await as(null, '60 km of Coimbatore', `SELECT string_agg(company_name || ' ' || distance_km, ', ' ORDER BY distance_km) FROM map_search_suppliers(NULL, 11.0168, 76.9558, 60)`);
await as(null, 'search "shirt" with no products', `SELECT count(*) FROM map_search_suppliers('shirt')`);
await as(null, 'country UAE', `SELECT string_agg(company_name, ', ') FROM map_search_suppliers(p_country => 'United Arab Emirates')`);
await as(null, 'detail city-level hides street', `SELECT (d->>'location_precision') || ' / address=' || COALESCE(d->>'factory_address', 'none') FROM map_supplier_detail('${C(10)}') d`);
await as(null, 'detail exact pin shows street', `SELECT (d->>'location_precision') || ' / address=' || COALESCE(d->>'factory_address', 'none') FROM map_supplier_detail('${C(17)}') d`);
await as(null, 'detail unpaid', `SELECT map_supplier_detail('${C(11)}') IS NULL`);
await as(null, 'anon reads subscriptions through the map', `SELECT count(*) FROM company_has_paid_plan('${C(10)}')`);
await as(U(10), 'status for Coimbatore owner', `SELECT jsonb_build_object('paid', s->'paid', 'on_map', s->'on_map', 'verified', s->'verified', 'point', s->'map_point'->>'location_precision', 'city', s->'map_point'->>'city') FROM supplier_map_status() s`);
await as(U(11), 'status for unpaid owner', `SELECT jsonb_build_object('paid', s->'paid', 'on_map', s->'on_map', 'point', s->'map_point'->>'city') FROM supplier_map_status() s`);
await as(U(15), 'status with no city', `SELECT jsonb_build_object('paid', s->'paid', 'on_map', s->'on_map', 'point', s->'map_point') FROM supplier_map_status() s`);
// a plan ends: off the map
await run(`UPDATE subscriptions SET ends_at = now() - interval '1 minute' WHERE company_id = '${C(10)}'`);
await as(null, 'Coimbatore after plan ends', `SELECT count(*) FROM map_search_suppliers() WHERE company_id = '${C(10)}'`);
await as(null, 'change signal on plan end', `SELECT count(*) > 0 FROM supplier_map_changes WHERE kind = 'subscriptions'`);
await as(null, 'places table rows', `SELECT count(*) FROM map_places`);
console.log(JSON.stringify(r, null, 1));
