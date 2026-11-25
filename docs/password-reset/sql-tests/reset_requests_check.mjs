/**
 * Runs supabase/migrations/00079_password_reset_requests.sql on PGlite with Supabase's roles and a stand-in for
 * pgcrypto (PGlite has none; the stand-in keeps the same "crypt(password, hash) = hash" contract as bcrypt).
 *   cd docs/password-reset/sql-tests && npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17 && node reset_requests_check.mjs
 * Test values only; they exist only in this in-memory database.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
let failed = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✓' : '✗'} ${m}${!c && extra !== '' ? `\n    got: ${JSON.stringify(extra)}` : ''}`); if (!c) failed++; };
const OWNER = '00000000-0000-0000-0000-000000000001';
const BUYER = '00000000-0000-0000-0000-000000000002';
const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const SUPER = '00000000-0000-0000-0000-0000000000a2';
const OTHER_ADMIN = '00000000-0000-0000-0000-0000000000a3';

await run(`
CREATE SCHEMA auth;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, encrypted_password text, updated_at timestamptz);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, user_id varchar(255), token text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE profiles (id uuid PRIMARY KEY, phone text, full_name text, role text, is_super_admin boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, company_name text, created_at timestamptz DEFAULT now());
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, message text, type text, link text, created_at timestamptz DEFAULT now());
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION is_super_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_super_admin) $$;
-- stand-in for pgcrypto's bcrypt: the hash starts with its salt, and crypt(password, hash) gives the hash back
CREATE SCHEMA extensions;
CREATE FUNCTION extensions.gen_salt(text, int) RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT '$2a$' || lpad($2::text, 2, '0') || '$' || left(md5(random()::text) || md5(random()::text), 22) $$;
CREATE FUNCTION extensions.crypt(text, text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT left($2, 29) || md5(left($2, 29) || $1) $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
INSERT INTO auth.users (id, email, encrypted_password) VALUES
  ('${OWNER}', 'Owner@Mills.invalid', 'old-hash-owner'), ('${BUYER}', 'buyer@test.invalid', 'old-hash-buyer'),
  ('${ADMIN}', 'admin@test.invalid', 'old-hash-admin'), ('${SUPER}', 'super@test.invalid', 'old-hash-super'),
  ('${OTHER_ADMIN}', 'other.admin@test.invalid', 'old-hash-other');
INSERT INTO profiles (id, phone, full_name, role, is_super_admin) VALUES
  ('${OWNER}', '+91 98765 43210', 'Mill Owner', 'supplier', false), ('${BUYER}', NULL, 'Test Buyer', 'buyer', false),
  ('${ADMIN}', '9000000001', 'Admin One', 'admin', false), ('${SUPER}', '9000000002', 'Super Admin', 'admin', true),
  ('${OTHER_ADMIN}', '9000000003', 'Other Admin', 'admin', false);
INSERT INTO companies (owner_id, company_name) VALUES ('${OWNER}', 'Test Mills Pvt Ltd');
INSERT INTO auth.sessions (user_id) VALUES ('${OWNER}'), ('${OWNER}'), ('${BUYER}');
INSERT INTO auth.refresh_tokens (user_id, token) VALUES ('${OWNER}', 't1'), ('${BUYER}', 't2');
`);
// PGlite has no pgcrypto: the stand-in above takes its place
const mig = readFileSync(new URL('../../../supabase/migrations/00079_password_reset_requests.sql', import.meta.url), 'utf8')
  .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;', '');
await run(mig); await run(mig);
ok(true, 'migration runs twice');

const as = async (who, uid, sql, ip = '203.0.113.7') => {
  await run(`SELECT set_config('test.uid', '${uid ?? ''}', false), set_config('request.headers', '${JSON.stringify({ 'x-forwarded-for': `${ip}, 10.0.0.1` })}', false)`);
  await run(`SET ROLE ${who}`);
  try { const r = await q(sql); return Object.values(r[0] ?? {})[0]; } catch (e) { return `ERROR: ${e.message}`; } finally { await run('RESET ROLE'); }
};
const isErr = (v, c) => typeof v === 'string' && v.startsWith('ERROR') && (!c || v.includes(c));
const ask = (email, phone, pw, ip) => as('anon', null, `SELECT public.pwreset_request(${email === null ? 'NULL' : `'${email}'`}, '${phone}', '${pw}')`, ip);
const admin = (uid, sql) => as('authenticated', uid, sql);
const reqs = () => q(`SELECT * FROM pwrequest.requests ORDER BY created_at, id`);

// who may do what
ok(isErr(await as('anon', null, `SELECT count(*) FROM pwrequest.requests`), 'permission denied'), 'visitors cannot read the requests');
ok(isErr(await as('authenticated', BUYER, `SELECT count(*) FROM pwrequest.requests`), 'permission denied'), 'signed-in users cannot read them either');
ok(isErr(await as('anon', null, `SELECT public.admin_pwreset_requests('pending')`), 'permission denied'), 'visitors cannot call the admin functions');
ok(isErr(await admin(BUYER, `SELECT public.admin_pwreset_requests('pending')`), 'admin_only'), 'a non-admin gets admin_only');
ok(isErr(await admin(BUYER, `SELECT public.admin_pwreset_decide(gen_random_uuid(), true, NULL)`), 'admin_only'), 'a non-admin cannot decide');

// the phone number
const mob = async (p) => (await q(`SELECT public.pwreset_mobile('${p}') AS m`))[0].m;
ok(await mob('+91 98765 43210') === '9876543210' && await mob('098765-43210') === '9876543210' && await mob('9876543210') === '9876543210', 'mobile numbers are read with +91, a leading 0, spaces or dashes');
ok(await mob('12345') === null && await mob('5876543210') === null, 'numbers that are not Indian mobiles are refused');

// checks on what the visitor types
ok((await ask('not-an-email', '9876543210', 'NewPass123', '198.51.100.1')).status === 'invalid_email', 'a bad e-mail is refused');
ok((await ask('owner@mills.invalid', '12345', 'NewPass123', '198.51.100.1')).status === 'invalid_phone', 'a bad mobile number is refused');
ok((await ask('owner@mills.invalid', '9876543210', 'short1', '198.51.100.1')).status === 'weak_password', 'a password under 8 characters is refused');
ok((await ask('owner@mills.invalid', '9876543210', 'onlyletters', '198.51.100.1')).status === 'weak_password', 'a password without a digit is refused');
ok((await ask('owner@mills.invalid', '9876543210', `${'a'.repeat(72)}1`, '198.51.100.1')).status === 'weak_password', 'a password over 72 bytes (bcrypt limit) is refused');
ok((await reqs()).length === 0, 'refused requests are not stored');

const pwOf = async (id) => (await q(`SELECT encrypted_password AS p FROM auth.users WHERE id = '${id}'`))[0].p;
const count = async (sql) => Number((await q(sql))[0].n);

// nothing changes without the right number, and every "no" looks the same
const none = await ask('nobody@test.invalid', '9876543210', 'NewPass123', '198.51.100.2');
ok(none.status === 'no_match', 'an unknown e-mail: no_match', none);
const wrong = await ask('owner@mills.invalid', '9000099999', 'NewPass123', '198.51.100.2');
ok(wrong.status === 'no_match', 'the right e-mail with a different number gets the very same answer', wrong);
ok(await pwOf(OWNER) === 'old-hash-owner', '…and the password is not changed');
ok((await ask('buyer@test.invalid', '9123456789', 'NewPass123', '198.51.100.2')).status === 'no_match', 'an account with no number on it cannot be reset this way');
let rows = await reqs();
ok(rows.every((r) => r.password_hash === null) && rows.map((r) => r.status).join() === 'no_account,no_match,no_match', 'the tries are logged, without any password hash', rows.map((r) => r.status));

// the right number: changed at once, no admin
const r1 = await ask('  OWNER@mills.invalid ', '098765-43210', 'NewPass123', '198.51.100.3');
ok(r1.status === 'changed', 'e-mail (any case or spaces) + the registered number (any format) changes the password at once', r1);
const newHash = await pwOf(OWNER);
ok(newHash !== 'old-hash-owner' && newHash.startsWith('$2a$10$') && !newHash.includes('NewPass123'), 'the account gets a bcrypt-style hash, never the password', newHash);
ok((await q(`SELECT extensions.crypt('NewPass123', '${newHash}') = '${newHash}' AS m`))[0].m, 'the hash checks against the new password the way Supabase Auth checks it');
ok(await count(`SELECT count(*) AS n FROM auth.sessions WHERE user_id = '${OWNER}'`) === 0 && await count(`SELECT count(*) AS n FROM auth.refresh_tokens WHERE user_id = '${OWNER}'`) === 0, 'the account is signed out everywhere');
ok(await count(`SELECT count(*) AS n FROM auth.sessions WHERE user_id = '${BUYER}'`) === 1, 'other accounts stay signed in');
ok(await count(`SELECT count(*) AS n FROM notifications WHERE user_id = '${OWNER}' AND title = 'Your password was changed'`) === 1, 'the owner is told the password changed');
ok(await count(`SELECT count(*) AS n FROM notifications WHERE title LIKE '%reset request%'`) === 0, 'no admin is bothered for an ordinary account');
const changedRow = (await reqs()).find((r) => r.status === 'changed');
ok(changedRow && changedRow.password_hash === null && changedRow.user_id === OWNER && changedRow.ip === '198.51.100.3', 'the change is logged (who, from where), without the hash', changedRow);

// admin accounts wait for a super admin
const adminReq = await ask('other.admin@test.invalid', '9000000003', 'AdminNew789', '198.51.100.5');
ok(adminReq.status === 'queued', 'an admin account with the right number is queued, not changed', adminReq);
ok(await pwOf(OTHER_ADMIN) === 'old-hash-other', '…its password stays as it was for now');
const supNotes = await q(`SELECT user_id FROM notifications WHERE title = 'Admin password reset request'`);
ok(supNotes.length === 1 && supNotes[0].user_id === SUPER, 'only the super admin is notified', supNotes);
let list = await admin(ADMIN, `SELECT public.admin_pwreset_requests('pending')`);
ok(list.pending === 1 && list.rows.length === 1 && list.rows[0].email === 'other.admin@test.invalid' && list.rows[0].phone_match === true, 'the admin page lists the admin request with the number check', list);
const adminRow = (await reqs()).find((r) => r.user_id === OTHER_ADMIN && r.status === 'pending');
ok(adminRow.password_hash && adminRow.password_hash.startsWith('$2a$10$'), 'a queued request keeps only the hash');
ok(isErr(await admin(ADMIN, `SELECT public.admin_pwreset_decide('${adminRow.id}', true, NULL)`), 'super_admin_only'), 'an ordinary admin cannot approve it');
ok(isErr(await admin(BUYER, `SELECT public.admin_pwreset_decide('${adminRow.id}', true, NULL)`), 'admin_only'), 'nor can anyone else');
await run(`INSERT INTO auth.sessions (user_id) VALUES ('${OTHER_ADMIN}')`);
const sup = await admin(SUPER, `SELECT public.admin_pwreset_decide('${adminRow.id}', true, 'Called 9000000003')`);
ok(sup.status === 'approved', 'the super admin approves after the call', sup);
ok(await pwOf(OTHER_ADMIN) === adminRow.password_hash && await count(`SELECT count(*) AS n FROM auth.sessions WHERE user_id = '${OTHER_ADMIN}'`) === 0, 'the admin account gets the new password and is signed out everywhere');
ok((await reqs()).find((r) => r.id === adminRow.id).password_hash === null, 'the hash is wiped once decided');
ok((await admin(SUPER, `SELECT public.admin_pwreset_decide('${adminRow.id}', true, NULL)`)).status === 'already_approved', 'a request cannot be used twice');

// reject and expiry (admin requests)
await ask('admin@test.invalid', '9000000001', 'AdminNew111', '198.51.100.6');
const a2 = (await reqs()).find((r) => r.user_id === ADMIN && r.status === 'pending');
ok((await admin(SUPER, `SELECT public.admin_pwreset_decide('${a2.id}', false, 'No answer')`)).status === 'rejected', 'a super admin can reject');
ok(await pwOf(ADMIN) === 'old-hash-admin' && (await reqs()).find((r) => r.id === a2.id).password_hash === null, 'a rejected request changes nothing and its hash is wiped');
await ask('admin@test.invalid', '9000000001', 'AdminNew222', '198.51.100.7');
const a3 = (await reqs()).find((r) => r.user_id === ADMIN && r.status === 'pending');
await run(`UPDATE pwrequest.requests SET expires_at = now() - interval '1 second' WHERE id = '${a3.id}'`);
list = await admin(SUPER, `SELECT public.admin_pwreset_requests('pending')`);
ok(list.pending === 0 && list.rows.length === 0, 'an admin request older than 48 hours drops off the list');
ok((await reqs()).find((r) => r.id === a3.id).status === 'expired' && (await admin(SUPER, `SELECT public.admin_pwreset_decide('${a3.id}', true, NULL)`)).status === 'already_expired', 'it expires and cannot be approved');

// the "done" list: changes and wrong-number tries, never unknown e-mails
list = await admin(ADMIN, `SELECT public.admin_pwreset_requests('done')`);
const statuses = list.rows.map((x) => x.status);
ok(statuses.includes('changed') && statuses.includes('no_match') && statuses.includes('approved') && !statuses.includes('no_account'), 'the admin can see owner changes and wrong-number tries; unknown e-mails never appear', statuses);
ok(list.rows.find((x) => x.id === adminRow.id).decided_by_name === 'Super Admin', 'and who approved an admin reset');

// limits
for (let i = 0; i < 3; i++) await ask('owner@mills.invalid', '9000099999', 'Whatever123', `203.0.113.${10 + i}`);
ok((await ask('owner@mills.invalid', '9876543210', 'Whatever123', '203.0.113.20')).status === 'too_many', 'after 5 tries in a day an e-mail is refused, even with the right number');
ok(await pwOf(OWNER) === newHash, '…and its password stays as it was');
for (let i = 0; i < 10; i++) await ask(`ip${i}@test.invalid`, '9123456789', 'Whatever123', '192.0.2.50');
ok((await ask('ip99@test.invalid', '9123456789', 'Whatever123', '192.0.2.50')).status === 'too_many', 'an 11th try from one address in an hour is refused');
ok((await ask('ip99@test.invalid', '9123456789', 'Whatever123', '192.0.2.51')).status === 'no_match', 'another address is not affected');
await run(`INSERT INTO pwrequest.requests (email, phone_given, ip, status) SELECT 'flood' || g || '@test.invalid', '9123456789', 'x' || g, 'no_account' FROM generate_series(1, 100) g`);
ok((await ask('late@test.invalid', '9123456789', 'Whatever123', '192.0.2.99')).status === 'too_many', 'more than 100 tries in an hour in total are refused');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
