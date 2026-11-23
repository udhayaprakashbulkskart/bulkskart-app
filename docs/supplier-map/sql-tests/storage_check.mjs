import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const A = '00000000-0000-0000-0000-0000000000aa', U = '00000000-0000-0000-0000-000000000011', V = '00000000-0000-0000-0000-000000000022';
await run(`
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin'); CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TABLE profiles (id uuid PRIMARY KEY, email text, role user_role NOT NULL DEFAULT 'buyer', status account_status NOT NULL DEFAULT 'active');
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, company_name text, slug text, description text, business_type text, trade_type text, city text, state text,
  logo_url text, cover_url text, banner_url text, verification_status verification_status NOT NULL DEFAULT 'unverified', verified_at timestamptz, verified_by uuid, verification_expiry_at timestamptz,
  rejection_reason text, is_verified boolean, is_blocked boolean NOT NULL DEFAULT false, rating_avg numeric, review_count int, key_products text[], gallery_images text[], production_capacity text, year_established int, created_at timestamptz DEFAULT now());
CREATE TABLE categories (id uuid PRIMARY KEY, name text, slug text, parent_id uuid);
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, category_id uuid, name text, slug text, moq int, moq_unit text, price_min numeric, price_max numeric, price_currency text, images text[], tags text[], is_active boolean DEFAULT true, updated_at timestamptz DEFAULT now());
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION get_my_role() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT role::text FROM profiles WHERE id = auth.uid() $$;
CREATE FUNCTION owns_company(c uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM companies WHERE id = c AND owner_id = auth.uid()) $$;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects (id serial PRIMARY KEY, bucket_id text, name text);
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated; GRANT USAGE ON SEQUENCE storage.objects_id_seq TO anon, authenticated;
INSERT INTO storage.buckets VALUES ('verification-docs', 'verification-docs', true), ('business-docs', 'business-docs', true), ('product-images', 'product-images', true);
-- as 00011
CREATE POLICY "verification_docs_owner" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verification_docs_admin" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'verification-docs' AND get_my_role() = 'admin');
-- as 00033
CREATE POLICY "Public read access for verification-docs" ON storage.objects FOR SELECT USING (bucket_id = 'verification-docs');
CREATE POLICY "Public insert access for verification-docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'verification-docs');
CREATE POLICY "Public read access for product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
-- an unknown open rule on business-docs
CREATE POLICY "bd anyone" ON storage.objects FOR SELECT USING (bucket_id = 'business-docs');
INSERT INTO profiles VALUES ('${A}', 'a@x', 'admin', 'active'), ('${U}', 'u@x', 'supplier', 'active'), ('${V}', 'v@x', 'supplier', 'active');
INSERT INTO storage.objects (bucket_id, name) VALUES ('verification-docs', '${U}/gst/a.pdf'), ('verification-docs', '${V}/gst/b.pdf'), ('business-docs', '${U}/docs/c.pdf'), ('product-images', 'p/x.png');
`);
const r = {};
const as = async (uid, label, sql) => {
  await run(uid ? `SET ROLE authenticated; SELECT set_config('app.uid', '${uid}', false);` : `SET ROLE anon; SELECT set_config('app.uid', '', false);`);
  try { r[label] = (await q(sql)).map((x) => Object.values(x).join(' ')).join(' | ') || '(none)'; } catch (e) { r[label] = 'ERROR: ' + String(e.message).slice(0, 70); }
  await run(`RESET ROLE; SELECT set_config('app.uid', '', false);`);
};
await as(null, 'BEFORE anon sees', `SELECT bucket_id || ':' || name FROM storage.objects ORDER BY 1`);
const mig = readFileSync(new URL('../../../supabase/migrations/00071_supplier_map.sql', import.meta.url), 'utf8');
await run(mig); await run(mig);
r.policies = (await q(`SELECT policyname FROM pg_policies WHERE schemaname = 'storage' ORDER BY 1`)).map((x) => x.policyname).join(' | ');
r.buckets = (await q(`SELECT id || '=' || public FROM storage.buckets ORDER BY 1`)).map((x) => Object.values(x)[0]).join(' | ');
await as(null, 'AFTER anon sees', `SELECT bucket_id || ':' || name FROM storage.objects ORDER BY 1`);
await as(null, 'anon uploads', `INSERT INTO storage.objects (bucket_id, name) VALUES ('verification-docs', 'x/evil.pdf') RETURNING name`);
await as(U, 'owner sees', `SELECT bucket_id || ':' || name FROM storage.objects WHERE bucket_id <> 'product-images' ORDER BY 1`);
await as(U, 'owner uploads own folder', `INSERT INTO storage.objects (bucket_id, name) VALUES ('verification-docs', '${U}/map/gst-1.pdf') RETURNING name`);
await as(U, 'owner uploads other folder', `INSERT INTO storage.objects (bucket_id, name) VALUES ('verification-docs', '${V}/map/x.pdf') RETURNING name`);
await as(U, 'owner uploads business-docs', `INSERT INTO storage.objects (bucket_id, name) VALUES ('business-docs', '${U}/docs/gst.pdf') RETURNING name`);
await as(A, 'admin sees', `SELECT count(*) FROM storage.objects WHERE bucket_id IN ('verification-docs', 'business-docs')`);
console.log(JSON.stringify(r, null, 1));
