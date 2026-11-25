# Forgotten password: WhatsApp code (no e-mail link)

**Sign-in → Forgot password?**
1. Enter the account's e-mail.
2. A 6-digit code arrives on the WhatsApp number on the account (`profiles.phone`).
3. Enter the code and a new password, then press Save.

There is no e-mail link, and no SMTP is needed.

**Rules** (enforced in `00078_password_reset_whatsapp.sql`):
- Only a SHA-256 of each code is stored, in schema `pwreset`, which the API does not expose.
- A code is valid for 10 minutes and works once. Five wrong tries lock it.
- An account can get one code a minute and three an hour. A replaced code still counts; a failed WhatsApp send does
  not.
- One IP address can make 20 look-ups and 30 wrong tries an hour.
- Saving the new password signs the account out on every device.
- The new password needs 8 to 72 characters, with letters and at least one number.

**Setup:**
1. Run `supabase/migrations/00078_password_reset_whatsapp.sql` in the SQL editor.
2. In AiSensy, get a WhatsApp **Authentication** template approved. Its one parameter is the code, e.g. "{{1}} is your
   BulkSkart password reset code. It expires in 10 minutes. Do not share it."
3. Create an **API campaign** with that template.
4. On the server, set these in the functions environment:
   - `AISENSY_OTP_CAMPAIGN` = the campaign name;
   - `AISENSY_OTP_COPY_BUTTON=true` if the template has a copy-code button.

   `AISENSY_API_KEY` is already set for the WhatsApp alerts.
5. Deploy `supabase/functions/password-reset/` and restart the functions service.

**Until then:** the dialog says "Password reset on WhatsApp is not set up yet". An account with no phone number is
told to contact support.

**Tests:**
- `docs/password-reset/sql-tests/reset_check.mjs`: 25 checks on PGlite.
- `src/__tests__/passwordReset.test.tsx`: helpers and the dialog.
