// Runs migrations 00062 and 00063 in an in-memory Postgres (PGlite) on a minimal copy of the schema, then walks
// through every payment, payout and factory-visit step, including attempts to cheat. Run before deploying them:
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/payments_scenarios.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const repo = new URL('../migrations/', import.meta.url).pathname;
const db = new PGlite();
await db.exec(readFileSync(here + 'payments_fixture.sql', 'utf8'));
await db.exec(readFileSync(repo + '00062_server_checked_payments_and_account_deletion.sql', 'utf8'));
await db.exec(readFileSync(repo + '00063_order_payments_and_factory_visits.sql', 'utf8'));
console.log('migrations applied');

const U = { B: '00000000-0000-4000-8000-0000000000b1', S: '00000000-0000-4000-8000-0000000000c1', A: '00000000-0000-4000-8000-0000000000a1', O: '00000000-0000-4000-8000-0000000000d1' };
let failures = 0;
const as = async (who) => {
  const claims = who === 'sql' ? '' : who === 'service' ? JSON.stringify({ role: 'service_role' }) : JSON.stringify({ sub: U[who], role: 'authenticated' });
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
};
const expectOk = async (label, sql, params = []) => {
  try { const r = await db.query(sql, params); console.log('ok   ', label); return r; }
  catch (e) { failures++; console.log('FAIL ', label, '->', e.message); }
};
const expectError = async (label, sql, params = [], match) => {
  try { await db.query(sql, params); failures++; console.log('FAIL ', label, '-> no error'); }
  catch (e) { if (match && !e.message.includes(match)) { failures++; console.log('FAIL ', label, '-> wrong error:', e.message); } else console.log('ok   ', label, '(refused:', e.message.slice(0, 70) + ')'); }
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const check = (label, cond, info) => { if (cond) console.log('ok   ', label); else { failures++; console.log('FAIL ', label, JSON.stringify(info)); } };

// ── setup (as the SQL editor) ──
await as('sql');
for (const [k, id] of Object.entries(U)) await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
await db.query(`INSERT INTO profiles (id, email, full_name, role) VALUES ($1,'b@x.in','Buyer','buyer'),($2,'s@x.in','Maker','supplier'),($3,'a@x.in','Admin','admin'),($4,'o@x.in','Other','buyer')`, [U.B, U.S, U.A, U.O]);
const C = (await one(`INSERT INTO companies (owner_id, company_name, bank_account_name, bank_account_number, bank_ifsc, bank_name) VALUES ($1,'Maker Works','Maker Works','1234567890','HDFC0001234','HDFC') RETURNING id`, [U.S])).id;
const R = (await one(`INSERT INTO requirements (buyer_id, title, quantity) VALUES ($1,'Cartons',100) RETURNING id`, [U.B])).id;
const Q = (await one(`INSERT INTO quotations (requirement_id, supplier_company_id, supplier_id, buyer_id, unit_price, status) VALUES ($1,$2,$3,$4,50,'accepted') RETURNING id`, [R, C, U.S, U.B])).id;
const Q2 = (await one(`INSERT INTO quotations (requirement_id, supplier_company_id, supplier_id, buyer_id, unit_price, total_price, status) VALUES ($1,$2,$3,$4,10,7777,'accepted') RETURNING id`, [R, C, U.S, U.B])).id;
const Qp = (await one(`INSERT INTO quotations (requirement_id, supplier_company_id, supplier_id, buyer_id, unit_price, status) VALUES ($1,$2,$3,$4,10,'pending') RETURNING id`, [R, C, U.S, U.B])).id;

// ── orders: price from the quotation ──
await as('B');
const ord = await expectOk('buyer places an order (trying to set price 1 and status released)',
  `INSERT INTO orders (quotation_id, requirement_id, buyer_id, supplier_company_id, total_amount, quantity, payment_status) VALUES ($1,$2,$3,$4,1,1,'released') RETURNING *`, [Q, R, U.B, C]);
const O1 = ord.rows[0];
check('total comes from quotation x requirement quantity (50 x 100)', Number(O1.total_amount) === 5000 && Number(O1.quantity) === 100 && O1.payment_status === 'pending', O1);
await expectError('order on a quotation not yet accepted', `INSERT INTO orders (quotation_id, buyer_id, supplier_company_id) VALUES ($1,$2,$3)`, [Qp, U.B, C], 'Accept');
await as('O');
await expectError("someone else uses the buyer's quotation", `INSERT INTO orders (quotation_id, buyer_id, supplier_company_id) VALUES ($1,$2,$3)`, [Q, U.O, C], 'quotation sent to you');
await as('B');
await expectError('buyer marks own order paid', `UPDATE orders SET payment_status='escrow' WHERE id=$1`, [O1.id], 'payment steps');
await expectError('buyer lowers the total', `UPDATE orders SET total_amount=10 WHERE id=$1`, [O1.id], 'payment steps');
await expectOk('buyer edits a note', `UPDATE orders SET notes='call before dispatch' WHERE id=$1`, [O1.id]);

// ── companies: balances and badges ──
await as('S');
await expectError('maker sets own balance', `UPDATE companies SET withdrawable_balance=99999 WHERE id=$1`, [C], 'payments and payouts');
await expectError('maker verifies self', `UPDATE companies SET verification_status='verified' WHERE id=$1`, [C], 'Verification');
await expectError('maker features self', `UPDATE companies SET is_featured=true WHERE id=$1`, [C], 'is_featured');
await expectOk('maker edits description', `UPDATE companies SET description='We make cartons' WHERE id=$1`, [C]);
await expectOk('maker submits documents (pending)', `UPDATE companies SET verification_status='pending' WHERE id=$1`, [C]);

// ── online payment, held, then released ──
await as('B');
await expectOk('buyer chooses online', `SELECT choose_order_payment_method($1,'online')`, [O1.id]);
await as('service');
await expectOk('payment server marks it held (verify-payment)', `UPDATE orders SET payment_status='escrow', paid_amount=total_amount, paid_at=now(), razorpay_payment_id='pay_1' WHERE id=$1`, [O1.id]);
await as('B');
await expectError('buyer releases before shipping', `SELECT release_order_payment($1)`, [O1.id], 'shipped');
await as('S');
await expectOk('maker marks shipped', `UPDATE orders SET order_status='shipped' WHERE id=$1`, [O1.id]);
await as('O');
await expectError('a stranger releases', `SELECT release_order_payment($1)`, [O1.id], 'not found');
await as('S');
await expectError('the maker releases to himself', `SELECT release_order_payment($1)`, [O1.id], 'not found');
await as('B');
const rel = await expectOk('buyer confirms delivery and releases', `SELECT release_order_payment($1) AS payout`, [O1.id]);
check('payout is 98% (4900)', rel && Number(rel.rows[0].payout) === 4900, rel?.rows);
await as('sql');
const after = await one(`SELECT o.payment_status, o.order_status, o.commission_amount, o.payout_amount, c.withdrawable_balance, c.total_revenue FROM orders o JOIN companies c ON c.id=o.supplier_company_id WHERE o.id=$1`, [O1.id]);
check('order released + delivered, 100 commission, balance 4900', after.payment_status === 'released' && after.order_status === 'delivered' && Number(after.commission_amount) === 100 && Number(after.withdrawable_balance) === 4900 && Number(after.total_revenue) === 4900, after);
check('delivery logged in status history', Number((await one(`SELECT count(*) n FROM order_status_history WHERE order_id=$1 AND to_status='delivered'`, [O1.id])).n) === 1);
check('payment events: method, released', Number((await one(`SELECT count(*) n FROM order_payment_events WHERE order_id=$1`, [O1.id])).n) === 2);
check('maker was notified', Number((await one(`SELECT count(*) n FROM notifications WHERE user_id=$1 AND title='Payment released to you'`, [U.S])).n) === 1);
await as('B');
await expectError('release twice', `SELECT release_order_payment($1)`, [O1.id], 'no held payment');

// ── payouts ──
await as('S');
await expectError('payout above balance', `SELECT request_payout(5000, null)`, [], 'up to your balance');
const pr = await expectOk('maker asks for 4000', `SELECT request_payout(4000, 'June') AS id`);
const P1 = pr.rows[0].id;
await as('sql');
const bal = await one(`SELECT withdrawable_balance FROM companies WHERE id=$1`, [C]);
check('balance reserved: 900 left', Number(bal.withdrawable_balance) === 900, bal);
check('admins notified of payout', Number((await one(`SELECT count(*) n FROM notifications WHERE user_id=$1 AND title='Payout requested'`, [U.A])).n) === 1);
check('bank details kept with the request', (await one(`SELECT bank_snapshot FROM withdrawal_requests WHERE id=$1`, [P1])).bank_snapshot.ifsc === 'HDFC0001234');
await as('S');
await expectError('maker approves own payout', `SELECT admin_resolve_payout($1, true, 'X', null)`, [P1], 'Only admins');
await as('A');
await expectError('admin approves without reference', `SELECT admin_resolve_payout($1, true, '', null)`, [P1], 'reference');
await expectOk('admin marks paid with UTR', `SELECT admin_resolve_payout($1, true, 'UTR998877', null)`, [P1]);
await expectError('settle twice', `SELECT admin_resolve_payout($1, false, null, null)`, [P1], 'not waiting');
await as('S');
const P2 = (await expectOk('maker asks for 900', `SELECT request_payout(900, null) AS id`)).rows[0].id;
await as('A');
await expectOk('admin rejects it', `SELECT admin_resolve_payout($1, false, null, 'Bank name mismatch')`, [P2]);
await as('sql');
check('rejected payout returns to balance (900)', Number((await one(`SELECT withdrawable_balance FROM companies WHERE id=$1`, [C])).withdrawable_balance) === 900);

// ── pay at the factory ──
await as('B');
const O2 = (await expectOk('buyer places second order (quote total 7777)', `INSERT INTO orders (quotation_id, requirement_id, buyer_id, supplier_company_id) VALUES ($1,$2,$3,$4) RETURNING *`, [Q2, R, U.B, C])).rows[0];
check('quote total used', Number(O2.total_amount) === 7777, O2);
await expectOk('buyer chooses pay at factory', `SELECT choose_order_payment_method($1,'at_factory')`, [O2.id]);
await expectError('buyer records factory payment himself', `SELECT confirm_factory_payment($1, 0, null)`, [O2.id], 'not found');
await as('S');
await expectOk('maker records cash received', `SELECT confirm_factory_payment($1, 0, 'Cash at gate')`, [O2.id]);
await as('sql');
const o2 = await one(`SELECT payment_status, paid_amount, commission_status FROM orders WHERE id=$1`, [O2.id]);
check('paid at factory, full amount, no commission', o2.payment_status === 'paid' && Number(o2.paid_amount) === 7777 && o2.commission_status === 'waived', o2);
check('balance unchanged by factory payment', Number((await one(`SELECT withdrawable_balance FROM companies WHERE id=$1`, [C])).withdrawable_balance) === 900);
await as('B');
await expectError('switch method after paying', `SELECT choose_order_payment_method($1,'online')`, [O2.id], 'already paid');

// ── factory visits ──
await as('B');
const V = (await expectOk('buyer books a visit in 2 days', `SELECT book_factory_visit($1, now() + interval '2 days', 3, 'See the line', '+91 98400 00000', null) AS id`, [C])).rows[0].id;
await expectError('visit in the past', `SELECT book_factory_visit($1, now() - interval '1 day', 1, null, null, null)`, [C], 'Pick a time');
await expectError('too many visitors', `SELECT book_factory_visit($1, now() + interval '2 days', 50, null, null, null)`, [C], 'Between 1 and 20');
await as('S');
await expectError('maker books own factory', `SELECT book_factory_visit($1, now() + interval '2 days', 1, null, null, null)`, [C], 'own company');
await as('O');
await expectError('stranger confirms', `SELECT respond_factory_visit($1, 'confirm', null, null)`, [V], 'not found');
await as('S');
await expectOk('maker confirms at another time', `SELECT respond_factory_visit($1, 'confirm', now() + interval '3 days', 'Mornings are better')`, [V]);
await as('sql');
const v = await one(`SELECT status, confirmed_at > requested_at AS moved FROM factory_visits WHERE id=$1`, [V]);
check('visit confirmed at the new time', v.status === 'confirmed' && v.moved === true, v);
check('buyer told about the visit', Number((await one(`SELECT count(*) n FROM notifications WHERE user_id=$1 AND title='Factory visit confirmed'`, [U.B])).n) === 1);
await as('B');
await expectOk('buyer cancels', `SELECT cancel_factory_visit($1)`, [V]);
await as('S');
await expectError('mark a cancelled visit done', `SELECT respond_factory_visit($1, 'complete', null, null)`, [V], 'confirmed');

// ── 00062 protections still hold ──
await as('sql');
const SUB = (await one(`INSERT INTO subscriptions (company_id, tier, status, used_rfq_leads) VALUES ($1,'starter','active',1) RETURNING id`, [C])).id;
await as('S');
await expectOk('maker counts an RFQ response', `UPDATE subscriptions SET used_rfq_leads = used_rfq_leads + 1 WHERE id=$1`, [SUB]);
await expectError('maker upgrades own plan', `UPDATE subscriptions SET tier='growth' WHERE id=$1`, [SUB], 'payment or an admin');
await expectError('maker resets usage', `UPDATE subscriptions SET used_rfq_leads = 0 WHERE id=$1`, [SUB], 'cannot go down');
await as('A');
await expectOk('admin changes a plan', `UPDATE subscriptions SET tier='growth' WHERE id=$1`, [SUB]);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
