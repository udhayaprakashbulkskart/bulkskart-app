# Business loan KYC

KYC is the stage after a loan request from the loan calculator. The loan calculator, the EMI maths and the loan
request form are unchanged. After submitting a request, the applicant is sent on to KYC.

```
Loan request ──► KYC (5 steps) ──► Verification ──► Lending partner review ──► Loan decision
(calculator)     applicant          BulkSkart         admin sends it to a        the partner decides;
                                    reviewer          bank / NBFC                an admin records it
```

**BulkSkart is not the lender.** The screens say so, and the database has no "approved by BulkSkart" state. An admin
can only record the lending partner's own decision (`approved_by_partner` or `declined_by_partner`), together with the
partner's name.

## Screens

**`/dashboard/loans`** — the applicant (buyers and manufacturers; menu: *Business Loan*):
- the applications, each with its progress bar, its lending partner and the partner's decision;
- the KYC status (overall and per step), the missing documents, next steps, and the verification history;
- the KYC consent, which must be accepted before any data is collected;
- the 5-step wizard:
  1. **PAN.**
  2. **Aadhaar through DigiLocker.**
  3. **Business:** GSTIN, Udyam, CIN or LLPIN, and business PAN, depending on the type of business.
  4. **Bank account.**
  5. **Review & submit:** includes a second consent to share the KYC with the lending partner.
- uploads in JPG, PNG or PDF.

**`/dashboard/admin/loan-kyc`** — admins (menu: *Loan KYC*):
- queues: To review, Resubmission, KYC in progress, KYC verified, With partner, Decided, Rejected, Withdrawn;
- per application: the applicant, every step with its details, documents to view, accept, reject or ask again for,
  the checks, and the audit log;
- per step: *Verify from documents* (never for Aadhaar), *Request resubmission*, *Reject*, *Reopen*;
- KYC decision: *Approve* (only when all four steps are verified), *Request resubmission*, *Reject* (final, with a
  reason), *Reopen*;
- lending partner: *Mark as sent* (partner name and reference), then *Record partner's decision*;
- retention settings and *Delete expired documents now*.

Every rejection or resubmission request needs a reason, and the applicant sees it.

## Statuses

The overall KYC status and each step use the same six values:

| Value | Shown as |
| --- | --- |
| `not_started` | Not Started |
| `pending` | Pending |
| `in_progress` | Verification In Progress |
| `verified` | Verified |
| `rejected` | Rejected |
| `resubmission_required` | Resubmission Required |

A check that cannot run because a service is not configured is recorded as **Integration Pending** and shown with that
label.

## What can make something "verified"

Only two things can mark a step verified. The database enforces both (migration 00075):
1. **A check by the provider in its production environment**, recorded by the `kyc` edge function with the service
   role. Sandbox (test) answers are stored as `test_only` and never verify. The function treats an answer as valid only
   when it has the exact fields the provider documents as valid:
   - PAN: `valid: true` and `pan_status: VALID`;
   - bank: `account_status: VALID` and `ACCOUNT_IS_VALID`;
   - GSTIN: an active status;
   - DigiLocker: `SUCCESS`.

   A valid answer with a weak name match goes to an admin. Anything unexpected is an error.
2. **An admin who accepted a document for that step and chose *Verify from documents*.** It is labelled "verified by a
   BulkSkart reviewer from your documents". This route is not available for Aadhaar.

Applicants cannot write any KYC table. All changes go through functions that check the caller. Every function call is
written to `kyc_audit_logs`, which cannot be updated or deleted.

## Aadhaar: DigiLocker only

Cashfree's documentation (read 24 Nov 2026) says OTP-based offline Aadhaar (OKYC) verification "is no longer
compliant" and has been withdrawn. Aadhaar is therefore verified only through **DigiLocker**:
- The applicant is sent to DigiLocker's own site, signs in there, and chooses to share their Aadhaar. BulkSkart never
  sees the OTP or PIN.
- DigiLocker sends the applicant back to `/dashboard/loans?kyc=aadhaar&ref=…`, and the edge function fetches the
  result.
- Only the **name and the last 4 digits** are kept. The photo, date of birth, address and XML are dropped before
  anything is stored.
- If the Aadhaar name does not match the PAN name closely, an admin reviews it.

## Data protection

- **In transit:** HTTPS everywhere, from the browser to the edge function and on to the provider.
- **At rest:**
  - Documents are encrypted with **AES-256-GCM** in the edge function before upload, and stored in the private bucket
    `kyc-documents`. That bucket has no storage policies, so only the service role can reach it.
  - Full PAN, business PAN and bank account numbers are encrypted the same way and stored in `kyc_private.secrets`.
    That schema is not exposed by the API, and even admins cannot read it.
  - The readable tables keep only a masked value (`ABXXXXXX4F`, last 4 digits) and an HMAC, used to match the PAN in a
    GSTIN.
  - The key, `KYC_ENCRYPTION_KEY`, is held only by the edge function, not by the database.
- **Access:**
  - Applicants read only their own rows (row-level security). Admins read everything.
  - A document is opened through the edge function, which checks that the caller is the owner or an admin and logs
    every opening.
  - File types are checked from the file's bytes, not its name.
- **Consent:**
  - The consent text is versioned. Its SHA-256 and the time are stored, and a changed text needs new consent.
  - Aadhaar has its own consent at the DigiLocker step.
  - Sharing with the lending partner needs a separate confirmation when the applicant submits.
- **Retention:**
  - Documents are deleted 1,825 days after submission or after the partner's decision.
  - They are deleted after 180 days if the application is never submitted or is withdrawn.
  - Both periods can be set in the admin page.
  - *Delete expired documents now* deletes the files and marks the records `purged`.
- **Never stored:** Aadhaar OTPs, DigiLocker credentials, the full Aadhaar number, or the Aadhaar photo, date of birth
  and address.

## Tables (migration `00075_loan_kyc.sql`)

| Table | Holds |
| --- | --- |
| `loan_applications` | One per loan request: amount, stage, sharing consent, lending partner, the partner's decision |
| `kyc_profiles` | One per applicant: status per step, masked numbers, names returned by the checks, consent, review |
| `kyc_documents` | Encrypted uploads: type, size, SHA-256, review status and note, delete-after date |
| `verification_requests` | Every provider check and admin document review: outcome, environment, message, minimal result |
| `bank_verifications` | Account holder, last 4 digits, IFSC, bank name, name at bank, how it was verified |
| `kyc_audit_logs` | Append-only log of every action, with who did it |
| `kyc_settings` | Retention periods, largest file size, consent version |
| `kyc_private.secrets` | Encrypted PAN, business PAN and bank account number (no API access) |

`loan_requests` gains `claim_token_hash`. A visitor who requests a loan before signing in keeps a random token in
their browser. After they sign in, `/dashboard/loans` uses it to attach the request to their account.

## Setup

1. **Database.** Run `supabase/migrations/00075_loan_kyc.sql` in the Supabase SQL editor. It is one transaction and safe
   to run again. Until it runs, the loan form keeps working: it retries without the new column.
2. **Edge function.** Copy `supabase/functions/kyc/` (`index.ts`, `core.ts`, `validate.ts`) to the server's edge-runtime
   functions folder, next to `razorpay-verify-payment`, and restart the functions service. CI does not deploy edge
   functions.
3. **Secrets.** Put these in the functions service's environment on the server, never in GitHub or the website:

   | Name | Value |
   | --- | --- |
   | `KYC_ENCRYPTION_KEY` | Required. 32 random bytes, base64: `openssl rand -base64 32`. Keep a safe copy: files cannot be decrypted without it. |
   | `CASHFREE_VERIFICATION_CLIENT_ID`, `CASHFREE_VERIFICATION_CLIENT_SECRET` | From the Cashfree Secure ID dashboard. |
   | `CASHFREE_VERIFICATION_ENV` | `sandbox` while testing, then `production`. Sandbox never verifies anyone. |
   | `CASHFREE_VERIFICATION_PUBLIC_KEY` | Optional. The PEM public key, if the account uses signature 2FA instead of whitelisting the server's IP. |
   | `KYC_DISABLED_CHECKS` | Optional, e.g. `aadhaar` while DigiLocker is not enabled on the Cashfree account. |

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already set for the other functions.

**What runs with what configured:**
- **Nothing configured:** the pages work and every check shows **Integration Pending**. Nothing is uploaded and nothing
  is verified.
- **Encryption key only:** uploads and admin document review work, and provider checks stay pending.
- **Key and provider keys:** the checks run as well.

**Not checked by a provider:** Udyam and CIN. The provider's Udyam and CIN APIs were not confirmed, so these are
verified by a reviewer from the uploaded certificates.

## Compliance notes

- The lending partner is the regulated entity under the RBI's digital lending rules. Agree with each partner which
  documents and checks they rely on before forwarding applications.
- Have the consent text reviewed for the Digital Personal Data Protection Act. Change `CONSENT_VERSION` in
  `src/lib/loanKyc/api.ts` and `kyc_settings.consent_version` together when it changes.

## Tests

| Where | What | Result (24 Nov 2026) |
| --- | --- | --- |
| `docs/loan-kyc/sql-tests/kyc_check.mjs` | The migration on PGlite with Supabase roles: permissions, consent, "verified" rules (sandbox, provider, Aadhaar), documents, submission, resubmission, admin review, partner hand-off and decision, rejection, audit log, retention, account deletion | 88 / 88 |
| `src/__tests__/loanKycCore.test.ts` | Format checks, file sniffing, integration status, AES-GCM and HMAC, Cashfree signature, and reading the provider's documented example answers (PAN, GSTIN, bank, DigiLocker) | 26 / 26 |
| Browser (Playwright, stubbed API) | `/dashboard/loans` and `/dashboard/admin/loan-kyc`, phone and desktop, dark and light | no overflow, no page errors |

Run the database checks with:

```bash
cd docs/loan-kyc/sql-tests
npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17
node kyc_check.mjs
```

**Not tested here:**
- Real calls to the provider, which need its keys.
- The edge function inside the Deno edge runtime. It was type-checked with Deno's imports stubbed.
- Uploads to the real storage server.

Start with `CASHFREE_VERIFICATION_ENV=sandbox` and one test application.
