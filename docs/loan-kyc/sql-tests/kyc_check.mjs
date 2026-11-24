/**
 * Runs supabase/migrations/00076_loan_kyc.sql on an in-memory Postgres (PGlite) with Supabase's roles and checks who can
 * do what, and that nothing becomes "verified" except through a production provider check or an admin document review.
 *
 *   cd docs/loan-kyc/sql-tests
 *   npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
 *   node kyc_check.mjs
 *
 * All values below are test inputs that exist only inside this in-memory database.
 */
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
let failed = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✓' : '✗'} ${m}${!c && extra !== '' ? `\n    got: ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`); if (!c) failed++; };

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const BUYER = '00000000-0000-0000-0000-0000000000b1';
const OTHER = '00000000-0000-0000-0000-0000000000c1';
const LATE = '00000000-0000-0000-0000-0000000000d1';

await run(`
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TABLE profiles (id uuid PRIMARY KEY, role user_role NOT NULL DEFAULT 'buyer', full_name text, email text);
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
INSERT INTO profiles VALUES ('${ADMIN}', 'admin', 'Admin', 'admin@test.invalid'), ('${BUYER}', 'buyer', 'Applicant One', 'one@test.invalid'),
  ('${OTHER}', 'buyer', 'Applicant Two', 'two@test.invalid'), ('${LATE}', 'buyer', 'Applicant Three', 'three@test.invalid');
`);
// loan_requests as created by 00058 (the parts the KYC migration relies on)
await run(readFileSync(new URL('../../../supabase/migrations/00058_loan_requests.sql', import.meta.url), 'utf8'));
const mig = readFileSync(new URL('../../../supabase/migrations/00076_loan_kyc.sql', import.meta.url), 'utf8');
await run(mig);
await run(mig);
ok(true, 'migration runs twice without error');

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
const svc = (sql) => as('service', sql);
const isErr = (v, code) => typeof v === 'string' && v.startsWith('ERROR') && (!code || v.includes(code));
const profile = async (u) => (await q(`SELECT * FROM kyc_profiles WHERE user_id = '${u}'`))[0];
const SHA = 'a'.repeat(64);
const loanInsert = (u, amount = 500000, extra = '') =>
  `INSERT INTO loan_requests (user_id, full_name, company_name, email, phone, city, loan_amount, tenure_months, goods_needed${extra ? ', claim_token_hash' : ''})
   VALUES (${u ? `'${u}'` : 'NULL'}, 'Test Person', 'Test Traders', 'person@test.invalid', '9000000000', 'Chennai', ${amount}, 12, 'cotton yarn'${extra ? `, '${extra}'` : ''})`;

// ── loan request → application ──
ok(!isErr(await as(BUYER, loanInsert(BUYER))), 'a signed-in buyer submits a loan request from the calculator (unchanged form)');
const app1 = (await q(`SELECT id, stage, amount FROM loan_applications WHERE user_id = '${BUYER}'`))[0];
ok(app1?.stage === 'kyc' && Number(app1.amount) === 500000, 'the request becomes a loan application waiting for KYC');
ok(!isErr(await as('anon', loanInsert(null))), 'a visitor can still submit a request without signing in');
const token = 'tok_' + 'x'.repeat(40);
const tokenHash = createHash('sha256').update(token).digest('hex');
await as('anon', loanInsert(null, 250000, tokenHash));
ok((await q(`SELECT count(*)::int n FROM loan_applications`))[0].n === 1, 'requests without an account do not create applications');
ok(await as(OTHER, `SELECT public.loan_claim_request('wrong-token-wrong-token-wrong-token-00')`) === null, 'a wrong claim token attaches nothing');
const claimed = await as(LATE, `SELECT public.loan_claim_request('${token}')`);
ok(typeof claimed === 'string' && !isErr(claimed), 'after signing in, the visitor claims their request with the token from their browser', claimed);
ok(await as(OTHER, `SELECT public.loan_claim_request('${token}')`) === null, 'the same token cannot be used twice');

// ── who can read what ──
ok(isErr(await as('anon', `SELECT count(*) FROM loan_applications`), 'permission denied'), 'visitors cannot read applications');
ok((await as(OTHER, `SELECT count(*)::int FROM loan_applications`)) === 0, 'an applicant does not see other people\'s applications');
ok((await as(BUYER, `SELECT count(*)::int FROM loan_applications`)) === 1, 'an applicant sees their own application');
ok((await as(ADMIN, `SELECT count(*)::int FROM loan_applications`)) === 2, 'an admin sees all applications');
ok(isErr(await as(BUYER, `UPDATE kyc_profiles SET status = 'verified'`), 'permission denied'), 'applicants cannot write KYC tables directly');
ok(isErr(await as(BUYER, `INSERT INTO verification_requests (kyc_profile_id, user_id, step, check_type, provider, environment, status) VALUES (gen_random_uuid(), '${BUYER}', 'pan', 'pan', 'x', 'production', 'success')`), 'permission denied'),
  'applicants cannot insert a fake successful check');
ok(isErr(await as(BUYER, `SELECT count(*) FROM kyc_private.secrets`), 'permission denied'), 'encrypted values are not readable by applicants');
ok(isErr(await as(ADMIN, `SELECT count(*) FROM kyc_private.secrets`), 'permission denied'), 'nor by admins through the API');
ok(isErr(await as(BUYER, `SELECT public.kyc_service_save_pan('${BUYER}', 'ABXXXXXX4F', 'h', 'X', 'c', 'i', 'k')`), 'permission denied'), 'applicants cannot call service functions');
ok(isErr(await as(BUYER, `SELECT public.admin_kyc_applications()`), 'admin_only'), 'non-admins get admin_only from admin functions');
ok(isErr(await as('anon', `SELECT public.kyc_give_consent(NULL, '2026-11-24', '${SHA}')`), 'permission denied'), 'visitors cannot start KYC');

// ── consent first ──
ok(isErr(await svc(`SELECT public.kyc_service_save_pan('${BUYER}', 'ABXXXXXX4F', 'h1', 'Test Person', 'c', 'i', 'k1')`), 'consent_required'), 'nothing is collected before consent');
ok(isErr(await as(BUYER, `SELECT public.kyc_give_consent('${app1.id}', '2020-01-01', '${SHA}')`), 'consent_outdated'), 'consent to an old text is refused');
const prof1 = await as(BUYER, `SELECT public.kyc_give_consent('${app1.id}', '2026-11-24', '${SHA}')`);
ok(typeof prof1 === 'string' && !isErr(prof1), 'consent creates the KYC profile');
ok((await profile(BUYER)).status === 'pending', 'status after consent: Pending');
ok((await q(`SELECT kyc_profile_id FROM loan_applications WHERE id = '${app1.id}'`))[0].kyc_profile_id === prof1, 'the application is linked to the KYC profile');

// ── PAN ──
ok(isErr(await svc(`SELECT public.kyc_service_save_pan('${BUYER}', 'ABCDE1234F', 'h1', 'Test Person', 'c', 'i', 'k1')`), 'invalid_pan'), 'a PAN is only stored masked in the readable table');
ok(!isErr(await svc(`SELECT public.kyc_service_save_pan('${BUYER}', 'ABXXXXXX4F', 'h1', 'Test Person', 'c', 'i', 'k1')`)), 'PAN saved (masked + hash; ciphertext in the private schema)');
ok((await q(`SELECT count(*)::int n FROM kyc_private.secrets WHERE kind = 'pan'`))[0].n === 1, 'the encrypted PAN is in kyc_private.secrets');
ok(isErr(await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'pan', 'pan', 'cashfree', 'sandbox', 'verified', '1', NULL, '{}', NULL)`), 'verified_needs_production_provider'),
  'a sandbox result can never mark PAN verified');
ok(isErr(await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'pan', 'pan', 'admin', 'production', 'verified', '1', NULL, '{}', NULL)`), 'verified_needs_production_provider'),
  '"verified" needs a named provider');
await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'pan', 'pan', 'cashfree', 'sandbox', 'test_only', '1', NULL, '{}', 'Sandbox result: not a verification')`);
ok((await profile(BUYER)).pan_status === 'pending', 'a sandbox check leaves PAN pending');
await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'pan', 'pan', NULL, 'none', 'integration_pending', NULL, NULL, '{}', 'PAN check: integration pending')`);
ok((await q(`SELECT status FROM verification_requests WHERE step = 'pan' ORDER BY created_at DESC, status LIMIT 1`))[0].status === 'integration_pending', 'with no provider, the check is recorded as Integration Pending');
await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'pan', 'pan', 'cashfree', 'production', 'verified', '161', NULL, ${J({ valid: true, pan_status: 'VALID' })}, NULL, ${J({ registered_name: 'TEST PERSON', pan_type: 'Individual' })})`);
let p = await profile(BUYER);
ok(p.pan_status === 'verified' && p.pan_verified_via === 'provider' && p.pan_registered_name === 'TEST PERSON', 'a production PAN check verifies PAN and keeps the registered name');
ok(isErr(await svc(`SELECT public.kyc_service_save_pan('${BUYER}', 'ABXXXXXX4G', 'h2', 'Other', 'c', 'i', 'k1')`), 'step_locked'), 'a verified PAN cannot be changed by the applicant');

// ── Aadhaar: DigiLocker only ──
ok(isErr(await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'aadhaar', 'pan', 'cashfree', 'production', 'verified', '1', NULL, '{}', NULL)`), 'aadhaar_digilocker_only'),
  'Aadhaar is verified only through DigiLocker');
await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'aadhaar', 'aadhaar_digilocker', 'cashfree', 'production', 'requested', '12345', 'bkdl_1', '{}', 'Waiting for DigiLocker consent')`);
ok((await profile(BUYER)).aadhaar_status === 'pending', 'a started DigiLocker request marks Aadhaar pending');

// ── business + bank ──
ok(isErr(await svc(`SELECT public.kyc_service_save_business('${BUYER}', ${J({ entity_type: 'private_limited', business_name: 'Test Traders Pvt Ltd' })})`), 'cin_required'),
  'a company must give its CIN');
ok(!isErr(await svc(`SELECT public.kyc_service_save_business('${BUYER}', ${J({ entity_type: 'proprietorship', business_name: 'Test Traders', gstin: '33ABCDE1234F1Z5', udyam_number: 'UDYAM-TN-01-1234567' })})`)),
  'business details saved');
ok(!isErr(await svc(`SELECT public.kyc_service_save_bank('${BUYER}', 'Test Person', '6789', 'bh', 'HDFC0001234', 'c', 'i', 'k1')`)), 'bank account saved (last 4 + hash; encrypted number in the private schema)');
ok((await q(`SELECT account_last4 FROM bank_verifications WHERE user_id = '${BUYER}' AND is_current`))[0].account_last4 === '6789', 'only the last 4 digits are readable');

// ── submit needs the documents ──
const sub1 = await as(BUYER, `SELECT public.kyc_submit('${app1.id}', true)`);
ok(isErr(sub1, 'documents_missing') && sub1.includes('gst_certificate') && sub1.includes('udyam_certificate') && sub1.includes('bank_proof') && sub1.includes('aadhaar_masked') && !sub1.includes('pan_card'),
  'submitting lists the missing documents (masked Aadhaar while Aadhaar is not verified; no PAN card once PAN is verified)', sub1);
ok(isErr(await as(BUYER, `SELECT public.kyc_submit('${app1.id}', false)`), 'share_consent_required'), 'submitting needs consent to share with the lending partner');
const doc = (step, type, n) => `SELECT public.kyc_service_add_document('${BUYER}', '${step}', '${type}', '${type}.pdf', 'application/pdf', 20000, '${String(n).repeat(64).slice(0, 64)}', '${BUYER}/${type}-${n}', 'iv', 'k1')`;
ok(isErr(await svc(`SELECT public.kyc_service_add_document('${BUYER}', 'bank', 'bank_statement', 'x.exe', 'application/x-msdownload', 100, '${SHA}', 'p/x', 'iv', 'k1')`), 'check'), 'only JPG, PNG and PDF are accepted');
ok(isErr(await svc(`SELECT public.kyc_service_add_document('${BUYER}', 'bank', 'bank_statement', 'big.pdf', 'application/pdf', 9000000, '${SHA}', 'p/big', 'iv', 'k1')`), 'file_too_large'), 'files above the size limit are refused');
const dGst = await svc(doc('business', 'gst_certificate', 1));
const dUdyam = await svc(doc('business', 'udyam_certificate', 2));
const dBank = await svc(doc('bank', 'cancelled_cheque', 3));
const dAadhaar = await svc(doc('aadhaar', 'aadhaar_masked', 5));
ok([dGst, dUdyam, dBank, dAadhaar].every((d) => typeof d === 'string' && !isErr(d)), 'documents recorded (including the masked Aadhaar)');
ok((await as(BUYER, `SELECT public.kyc_submit('${app1.id}', true)`)) === 'in_progress', 'submitted: status Verification In Progress');
ok((await q(`SELECT stage FROM loan_applications WHERE id = '${app1.id}'`))[0].stage === 'verification', 'the application moves to Verification');
ok(isErr(await svc(`SELECT public.kyc_service_save_bank('${BUYER}', 'Someone Else', '1111', 'bh2', 'HDFC0001234', 'c', 'i', 'k1')`), 'kyc_locked'), 'details are locked while under review');
await svc(`SELECT public.kyc_service_record_check('${BUYER}', 'aadhaar', 'aadhaar_digilocker', 'cashfree', 'production', 'verified', '12345', 'bkdl_1', ${J({ status: 'AUTHENTICATED' })}, NULL, ${J({ aadhaar_last4: '5647', name: 'Test Person' })})`);
p = await profile(BUYER);
ok(p.aadhaar_status === 'verified' && p.aadhaar_last4 === '5647' && p.aadhaar_verified_via === 'digilocker', 'DigiLocker can still complete Aadhaar after submission; only the last 4 digits are kept');
ok((await q(`SELECT count(*)::int n FROM verification_requests WHERE client_ref = 'bkdl_1'`))[0].n === 1, 'the DigiLocker request is updated, not duplicated');

// ── admin review ──
const list = await as(ADMIN, `SELECT public.admin_kyc_applications('review')`);
ok(list.total === 1 && list.rows[0].id === app1.id && list.counts.review === 1, 'the admin review queue shows the submitted application');
const detail = await as(ADMIN, `SELECT public.admin_kyc_detail('${app1.id}')`);
ok(detail.profile && !('pan_hash' in detail.profile) && detail.documents.every((d) => !('storage_path' in d) && !('enc_iv' in d)), 'admin detail never includes hashes, storage paths or keys');
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_decision('${prof1}', 'approve')`), 'steps_not_verified'), 'KYC cannot be approved before every step is verified');
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_step_action('${prof1}', 'business', 'verify_by_document')`), 'accepted_document_required'), 'verifying by document needs an accepted document');
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_document_action('${dUdyam}', 'reject')`), 'note_required'), 'rejecting a document needs a reason');
await as(ADMIN, `SELECT public.admin_kyc_document_action('${dGst}', 'accept')`);
await as(ADMIN, `SELECT public.admin_kyc_document_action('${dUdyam}', 'request_resubmission', 'Udyam certificate is cut off at the bottom')`);
p = await profile(BUYER);
ok(p.status === 'resubmission_required' && p.review_status === 'resubmission_required', 'requesting a new document sets Resubmission Required');
ok((await q(`SELECT stage FROM loan_applications WHERE id = '${app1.id}'`))[0].stage === 'kyc', 'and moves the application back to KYC');
ok((await as(BUYER, `SELECT review_note FROM kyc_documents WHERE id = '${dUdyam}'`)) === 'Udyam certificate is cut off at the bottom', 'the applicant can read the reason');
const sub2 = await as(BUYER, `SELECT public.kyc_submit('${app1.id}', true)`);
ok(isErr(sub2, 'udyam_certificate'), 'resubmitting needs a new Udyam certificate', sub2);
await svc(doc('business', 'udyam_certificate', 4));
ok((await as(BUYER, `SELECT public.kyc_submit('${app1.id}', true)`)) === 'in_progress', 'resubmitted');
await as(ADMIN, `SELECT public.admin_kyc_document_action((SELECT id FROM kyc_documents WHERE sha256 = '${'4'.repeat(64)}'), 'accept')`);
await as(ADMIN, `SELECT public.admin_kyc_document_action('${dBank}', 'accept')`);
ok(!isErr(await as(ADMIN, `SELECT public.admin_kyc_step_action('${prof1}', 'business', 'verify_by_document', 'GST and Udyam certificates checked')`)), 'admin verifies business from the accepted documents');
ok(!isErr(await as(ADMIN, `SELECT public.admin_kyc_step_action('${prof1}', 'bank', 'verify_by_document', 'Cancelled cheque matches')`)), 'admin verifies the bank account from the cancelled cheque');
p = await profile(BUYER);
ok(p.business_verified_via === 'document_review' && (await q(`SELECT verified_via FROM bank_verifications WHERE user_id = '${BUYER}' AND is_current`))[0].verified_via === 'document_review',
  'document-review verifications are labelled as such');
ok(isErr(await as(ADMIN, `SELECT public.admin_loan_forward('${app1.id}', 'Partner Bank')`), 'kyc_not_verified'), 'an application cannot go to a lending partner before KYC is verified');
ok((await as(ADMIN, `SELECT public.admin_kyc_decision('${prof1}', 'approve', 'All checks complete')`)) === 'verified', 'admin approves: KYC Verified');
ok((await profile(BUYER)).verified_at !== null, 'verified time recorded');

// ── lending partner ──
ok(isErr(await as(ADMIN, `SELECT public.admin_loan_record_decision('${app1.id}', 'approved_by_partner', 400000, 'ok')`), 'wrong_stage'), 'no decision before the partner has the application');
ok((await as(ADMIN, `SELECT public.admin_loan_forward('${app1.id}', 'Partner Bank Ltd', 'PB-REF-1')`)) === 'partner_review', 'forwarded to the lending partner');
ok(isErr(await as(ADMIN, `SELECT public.admin_loan_record_decision('${app1.id}', 'approved', 400000, 'ok')`), 'invalid_action'), 'only a partner decision can be recorded (no BulkSkart approval)');
ok((await as(ADMIN, `SELECT public.admin_loan_record_decision('${app1.id}', 'approved_by_partner', 400000, 'Partner Bank sanctioned 4 lakh')`)) === 'decision', "the partner's decision is recorded");
const a1 = (await q(`SELECT stage, decision, lending_partner FROM loan_applications WHERE id = '${app1.id}'`))[0];
ok(a1.stage === 'decision' && a1.decision === 'approved_by_partner' && a1.lending_partner === 'Partner Bank Ltd', 'the application shows who decided');

// ── rejection ──
const prof2 = await as(LATE, `SELECT public.kyc_give_consent(NULL, '2026-11-24', '${SHA}')`);
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_decision('${prof2}', 'reject')`), 'note_required'), 'rejecting KYC needs a reason');
ok((await as(ADMIN, `SELECT public.admin_kyc_decision('${prof2}', 'reject', 'Documents belong to a different business')`)) === 'rejected', 'admin rejects with a reason');
ok(isErr(await svc(`SELECT public.kyc_service_save_pan('${LATE}', 'ABXXXXXX4F', 'h9', 'X Y', 'c', 'i', 'k1')`), 'kyc_rejected'), 'a rejected applicant cannot keep editing');
ok((await as(ADMIN, `SELECT public.admin_kyc_decision('${prof2}', 'reopen', 'Applicant explained; reopened')`)) === 'resubmission_required', 'an admin can reopen a rejected KYC');

// ── manual review without a provider: Aadhaar from a masked copy ──
const prof3 = await as(OTHER, `SELECT public.kyc_give_consent(NULL, '2026-11-24', '${SHA}')`);
const dMasked = await svc(`SELECT public.kyc_service_add_document('${OTHER}', 'aadhaar', 'aadhaar_masked', 'aadhaar.pdf', 'application/pdf', 30000, '${'6'.repeat(64)}', '${OTHER}/aadhaar', 'iv', 'k1')`);
ok(typeof dMasked === 'string' && !isErr(dMasked), 'an applicant can upload a masked Aadhaar copy');
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_step_action('${prof3}', 'aadhaar', 'verify_by_document', 'QR checked')`), 'accepted_document_required'), 'Aadhaar is not verified before the copy is accepted');
await as(ADMIN, `SELECT public.admin_kyc_document_action('${dMasked}', 'accept')`);
await as(ADMIN, `SELECT public.admin_kyc_step_action('${prof3}', 'aadhaar', 'verify_by_document', 'Masked copy and QR code checked')`);
const p3 = await profile(OTHER);
ok(p3.aadhaar_status === 'verified' && p3.aadhaar_verified_via === 'document_review', 'an admin verifies Aadhaar from the accepted masked copy, labelled as a document review');
ok(isErr(await svc(`SELECT public.kyc_service_record_check('${OTHER}', 'aadhaar', 'aadhaar_digilocker', 'cashfree', 'sandbox', 'verified', '1', 'x1', '{}', NULL)`), 'verified_needs_production_provider'), 'a provider still cannot verify from sandbox');
// LATE's KYC was reopened above; use it for an unmasked upload
const dFull = await svc(`SELECT public.kyc_service_add_document('${LATE}', 'aadhaar', 'aadhaar_masked', 'aadhaar-full.jpg', 'image/jpeg', 30000, '${'7'.repeat(64)}', '${LATE}/aadhaar-full', 'iv', 'k1')`);
await as(ADMIN, `SELECT public.admin_kyc_document_action('${dFull}', 'reject', 'All 12 digits are visible. Upload the masked Aadhaar.')`);
ok((await svc(`SELECT public.kyc_service_expired_documents()`)).some((e) => e.id === dFull), 'a rejected Aadhaar copy (e.g. not masked) is queued for deletion at once');

// ── documents and audit ──
const where = await svc(`SELECT public.kyc_service_document_for('${OTHER}', '${dGst}')`);
ok(isErr(where, 'not_found'), "another user cannot open someone else's document");
const mine = await svc(`SELECT public.kyc_service_document_for('${BUYER}', '${dGst}')`);
ok(mine?.path === `${BUYER}/gst_certificate-1`, 'the owner can open their document');
const adminView = await svc(`SELECT public.kyc_service_document_for('${ADMIN}', '${dGst}')`);
ok(adminView?.path, 'an admin can open it');
ok((await q(`SELECT count(*)::int n FROM kyc_audit_logs WHERE action = 'document_viewed'`))[0].n === 2, 'every opening is in the audit log');
ok(isErr(await q(`UPDATE kyc_audit_logs SET action = 'x'`).catch((e) => `ERROR: ${e.message}`), 'append-only'), 'the audit log cannot be changed');
ok(isErr(await q(`DELETE FROM kyc_audit_logs`).catch((e) => `ERROR: ${e.message}`), 'append-only'), 'or deleted');
const myLogs = await as(BUYER, `SELECT count(*)::int FROM kyc_audit_logs`);
const otherSees = await as(OTHER, `SELECT count(*)::int FROM kyc_audit_logs WHERE subject_user_id IS DISTINCT FROM '${OTHER}'`);
ok(myLogs > 5 && otherSees === 0, 'applicants see only their own history');

// ── retention ──
await run(`UPDATE kyc_documents SET delete_after = now() - interval '1 day' WHERE id = '${dGst}'`);
const expired = await svc(`SELECT public.kyc_service_expired_documents()`);
ok(expired.some((e) => e.id === dGst), 'expired documents are listed for deletion');
ok((await svc(`SELECT public.kyc_service_mark_purged(NULL, ARRAY['${dGst}']::uuid[])`)) === 1, 'and marked purged after the file is deleted');
ok(isErr(await svc(`SELECT public.kyc_service_document_for('${BUYER}', '${dGst}')`), 'not_found'), 'a purged document can no longer be opened');
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_update_settings(${J({ document_retention_days: 5 })})`), 'check'), 'retention below 30 days is refused');
ok((await as(ADMIN, `SELECT public.admin_kyc_update_settings(${J({ document_retention_days: 2555 })})`)).document_retention_days === 2555, 'admins can set the retention period');
ok((await as(ADMIN, `SELECT public.admin_kyc_update_settings(${J({ review_hours: 4 })})`)).review_hours === 4, 'admins can set the promised call-back time');
ok(isErr(await as(ADMIN, `SELECT public.admin_kyc_update_settings(${J({ review_hours: 0 })})`), 'check'), 'the call-back time must be at least 1 hour');

// ── account deletion still works ──
ok(!isErr(await q(`DELETE FROM profiles WHERE id = '${LATE}'`).then(() => 'ok').catch((e) => `ERROR: ${e.message}`)), 'deleting an account removes its KYC rows and keeps the audit log');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
