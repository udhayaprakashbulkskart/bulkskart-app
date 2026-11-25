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

// an e-mail with no account: the same answer, nothing for the admins
const none = await ask('nobody@test.invalid', '9876543210', 'NewPass123', '198.51.100.2');
ok(none.status === 'received', 'an unknown e-mail gets the same answer (no hint whether it is registered)', none);
let rows = await reqs();
ok(rows.length === 1 && rows[0].status === 'no_account' && rows[0].password_hash === null, 'it is kept only for the limits, without a password hash', rows);

// a real request
const r1 = await ask('  OWNER@mills.invalid ', '+91 98765 43210', 'NewPass123', '198.51.100.3');
ok(r1.status === 'received', 'the owner\'s request is received', r1);
rows = (await reqs()).filter((r) => r.user_id === OWNER);
ok(rows.length === 1 && rows[0].status === 'pending', 'one pending request for the account (e-mail matched without case or spaces)');
ok(rows[0].password_hash && !rows[0].password_hash.includes('NewPass123') && rows[0].password_hash.startsWith('$2a$10$'), 'only a bcrypt-style hash of the new password is stored', rows[0].password_hash);
ok((await q(`SELECT extensions.crypt('NewPass123', '${rows[0].password_hash}') = '${rows[0].password_hash}' AS m`))[0].m, 'the hash checks against the new password the way Supabase Auth checks it');
ok(rows[0].ip === '198.51.100.3' && rows[0].phone_given === '9876543210' && rows[0].phone_registered === '+91 98765 43210', 'the address, the typed number and the registered number are kept for the admin', rows[0]);
const notes = await q(`SELECT user_id FROM notifications WHERE title = 'Password reset request' ORDER BY user_id`);
ok(notes.length === 3 && notes.every((n) => [ADMIN, SUPER, OTHER_ADMIN].includes(n.user_id)), 'every admin is notified', notes);

// a second request replaces the first
const r2 = await ask('owner@mills.invalid', '9000099999', 'Another456', '198.51.100.4');
rows = (await reqs()).filter((r) => r.user_id === OWNER);
ok(r2.status === 'received' && rows.length === 2 && rows[0].status === 'superseded' && rows[0].password_hash === null && rows[1].status === 'pending', 'a newer request replaces the waiting one and wipes its hash', rows.map((r) => r.status));

// the admin's list
let list = await admin(ADMIN, `SELECT public.admin_pwreset_requests('pending')`);
ok(list.pending === 1 && list.rows.length === 1, 'the admin sees one pending request (not the unknown e-mail, not the replaced one)', list);
const row = list.rows[0];
ok(row.full_name === 'Mill Owner' && row.company_name === 'Test Mills Pvt Ltd' && row.role === 'supplier', 'with the name, role and company', row);
ok(row.phone_given === '9000099999' && row.phone_match === false && row.phone_registered === '+91 98765 43210', 'and a warning that the typed number is not the registered one', row);

// approving needs a pending request; a non-super admin cannot reset an admin
const adminReq = await ask('other.admin@test.invalid', '9000000003', 'AdminNew789', '198.51.100.5');
ok(adminReq.status === 'received', 'an admin account can ask too');
const adminRow = (await reqs()).find((r) => r.user_id === OTHER_ADMIN);
ok(isErr(await admin(ADMIN, `SELECT public.admin_pwreset_decide('${adminRow.id}', true, NULL)`), 'super_admin_only'), 'only a super admin can approve a reset of an admin account');
ok((await q(`SELECT encrypted_password FROM auth.users WHERE id = '${OTHER_ADMIN}'`))[0].encrypted_password === 'old-hash-other', '…and the admin\'s password is untouched');
const sup = await admin(SUPER, `SELECT public.admin_pwreset_decide('${adminRow.id}', true, 'Called 9000000003')`);
ok(sup.status === 'approved', 'a super admin can', sup);

// approve the owner's request
const pend = (await reqs()).find((r) => r.user_id === OWNER && r.status === 'pending');
const hash = pend.password_hash;
const ap = await admin(ADMIN, `SELECT public.admin_pwreset_decide('${pend.id}', true, 'Called the registered number, owner confirmed')`);
ok(ap.status === 'approved', 'the admin approves after the call', ap);
ok((await q(`SELECT encrypted_password FROM auth.users WHERE id = '${OWNER}'`))[0].encrypted_password === hash, 'the account now has the new password');
ok(Number((await q(`SELECT count(*) AS n FROM auth.sessions WHERE user_id = '${OWNER}'`))[0].n) === 0 && Number((await q(`SELECT count(*) AS n FROM auth.refresh_tokens WHERE user_id = '${OWNER}'`))[0].n) === 0, 'the account is signed out everywhere');
ok(Number((await q(`SELECT count(*) AS n FROM auth.sessions WHERE user_id = '${BUYER}'`))[0].n) === 1, 'other accounts stay signed in');
const done = (await reqs()).find((r) => r.id === pend.id);
ok(done.status === 'approved' && done.password_hash === null && done.decided_by === ADMIN, 'the request is closed, its hash wiped, the admin recorded', done);
ok((await q(`SELECT count(*) AS n FROM notifications WHERE user_id = '${OWNER}' AND title = 'Your password was changed'`))[0].n == 1, 'the owner is told the password changed');
ok((await admin(ADMIN, `SELECT public.admin_pwreset_decide('${pend.id}', true, NULL)`)).status === 'already_approved', 'a request cannot be used twice');

// reject
await ask('buyer@test.invalid', '9123456789', 'BuyerNew123', '198.51.100.6');
const bReq = (await reqs()).find((r) => r.user_id === BUYER && r.status === 'pending');
const rj = await admin(ADMIN, `SELECT public.admin_pwreset_decide('${bReq.id}', false, 'No answer on the registered number')`);
ok(rj.status === 'rejected', 'the admin can reject', rj);
ok((await q(`SELECT encrypted_password FROM auth.users WHERE id = '${BUYER}'`))[0].encrypted_password === 'old-hash-buyer', 'a rejected request changes nothing');
ok((await reqs()).find((r) => r.id === bReq.id).password_hash === null, 'and its hash is wiped');

// expiry
await ask('buyer@test.invalid', '9123456789', 'BuyerNew456', '198.51.100.7');
const eReq = (await reqs()).find((r) => r.user_id === BUYER && r.status === 'pending');
await run(`UPDATE pwrequest.requests SET expires_at = now() - interval '1 second' WHERE id = '${eReq.id}'`);
list = await admin(ADMIN, `SELECT public.admin_pwreset_requests('pending')`);
ok(list.pending === 0 && list.rows.length === 0, 'a request older than 48 hours drops off the list', list);
const exp = (await reqs()).find((r) => r.id === eReq.id);
ok(exp.status === 'expired' && exp.password_hash === null, 'it expires and its hash is wiped', exp);
ok((await admin(ADMIN, `SELECT public.admin_pwreset_decide('${eReq.id}', true, NULL)`)).status === 'already_expired', 'an expired request cannot be approved');

// the "done" list
list = await admin(ADMIN, `SELECT public.admin_pwreset_requests('done')`);
const approvedRow = list.rows.find((x) => x.id === pend.id);
ok(approvedRow && approvedRow.status === 'approved' && approvedRow.decided_by_name === 'Admin One' && !list.rows.some((x) => x.status === 'no_account'), 'decided requests show who decided; unknown e-mails never appear', list.rows.map((x) => x.status));

// limits
const third = await ask('buyer@test.invalid', '9123456789', 'BuyerNew789', '198.51.100.8');
ok(third.status === 'received', 'a third request for the same e-mail in a day is still taken', third);
const fourth = await ask('BUYER@test.invalid', '9123456789', 'BuyerNew000', '198.51.100.9');
ok(fourth.status === 'too_many', 'the fourth in a day is refused', fourth);
for (let i = 0; i < 5; i++) await ask(`ip${i}@test.invalid`, '9123456789', 'Whatever123', '192.0.2.50');
ok((await ask('ip9@test.invalid', '9123456789', 'Whatever123', '192.0.2.50')).status === 'too_many', 'a sixth request from one address in an hour is refused');
ok((await ask('ip9@test.invalid', '9123456789', 'Whatever123', '192.0.2.51')).status === 'received', 'another address is not affected');
await run(`INSERT INTO pwrequest.requests (email, phone_given, ip, status) SELECT 'flood' || g || '@test.invalid', '9123456789', 'x' || g, 'no_account' FROM generate_series(1, 60) g`);
ok((await ask('late@test.invalid', '9123456789', 'Whatever123', '192.0.2.99')).status === 'too_many', 'more than 60 requests in an hour in total are refused (protects the admins\' list)');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
