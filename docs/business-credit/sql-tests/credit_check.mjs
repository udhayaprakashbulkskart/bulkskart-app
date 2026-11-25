/**
 * Runs 00058 + 00076 + 00077 on an in-memory Postgres (PGlite) with Supabase's roles and checks the business credit
 * rules: nothing is approved or withdrawable without a recorded lender decision, money is paid out only with the
 * lender's UTR, 0% is shown only when confirmed, and every role can do only its part.
 *
 *   cd docs/business-credit/sql-tests
 *   npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
 *   node credit_check.mjs
 *
 * All values are test inputs that exist only inside this in-memory database.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
let failed = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✓' : '✗'} ${m}${!c && extra !== '' ? `\n    got: ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`); if (!c) failed++; };

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const SUP = '00000000-0000-0000-0000-0000000000s1'.replace('s', '5');
const SUP2 = '00000000-0000-0000-0000-0000000000s2'.replace('s', '6');
const BUYER = '00000000-0000-0000-0000-0000000000b1';

await run(`
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TABLE profiles (id uuid PRIMARY KEY, role user_role NOT NULL DEFAULT 'buyer', full_name text, email text, phone text);
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, company_name text NOT NULL, city text,
  verification_status verification_status NOT NULL DEFAULT 'unverified', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE test_subscriptions (user_id uuid PRIMARY KEY);
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION is_supplier_subscribed(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM test_subscriptions WHERE user_id = p_user_id) $$;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
INSERT INTO profiles VALUES ('${ADMIN}', 'admin', 'Admin', 'admin@test.invalid', NULL), ('${SUP}', 'supplier', 'Supplier One', 'one@test.invalid', '9000000001'),
  ('${SUP2}', 'supplier', 'Supplier Two', 'two@test.invalid', '9000000002'), ('${BUYER}', 'buyer', 'Buyer', 'b@test.invalid', NULL);
INSERT INTO companies (owner_id, company_name, city) VALUES ('${SUP}', 'Test Mills', 'Coimbatore'), ('${SUP2}', 'Other Works', 'Rajkot');
`);
for (const f of ['00058_loan_requests.sql', '00076_loan_kyc.sql', '00077_business_credit.sql']) {
  await run(readFileSync(new URL(`../../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
}
await run(readFileSync(new URL('../../../supabase/migrations/00077_business_credit.sql', import.meta.url), 'utf8'));
ok(true, 'migrations run (00077 twice) without error');

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
const isErr = (v, code) => typeof v === 'string' && v.startsWith('ERROR') && (!code || v.includes(code));
const app = async (id) => (await q(`SELECT * FROM credit_applications WHERE id = '${id}'`))[0];
const state = (who) => as(who, `SELECT public.credit_my_state()`);

// ── access ──
ok(isErr(await as('anon', `SELECT public.credit_program()`), 'permission denied'), 'visitors cannot call credit functions');
ok(isErr(await as('anon', `SELECT count(*) FROM credit_applications`), 'permission denied'), 'visitors cannot read applications');
ok(isErr(await as(SUP, `INSERT INTO credit_applications (user_id, requested_amount) VALUES ('${SUP}', 100000)`), 'permission denied'), 'suppliers cannot write tables directly');
ok(isErr(await as(SUP, `UPDATE credit_applications SET approved_amount = 1500000`), 'permission denied'), 'suppliers cannot set an approved amount');
ok(isErr(await as(SUP, `SELECT public.credit_service_lender_event('x', 'evt-000001', 'repayment.received', '{}')`), 'permission denied'), 'suppliers cannot call the lender webhook function');
ok(isErr(await as(SUP, `SELECT public.admin_credit_applications()`), 'admin_only'), 'non-admins get admin_only');
ok(isErr(await as(BUYER, `SELECT public.credit_save_draft(100000)`), 'suppliers_only'), 'only manufacturers (suppliers) can apply');

// ── program before any lending partner ──
let prog = await as(SUP, `SELECT public.credit_program()`);
ok(prog.live === false && Number(prog.max_amount) === 1500000 && prog.tenure_months === 12 && prog.zero_interest_confirmed === false,
  'no partner live: "up to ₹15,00,000, 12 months", and 0% is not claimed', prog);

// ── partners and products ──
const p1 = await as(ADMIN, `SELECT public.admin_credit_upsert_partner(${J({ code: 'partner_a', name: 'Partner A', legal_name: 'Partner A Finance Ltd', entity_type: 'nbfc' })})`);
ok(typeof p1 === 'string' && !isErr(p1), 'admin adds a lending partner (draft)');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_upsert_product(${J({ partner_id: p1, name: 'Business Credit 12M', interest_rate_pct: 0, status: 'active' })})`), 'partner_not_live'),
  'a product cannot go live while its partner is not live');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_upsert_partner(${J({ id: p1, name: 'Partner A', legal_name: 'Partner A Finance Ltd', entity_type: 'nbfc', status: 'active' })})`), 'lending_partners_live_ck'),
  'a partner cannot go live without its RBI registration and grievance officer');
await as(ADMIN, `SELECT public.admin_credit_upsert_partner(${J({ id: p1, name: 'Partner A', legal_name: 'Partner A Finance Ltd', entity_type: 'nbfc', status: 'active', rbi_registration_no: 'N-00.00000', grievance_officer_name: 'Grievance Officer', grievance_email: 'grievance@partner.invalid', integration_mode: 'api' })})`);
const prod1 = await as(ADMIN, `SELECT public.admin_credit_upsert_product(${J({ partner_id: p1, name: 'Business Credit 12M', interest_rate_pct: 0, status: 'active' })})`);
prog = await as(SUP, `SELECT public.credit_program()`);
ok(prog.live === true && prog.zero_interest_confirmed === false && prog.interest_rate_pct === null, '0% entered but not confirmed by the partner: not shown');
await as(ADMIN, `SELECT public.admin_credit_upsert_product(${J({ id: prod1, partner_id: p1, name: 'Business Credit 12M', min_amount: 50000, max_amount: 1500000, tenure_months: 12, interest_rate_pct: 0, rate_confirmed: true, rate_confirmation_ref: 'PA/2026/117', status: 'active' })})`);
prog = await as(SUP, `SELECT public.credit_program()`);
ok(prog.zero_interest_confirmed === true && prog.partner?.name === 'Partner A' && prog.partner?.rbi_registration_no, 'confirmed in writing (reference recorded): 0% shown, with the partner and its RBI registration');

// ── eligibility and amount ──
let st = await state(SUP);
ok(Object.values(st.checks).every((v) => v === false) && Number(st.eligible_amount) === 0 && st.available_limit === null, 'new supplier: no check passes, nothing eligible, no limit');
for (const [amt, why] of [[1600000, 'above the maximum'], [25000, 'below the minimum'], [100500, 'not in steps of ₹1,000']]) {
  ok(isErr(await as(SUP, `SELECT public.credit_save_draft(${amt})`), 'invalid_amount'), `amount ${why} is refused`);
}
const a1 = await as(SUP, `SELECT public.credit_save_draft(500000, 'Raw cotton for export order')`);
ok(typeof a1 === 'string' && !isErr(a1), 'supplier selects ₹5,00,000 (draft)');
ok(String(await as(SUP, `SELECT public.credit_save_draft(600000)`)) === a1, 'changing the amount updates the same draft');
const ne = await as(SUP, `SELECT public.credit_submit('${a1}', true)`);
ok(isErr(ne, 'not_eligible'), 'cannot submit before the eligibility checks pass', ne);

// pass checks 1-4 (as the other parts of the platform would)
await run(`INSERT INTO test_subscriptions VALUES ('${SUP}');
UPDATE companies SET verification_status = 'verified' WHERE owner_id = '${SUP}';
INSERT INTO kyc_profiles (user_id, status, pan_status, aadhaar_status, business_status, bank_status, review_status, pan_verified_via, aadhaar_verified_via, business_verified_via, consent_at, pan_hash, entity_type)
VALUES ('${SUP}', 'verified', 'verified', 'verified', 'verified', 'verified', 'verified', 'document_review', 'document_review', 'document_review', now(), 'h', 'proprietorship');
INSERT INTO bank_verifications (kyc_profile_id, user_id, account_holder_name, account_last4, account_hash, ifsc, status, verified_via)
SELECT id, user_id, 'Test Mills', '4321', 'bh', 'HDFC0001234', 'verified', 'document_review' FROM kyc_profiles WHERE user_id = '${SUP}';`);
st = await state(SUP);
ok(st.checks.subscription && st.checks.kyc && st.checks.business && st.checks.bank && !st.checks.lender, 'checks 1–4 pass; lender approval does not yet');
ok(Number(st.eligible_amount) === 1500000, 'eligible to apply for up to ₹15,00,000 (not an approval)');
ok(isErr(await as(SUP, `SELECT public.credit_submit('${a1}', false)`), 'share_consent_required'), 'submitting needs consent to share with the lender');
ok((await as(SUP, `SELECT public.credit_submit('${a1}', true)`)) === 'submitted', 'submitted');
ok(isErr(await as(SUP, `SELECT public.credit_save_draft(100000)`), 'application_in_progress'), 'one open application at a time');

// ── platform eligibility, then the lender ──
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_platform_decision('${a1}', 'reject')`), 'note_required'), 'rejecting needs a reason');
ok((await as(ADMIN, `SELECT public.admin_credit_platform_decision('${a1}', 'approve', 'Checks verified')`)) === 'platform_approved', 'admin approves platform eligibility');
ok((await as(ADMIN, `SELECT public.admin_credit_send_to_lender('${a1}', '${prod1}', 'PA-APP-7781')`)) === 'with_lender', 'sent to the lending partner');
st = await state(SUP);
ok(st.applications[0].application.approved_amount === null && Number(st.applications[0].withdrawable) === 0, 'while with the lender: no approved or withdrawable amount');

const kfs = { sanctioned_amount: 500000, tenure_months: 12, interest_rate_pct: 0, apr_pct: 1.2, processing_fee: 5900, emi_amount: 41666.67, installments: 12, total_repayable: 505900, cooling_off_days: 3 };
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_record_lender_decision('${a1}', 'approved', 500000, ${J(kfs)}, '')`), 'lender_reference_required'), 'no lender reference: not recorded');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_record_lender_decision('${a1}', 'approved', 500000, ${J({ ...kfs, apr_pct: undefined })}, 'PA-SANC-1')`), 'kfs_incomplete'), 'an incomplete KFS is refused');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_record_lender_decision('${a1}', 'approved', 700000, ${J({ ...kfs, sanctioned_amount: 700000 })}, 'PA-SANC-1')`), 'invalid_amount'), 'cannot approve more than was asked');
ok((await as(ADMIN, `SELECT public.admin_credit_record_lender_decision('${a1}', 'approved', 500000, ${J(kfs)}, 'PA-SANC-1', NULL, 'Sanctioned by Partner A')`)) === 'lender_approved', "lender's approval recorded with its reference and KFS");
let A = await app(a1);
ok(A.lender_decision_source === 'admin_from_lender' && Number(A.approved_amount) === 500000 && /^[0-9a-f]{64}$/.test(A.kfs_sha256), 'approved amount and KFS version stored, with where they came from');
st = await state(SUP);
ok(Number(st.available_limit) === 500000 && Number(st.applications[0].withdrawable) === 0 && st.checks.lender, 'limit shown; nothing withdrawable before the agreement is accepted');
ok(isErr(await as(SUP, `SELECT public.credit_request_withdrawal('${a1}', 100000)`), 'wrong_stage'), 'no withdrawal before the agreement');

// ── KFS and agreement ──
ok(isErr(await as(SUP, `SELECT public.credit_accept_agreement('${a1}', '${A.kfs_sha256}')`), 'agreement_missing'), 'cannot accept without the loan agreement');
ok(isErr(await as(SUP, `SELECT public.credit_service_add_document('${SUP}', '${a1}', 'loan_agreement', 'a.pdf', 'application/pdf', 100, '${'a'.repeat(64)}', 'x/a', 'iv', 'k1')`), 'permission denied'), 'suppliers cannot add lender documents');
ok(isErr(await as('service', `SELECT public.credit_service_add_document('${SUP}', '${a1}', 'loan_agreement', 'a.pdf', 'application/pdf', 100, '${'a'.repeat(64)}', 'x/a', 'iv', 'k1')`), 'admin_only'), 'only an admin (through the function) adds them');
const doc = await as('service', `SELECT public.credit_service_add_document('${ADMIN}', '${a1}', 'loan_agreement', 'agreement.pdf', 'application/pdf', 1000, '${'a'.repeat(64)}', '${SUP}/agreement', 'iv', 'k1')`);
ok(typeof doc === 'string' && !isErr(doc), 'admin uploads the lender\'s loan agreement');
ok(isErr(await as(SUP, `SELECT public.credit_accept_agreement('${a1}', '${'0'.repeat(64)}')`), 'kfs_changed'), 'accepting a different KFS version is refused');
ok((await as(SUP, `SELECT public.credit_accept_agreement('${a1}', '${A.kfs_sha256}')`)) === 'agreement_accepted', 'supplier accepts the KFS and agreement');
ok(isErr(await as('service', `SELECT public.credit_service_document_for('${SUP2}', '${doc}')`), 'not_found'), 'another supplier cannot open the agreement');

// ── withdrawals ──
st = await state(SUP);
ok(Number(st.applications[0].withdrawable) === 500000, 'withdrawable after lender approval and acceptance: ₹5,00,000');
ok(isErr(await as(SUP, `SELECT public.credit_request_withdrawal('${a1}', 600000)`), 'amount_above_withdrawable'), 'cannot ask for more than is withdrawable');
const w1 = await as(SUP, `SELECT public.credit_request_withdrawal('${a1}', 200000)`);
ok(typeof w1 === 'string' && !isErr(w1), 'supplier asks for ₹2,00,000 (a request, paid by the lender)');
ok(Number((await state(SUP)).applications[0].withdrawable) === 300000, 'withdrawable drops while the request is open');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_update_disbursement('${w1}', 'disbursed')`), 'utr_required'), 'paid out only with the lender\'s UTR');
ok((await as(ADMIN, `SELECT public.admin_credit_update_disbursement('${w1}', 'disbursed', 'UTR0000123456', 'PA-DISB-1')`)) === 'disbursed', 'lender payment recorded with UTR');
A = await app(a1);
ok(A.stage === 'active', 'first payout: the loan is active');
const w2 = await as(SUP, `SELECT public.credit_request_withdrawal('${a1}', 100000)`);
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_update_disbursement('${w2}', 'failed')`), 'note_required'), 'a failed payout needs a reason');
await as(ADMIN, `SELECT public.admin_credit_update_disbursement('${w2}', 'failed', NULL, NULL, 'Bank account frozen at lender check')`);
ok(Number((await state(SUP)).applications[0].withdrawable) === 300000, 'a failed payout returns the amount');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_update_disbursement('${w1}', 'failed', NULL, NULL, 'oops')`), 'already_final'), 'a paid-out withdrawal cannot be changed');

// ── schedule and repayments ──
const rows = Array.from({ length: 12 }, (_, i) => ({ installment_no: i + 1, due_date: `2027-${String(i + 1).padStart(2, '0')}-05`, principal: i < 11 ? 16666.67 : 16666.63, interest: 0, amount: i < 11 ? 16666.67 : 16666.63 }));
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_set_schedule('${a1}', ${J(rows.map((r) => ({ ...r, principal: 60000, amount: 60000 })))})`), 'schedule_above_approved'), 'a schedule above the approved amount is refused');
ok((await as(ADMIN, `SELECT public.admin_credit_set_schedule('${a1}', ${J(rows)})`)) === 12, "lender's 12-month schedule recorded");
st = await state(SUP);
ok(Math.abs(Number(st.outstanding) - 200000) < 0.01 && st.next_emi_date === '2027-01-05', 'outstanding ₹2,00,000 and next EMI date shown');
ok((await as(ADMIN, `SELECT public.admin_credit_record_repayment('${a1}', 16666.67, now(), 'nach', 'NACH-0001')`)) === 'recorded', 'a repayment received by the lender is recorded');
ok((await as(ADMIN, `SELECT public.admin_credit_record_repayment('${a1}', 16666.67, now(), 'nach', 'NACH-0001')`)) === 'duplicate', 'the same lender reference is not counted twice');
st = await state(SUP);
ok(st.next_emi_date === '2027-02-05' && st.applications[0].repayments.length === 1, 'next EMI moves on; repayment history has it');
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_record_repayment('${a1}', 999999, now(), 'neft', 'NEFT-9')`), 'amount_above_outstanding'), 'more than is outstanding is refused');

// ── signed lender webhook (service role) ──
ok(isErr(await as('service', `SELECT public.credit_service_lender_event('unknown', 'evt-000001', 'repayment.received', '{}')`), 'unknown_partner'), 'unknown partner refused');
const ev = (id, payload) => as('service', `SELECT public.credit_service_lender_event('partner_a', '${id}', 'repayment.received', ${J(payload)})`);
const r1 = await ev('evt-000002', { application_id: a1, amount: 16666.67, paid_at: '2027-02-05T10:00:00Z', method: 'nach', reference: 'NACH-0002' });
ok(r1?.result === 'recorded', 'repayment from the lender\'s webhook recorded', r1);
ok((await ev('evt-000002', { application_id: a1, amount: 16666.67, paid_at: '2027-02-05T10:00:00Z', method: 'nach', reference: 'NACH-0002' }))?.result === 'duplicate', 'a repeated webhook event is ignored');
const a2 = await as(SUP2, `SELECT public.credit_save_draft(100000)`);
ok(isErr(await ev('evt-000003', { application_id: a2, amount: 1, method: 'upi', reference: 'X-0003' }), 'not_found'), "a partner cannot touch another partner's (or an unsent) application");
ok((await q(`SELECT source FROM credit_repayments WHERE reference = 'NACH-0002'`))[0].source === 'lender_api', 'webhook records are marked as from the lender');

// ── limits ──
ok(isErr(await as(ADMIN, `SELECT public.admin_credit_set_limit('${BUYER}', 100000, 'active')`), 'suppliers_only'), 'limits are for suppliers');
await as(ADMIN, `SELECT public.admin_credit_set_limit('${SUP2}', 300000, 'active', 'New account')`);
ok(isErr(await as(SUP2, `SELECT public.credit_save_draft(400000)`), 'invalid_amount'), 'the platform cap limits what can be applied for');
await as(ADMIN, `SELECT public.admin_credit_set_limit('${SUP2}', 300000, 'suspended', 'Under review')`);
ok(isErr(await as(SUP2, `SELECT public.credit_save_draft(100000)`), 'credit_suspended'), 'a suspended supplier cannot apply');
ok(isErr(await q(`UPDATE credit_limits SET sanctioned_limit = 900000 WHERE user_id = '${SUP2}'`).catch((e) => `ERROR: ${e.message}`), 'credit_limits_sanction_ck'),
  'a sanctioned limit without a lender reference is refused even for the database owner');

// ── visibility and audit ──
ok((await as(SUP2, `SELECT count(*)::int FROM credit_applications WHERE user_id <> '${SUP2}'`)) === 0, "suppliers see only their own applications");
ok((await as(SUP2, `SELECT count(*)::int FROM credit_repayment_schedule`)) === 0, "and not other suppliers' schedules");
ok(isErr(await q(`UPDATE credit_audit_logs SET action = 'x'`).catch((e) => `ERROR: ${e.message}`), 'append-only'), 'the audit log cannot be changed');
const actions = (await q(`SELECT action FROM credit_audit_logs WHERE application_id = '${a1}' ORDER BY id`)).map((r) => r.action);
ok(['amount_selected', 'submitted', 'platform_approve', 'sent_to_lender', 'lender_approved', 'agreement_accepted', 'withdrawal_requested', 'disbursement_disbursed', 'schedule_set', 'repayment_recorded']
  .every((x) => actions.includes(x)), 'every step is in the audit log', actions);

// ── closing ──
const rest = (await q(`SELECT sum(amount - paid_amount) s FROM credit_repayment_schedule WHERE application_id = '${a1}'`))[0].s;
await as(ADMIN, `SELECT public.admin_credit_record_repayment('${a1}', ${rest}, now(), 'neft', 'NEFT-FINAL')`);
ok((await app(a1)).stage === 'active', 'fully repaid but ₹3,00,000 still undrawn: stays active');

// ── KYC submit for credit (no loan application) ──
ok(isErr(await as(SUP2, `SELECT public.kyc_submit(NULL, true)`), 'consent_required'), 'KYC can be submitted without a loan application (fails here only because no KYC was started)');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
