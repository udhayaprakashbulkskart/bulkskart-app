/**
 * Runs supabase/migrations/00078_password_reset_whatsapp.sql on PGlite with Supabase's roles.
 *   cd docs/password-reset/sql-tests && npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17 && node reset_check.mjs
 * Test values only; they exist only in this in-memory database.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
let failed = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✓' : '✗'} ${m}${!c && extra !== '' ? `\n    got: ${JSON.stringify(extra)}` : ''}`); if (!c) failed++; };
const U1 = '00000000-0000-0000-0000-000000000001';
const U2 = '00000000-0000-0000-0000-000000000002';

await run(`
CREATE SCHEMA auth;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, user_id varchar(255), token text);
CREATE TABLE profiles (id uuid PRIMARY KEY, phone text, full_name text);
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
INSERT INTO auth.users VALUES ('${U1}', 'Owner@Test.invalid'), ('${U2}', 'nophone@test.invalid');
INSERT INTO profiles VALUES ('${U1}', '98765 43210', 'Test Owner'), ('${U2}', NULL, 'No Phone');
INSERT INTO auth.sessions (user_id) VALUES ('${U1}'), ('${U1}');
INSERT INTO auth.refresh_tokens (user_id, token) VALUES ('${U1}', 't1');
`);
const mig = readFileSync(new URL('../../../supabase/migrations/00078_password_reset_whatsapp.sql', import.meta.url), 'utf8');
await run(mig); await run(mig);
ok(true, 'migration runs twice');

const as = async (who, sql) => {
  await run(`SET ROLE ${who}`);
  try { const r = await q(sql); return Object.values(r[0] ?? {})[0]; } catch (e) { return `ERROR: ${e.message}`; } finally { await run('RESET ROLE'); }
};
const svc = (sql) => as('service_role', sql);
const isErr = (v, c) => typeof v === 'string' && v.startsWith('ERROR') && (!c || v.includes(c));

ok(isErr(await as('anon', `SELECT public.pwreset_service_lookup('owner@test.invalid', '1.1.1.1')`), 'permission denied'), 'visitors cannot call the reset functions');
ok(isErr(await as('authenticated', `SELECT public.pwreset_service_verify('owner@test.invalid', '000000', '1.1.1.1')`), 'permission denied'), 'signed-in users cannot either');
ok(isErr(await as('service_role', `SELECT count(*) FROM pwreset.codes`), 'permission denied'), 'the codes table is not readable even by the service role directly');

ok((await svc(`SELECT public.pwreset_service_lookup('nobody@test.invalid', 'ip1')`)).status === 'no_account', 'unknown e-mail: no_account');
ok((await svc(`SELECT public.pwreset_service_lookup('nophone@test.invalid', 'ip1')`)).status === 'no_phone', 'account without a phone: no_phone');
const look = await svc(`SELECT public.pwreset_service_lookup('  OWNER@test.invalid ', 'ip1')`);
ok(look.status === 'ok' && look.user_id === U1 && look.phone === '98765 43210', 'e-mail matched without case or spaces; phone returned to the edge function', look);

ok(isErr(await svc(`SELECT public.pwreset_service_create('${U1}', '12345', 'ip1', '10')`), 'invalid_code'), 'only 6-digit codes are stored');
const c1 = await svc(`SELECT public.pwreset_service_create('${U1}', '123456', 'ip1', '10')`);
ok(c1.status === 'ok', 'code created');
ok((await q(`SELECT code_hash FROM pwreset.codes`))[0].code_hash !== '123456', 'only a hash of the code is stored');
ok((await svc(`SELECT public.pwreset_service_create('${U1}', '654321', 'ip1', '10')`)).status === 'too_soon', 'one code a minute');

const v = (code, ip = 'ip2') => svc(`SELECT public.pwreset_service_verify('owner@test.invalid', '${code}', '${ip}')`);
let r = await v('000000');
ok(r.status === 'wrong_code' && r.attempts_left === 4, 'a wrong code counts down the tries', r);
for (let i = 0; i < 3; i++) await v('000001');
r = await v('000002');
ok(r.status === 'locked', 'five wrong codes lock the code', r);
ok((await v('123456')).status === 'expired', 'a locked code no longer works, even the right one');

// a new code (as if a minute passed)
await run(`UPDATE pwreset.codes SET created_at = created_at - interval '2 minutes'`);
const c2 = await svc(`SELECT public.pwreset_service_create('${U1}', '246810', 'ip1', '10')`);
ok(c2.status === 'ok', 'a new code after a minute');
await run(`UPDATE pwreset.codes SET expires_at = now() - interval '1 second' WHERE id = '${c2.id}'`);
ok((await v('246810')).status === 'expired', 'a code expires after 10 minutes');
await run(`UPDATE pwreset.codes SET created_at = created_at - interval '2 minutes'`);
ok((await svc(`SELECT public.pwreset_service_create('${U1}', '111111', 'ip1', '10')`)).status === 'ok', 'a third code in the hour is allowed');
await run(`UPDATE pwreset.codes SET created_at = created_at - interval '2 minutes'`);
ok((await svc(`SELECT public.pwreset_service_create('${U1}', '135791', 'ip1', '10')`)).status === 'rate_limited', 'a fourth is refused, even though each new code replaced the last');
await run(`UPDATE pwreset.codes SET created_at = created_at - interval '2 hours'`);
const c3 = await svc(`SELECT public.pwreset_service_create('${U1}', '135791', 'ip1', '10')`);
await svc(`SELECT public.pwreset_service_void('${c3.id}')`);
ok((await v('135791')).status === 'expired', 'a code whose WhatsApp message failed cannot be used');
ok((await svc(`SELECT public.pwreset_service_create('${U1}', '975310', 'ip1', '10')`)).status === 'ok', 'a failed send does not block the next code');
await run(`DELETE FROM pwreset.codes WHERE code_hash = public.pwreset_hash('${U1}', '975310')`);
await run(`UPDATE pwreset.codes SET created_at = created_at - interval '2 minutes'`);
await svc(`SELECT public.pwreset_service_create('${U1}', '975310', 'ip1', '10')`);
r = await v('975310');
ok(r.status === 'ok' && r.user_id === U1, 'the right code verifies once', r);
ok((await v('975310')).status === 'expired', 'and cannot be used again');

await svc(`SELECT public.pwreset_service_finish('${U1}', 'ip2')`);
ok(Number((await q(`SELECT count(*) n FROM auth.sessions WHERE user_id = '${U1}'`))[0].n) === 0, 'saving the new password signs out every session');
ok(Number((await q(`SELECT count(*) n FROM auth.refresh_tokens WHERE user_id = '${U1}'`))[0].n) === 0, 'and removes refresh tokens');

for (let i = 0; i < 20; i++) await svc(`SELECT public.pwreset_service_lookup('x${i}@test.invalid', 'ip9')`);
ok((await svc(`SELECT public.pwreset_service_lookup('owner@test.invalid', 'ip9')`)).status === 'rate_limited', 'one address cannot look up more than 20 accounts an hour');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
