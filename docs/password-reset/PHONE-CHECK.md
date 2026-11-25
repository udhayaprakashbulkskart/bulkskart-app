# Forgot password: no e-mail link, no OTP (phone check by the team)

## How it works
1. On the login page, **Forgot password?** asks for the e-mail, the mobile number and the **new password** (twice), then **Save new password**.
   Only a bcrypt hash of the new password is stored, never the password itself.
2. Every admin gets a notification. **Dashboard → Admin → Password Resets** lists the request with the mobile number registered on the
   account (tap to call) and warns when the typed number is different.
3. The admin calls the **registered** number. If the owner confirms, tick "I called…", then **Approve new password**: the new password
   works at once and the account is signed out on every device. **Reject** discards it. The owner gets a "Your password was changed" notice.

Rules: a request lasts 48 hours; a newer request replaces an older one; 3 requests per e-mail a day, 5 per IP address an hour,
60 in total an hour. Only a **super admin** can approve a reset of an **admin** account. The answer on the login page is the same
whether or not the e-mail has an account.

Why the call: without a link or a code, anyone who knows an e-mail address could otherwise take over that account (wallet, payouts,
bank and KYC details). The phone call is the proof that the owner asked.

## To switch it on
Run `supabase/migrations/00079_password_reset_requests.sql` once in the Supabase SQL editor (it is safe to run again).
Nothing else: no SMTP, no WhatsApp template, no edge function.

The login page says the team calls "usually within 2 hours"; change that text in
`src/components/auth/PasswordResetRequest.tsx` if your team works to a different time.

## Tests
- `src/__tests__/passwordResetRequest.test.tsx` (form and admin page)
- `docs/password-reset/sql-tests/reset_requests_check.mjs` (49 database checks on PGlite):
  `cd docs/password-reset/sql-tests && npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17 && node reset_requests_check.mjs`
