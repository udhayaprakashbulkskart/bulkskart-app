# BulkSkart Business Credit

Business credit for paid manufacturers, offered by a **regulated lending partner** (a bank or an RBI-registered NBFC).
BulkSkart is not the lender. BulkSkart checks platform eligibility, collects KYC and hands the application to the
partner. The partner:
- decides whether to lend and how much;
- issues the Key Fact Statement (KFS) and the loan agreement;
- pays the money straight into the supplier's verified bank account;
- collects the repayments.

## Screens

**Supplier: `/dashboard/supplier/credit`** (menu: *Business Credit*; also `/dashboard/manufacturer/credit`; open to unpaid
manufacturers so they can see what they need):
- **Offer:** "Business credit up to ₹15,00,000*" and a 12-month repayment.
  - **0% interest** is shown only when the partner's product has a 0% rate confirmed in writing, with its reference
    recorded.
  - Otherwise the page says interest and fees are set out in the lender's KFS.
  - The footnote names the lender and its RBI registration, or says *Integration Pending* while no partner is live.
- **Figures:** available credit limit, eligible credit amount, applied amount, approved amount, withdrawable amount,
  outstanding balance, next EMI date, and repayments.
  - Each figure says whose it is, e.g. "You can apply for up to this; not an approval" or "Only after the lender
    approves".
- **The 8 steps:**
  1. Check eligibility.
  2. Select amount.
  3. KYC and business verification.
  4. Submit.
  5. Lender approval.
  6. KFS and agreement.
  7. Withdraw.
  8. Repay.
- **Eligibility checker:** the five conditions. Each one that is not met has a link to fix it.
- **Amount:** a slider and an amount box, an EMI estimate only when 0% is confirmed, and consent to share with the
  lender.
- **Application:** a timeline, and *Cancel* until the agreement is accepted.
- **KFS and agreement:**
  - The lender's figures: amount, tenure, rate, APR, processing fee, EMI, total repayable, cooling-off period,
    reference, and the lender's grievance officer.
  - The agreement PDF, or a link to the lender's own site.
  - *Accept*.
- **Withdraw:** asks the lender to pay out. A withdrawal shows as **Paid** only once the lender's UTR is recorded.
- **Repayment schedule and history**, and an activity log.

**Admin: `/dashboard/admin/credit`** (menu: *Business Credit*):
- **Applications:** queues (eligibility review, to send, with lender, awaiting agreement, payout requests, active,
  drafts, closed). For each application:
  1. Approve or reject platform eligibility. The five checks are recomputed live, and a rejection needs a reason.
  2. Mark it as sent to the partner's product.
  3. Record the lender's decision. This needs the lender's reference and every KFS field, with the sanctioned amount
     equal to the approved amount.
  4. Upload the lender's documents (KFS, agreement, sanction letter), stored encrypted.
  5. For each payout request: *Sent to lender*, *Paid* (needs the UTR) or *Failed* (needs a reason).
  6. Set the repayment schedule: worked out from the KFS for comparison, then saved only after ticking "matches the
     lender's schedule".
  7. Record repayments, using the lender's reference.
  8. Set the supplier's cap or suspend them.
  9. See the audit log.
- **Credit limits:** every supplier's cap, the sanctioned limit (from the lender) and the status.
- **Lending partners:**
  - **Partners:** add or edit them. A partner can go live only with its RBI registration number and grievance officer.
  - **Products:** min/max amount, tenure, rate, processing fee. A product goes live only under a live partner. Tick
    "rate confirmed" only with the partner's written reference.
  - **Integration:** manual, or API (the signed webhook).

## Eligibility (computed from live records)

| Check | Source |
| --- | --- |
| Active paid subscription | `is_supplier_subscribed` (an active subscription on the supplier's company) |
| KYC verification completed | `kyc_profiles.status = 'verified'` (00076; done at `/dashboard/loans?for=credit`) |
| Verified business profile | `companies.verification_status = 'verified'` |
| Verified bank account | the current `bank_verifications` row is `verified` |
| Lending partner approval | a lender decision recorded with the lender's reference |

The first four are needed to submit and to pass platform review. The fifth comes only from the lender.

## Rules the database enforces (`00077_business_credit.sql`)

- Suppliers read only their own rows and write nothing directly. Partners and products are visible only when live.
  Every change goes through a function that checks the caller and writes `credit_audit_logs`, which is append-only.
- An **approved amount** exists only with a lender decision that has:
  - the lender's reference;
  - a source (`lender_api` or `admin_from_lender`);
  - a complete KFS.

  It cannot be more than the amount applied for. These are CHECK constraints, so they hold even for direct SQL.
- **Withdrawable** = approved − requested − paid out. It applies only after the supplier accepts the agreement, and
  only the KFS version they were shown (by its SHA-256). A payout is **disbursed** only with a UTR. A failed payout
  returns the amount.
- A **sanctioned limit** needs the lender's reference. Admins can only set BulkSkart's own cap and suspend.
- The **repayment schedule** cannot exceed the approved amount. Repayments are applied to the oldest instalment first;
  a repeated lender reference is ignored. A loan closes when it is fully repaid and nothing more can be drawn.
- **0% interest** is shown only for a live product whose rate was confirmed with a written reference.
- KYC can be submitted for credit without a loan application. `kyc_submit` is replaced in 00077.

## Lender integration

**Manual mode.** Admins copy the lender's decision, documents, payouts (UTR), schedule and repayments from the lender's
records. Every entry is labelled `admin_from_lender`.

**API mode.** The partner calls the `credit-lender-webhook` edge function. Records are labelled `lender_api`.

```
POST https://www.bulkskart.com/functions/v1/credit-lender-webhook?partner=<code>
X-BulkSkart-Timestamp: <unix seconds>
X-BulkSkart-Signature: v1=<hex HMAC-SHA256("<timestamp>.<raw body>", CREDIT_WEBHOOK_SECRET_<CODE>)>

{ "id": "<unique event id>", "type": "<type>", "data": { … } }
```

| Type | `data` |
| --- | --- |
| `application.decision` | `application_id`, `decision` (`approved` / `rejected`), `lender_reference`, and for approvals `approved_amount`, `kfs` { sanctioned_amount, tenure_months, interest_rate_pct, apr_pct, processing_fee, emi_amount, installments, total_repayable, cooling_off_days }, optional `agreement_url` (https), `note` |
| `disbursement.update` | `disbursement_id`, `status` (`sent_to_lender` / `disbursed` / `failed`), `utr` (required for disbursed), `lender_reference`, `disbursed_at`, `note` |
| `schedule.set` | `application_id`, `installments` [{ installment_no, due_date, principal, interest, amount }] |
| `repayment.received` | `application_id`, `amount`, `paid_at`, `method` (nach, upi, neft, rtgs, imps, cheque, other), `reference` |

The webhook refuses a request when:
- the signature is wrong;
- the timestamp is more than 5 minutes off;
- the partner is unknown or not set to API mode;
- the application belongs to another partner.

Each event id is processed once.

**Not yet automated:** sending an application *to* the partner. Each partner has its own intake API. Until one is wired
up, admins submit on the partner's portal and record its application reference with *Mark as sent*.

## Setup

1. **Database.** Run `00076_loan_kyc.sql`, then `00077_business_credit.sql` in the Supabase SQL editor. Both are one
   transaction and safe to run again.
2. **Edge functions.** Deploy two functions to the server's functions folder and restart the functions service. CI does
   not deploy edge functions.
   - `supabase/functions/kyc/`, updated with the lender documents.
   - `supabase/functions/credit-lender-webhook/`, which is new.
3. **Secrets.** Set these in the functions environment:
   - `KYC_ENCRYPTION_KEY`, already needed for KYC;
   - per API partner, `CREDIT_WEBHOOK_SECRET_<CODE>`, a long random value shared only with that partner.
4. **Partner.** In Admin → Business Credit → Lending partners, add the partner, then its product, then set both live.
5. **Merge.** Merge the `business-credit` branch. It contains `loan-kyc`.

## Compliance notes (for review with the partner and counsel)

- Under the RBI's digital lending rules, BulkSkart is a lending service provider:
  - the KFS comes from the lender before the agreement;
  - money moves directly between the lender and the borrower's bank account, never through BulkSkart;
  - the lender's name and grievance officer are shown to the borrower.

  The screens and the data model follow this. Confirm the details with the partner.
- A "0% interest" product usually has a subvention or fee arrangement. The APR in the KFS must show the true cost.
  Record the partner's written confirmation before marking the rate confirmed.

## Tests

| Where | What | Result (24 Nov 2026) |
| --- | --- | --- |
| `docs/business-credit/sql-tests/credit_check.mjs` | 00058 + 00076 + 00077 on PGlite with Supabase roles: access, program and 0% rule, partner/product go-live rules, eligibility, amounts, submission, platform review, lender decision (reference, KFS, amount), agreement acceptance (document, KFS version), withdrawals (UTR, failure), schedule, repayments (duplicates, over-payment), signed-webhook events (idempotency, partner isolation), limits, audit, KYC without a loan application | 76 / 76 |
| `src/__tests__/creditWebhook.test.ts` | Webhook signatures (tampering, wrong secret, replay window) and event validation | 6 / 6 |
| Browser (Playwright, stubbed API) | Supplier page (new supplier, active loan) and admin page, phone and desktop, dark and light | no overflow, no page errors |

Run the database checks with:

```bash
cd docs/business-credit/sql-tests
npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17
node credit_check.mjs
```

**Not tested here:**
- A real lending partner. No partner is connected, so nothing is approved or paid until one is.
- The edge functions in the Deno runtime. They were type-checked with Deno's imports stubbed.
