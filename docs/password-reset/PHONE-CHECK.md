# Forgot password: no e-mail link, no OTP, no admin

## How it works
1. On the login page, **Forgot password?** asks for the e-mail, the **mobile number registered on the account** and the
   **new password** (twice), then **Save new password**.
2. **The number matches the account** → the new password works at once, the account is signed out on every device, and the
   owner gets a "Your password was changed" notice. No admin, no link, no code.
3. **It does not match** (or no such account, or no number on it) → nothing changes; the answer is the same in every case,
   so the form does not reveal which e-mails are registered.
4. **Admin accounts** are the one exception: their request waits on **Dashboard → Admin → Password Resets** until a
   **super admin** calls the registered number and approves (an admin account controls the whole marketplace).

The admin page also keeps the history: every change made by an owner and every wrong-number try (many wrong tries on one
account can mean someone is trying to take it over).

Limits: 5 tries per e-mail a day (right or wrong), 10 per IP address an hour, 100 in total an hour. Only bcrypt hashes are
stored, never a password.

Note: anyone who knows both a user's e-mail and their registered mobile number can change that user's password. That is
the trade-off of having no link, no OTP and no admin check.

## To switch it on
Run `supabase/migrations/00079_password_reset_requests.sql` once in the Supabase SQL editor (safe to run again).
Nothing else: no SMTP, no WhatsApp template, no edge function.

## Locked out of an admin account right now?
In the Supabase SQL editor (replace the two values; nothing else changes):

```sql
UPDATE auth.users
SET encrypted_password = extensions.crypt('YOUR-NEW-PASSWORD', extensions.gen_salt('bf', 10)), updated_at = now()
WHERE lower(email) = lower('ADMIN-EMAIL');
```

## Tests
- `src/__tests__/passwordResetRequest.test.tsx` (form and admin page)
- `docs/password-reset/sql-tests/reset_requests_check.mjs` (49 database checks on PGlite):
  `cd docs/password-reset/sql-tests && npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17 && node reset_requests_check.mjs`
