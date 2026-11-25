/**
 * "Forgot password?" with no e-mail link and no OTP: the visitor types their e-mail, their mobile number and the new
 * password, and saves. BulkSkart's team calls the mobile number registered on the account to confirm it is really
 * them, then the new password starts working (src/lib/passwordResetRequest.ts, migration 00079).
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail, PhoneCall, Smartphone } from 'lucide-react';
import { Actions, Done, Field, IconBox, KitButton, TextInput } from '@/components/formkit';
import { EMAIL_RE, normalizeMobile, passwordProblem, requestPasswordReset, resetRequestMessage } from '@/lib/passwordResetRequest';

interface Props {
  initialEmail: string;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}

type Errors = Partial<Record<'email' | 'phone' | 'pw' | 'pw2' | 'form', string>>;

export default function PasswordResetRequest({ initialEmail, onBusy, onClose }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);

  const clear = (key: keyof Errors) => setErrors((was) => (was[key] || was.form ? { ...was, [key]: undefined, form: undefined } : was));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    const cleanEmail = email.trim();
    if (!EMAIL_RE.test(cleanEmail)) found.email = cleanEmail ? 'Please enter a valid e-mail address.' : 'Please enter your e-mail address.';
    if (!normalizeMobile(phone)) found.phone = phone.trim() ? 'Enter your 10-digit mobile number.' : 'Please enter your mobile number.';
    const weak = passwordProblem(pw);
    if (weak) found.pw = weak;
    else if (pw !== pw2) found.pw2 = 'The two passwords do not match.';
    if (Object.keys(found).length) {
      setErrors(found);
      const first = found.email ? 'forgot-email' : found.phone ? 'forgot-phone' : found.pw ? 'forgot-pw' : 'forgot-pw2';
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    setErrors({});
    const status = await requestPasswordReset({ email: cleanEmail, phone, password: pw });
    setBusy(false);
    if (status === 'received') {
      setSent(true);
      setPw('');
      setPw2('');
      return;
    }
    if (status === 'invalid_email') setErrors({ email: resetRequestMessage(status) });
    else if (status === 'invalid_phone') setErrors({ phone: resetRequestMessage(status) });
    else if (status === 'weak_password') setErrors({ pw: resetRequestMessage(status) });
    else setErrors({ form: resetRequestMessage(status) });
  };

  if (sent) {
    return (
      <Done
        title="Request received"
        actions={
          <Actions single>
            <KitButton onClick={onClose}>Back to Log In</KitButton>
          </Actions>
        }
      >
        <p>
          If <b>{email.trim()}</b> has a BulkSkart account, our team will call the mobile number registered on it to confirm it is you, usually within
          2 hours. Right after that call, log in with the new password you just set.
        </p>
        <p className="mt-2 text-[12.5px] text-muted-foreground">Until then your old password keeps working. No link or code will be sent.</p>
      </Done>
    );
  }

  return (
    <form onSubmit={save} noValidate className="fk-form fk-stack">
      <Field htmlFor="forgot-email" label="E-mail address" required error={errors.email}>
        <IconBox icon={Mail}>
          <TextInput
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clear('email');
            }}
            placeholder="you@company.com"
            invalid={Boolean(errors.email)}
            iconPadding
          />
        </IconBox>
      </Field>
      <Field htmlFor="forgot-phone" label="Mobile number on your account" required error={errors.phone} hint="We call this number to confirm it is you">
        <IconBox icon={Smartphone}>
          <TextInput
            id="forgot-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clear('phone');
            }}
            placeholder="98765 43210"
            invalid={Boolean(errors.phone)}
            iconPadding
          />
        </IconBox>
      </Field>
      <Field htmlFor="forgot-pw" label="New password" required error={errors.pw} hint={errors.pw ? undefined : 'At least 8 characters, with letters and a number'}>
        <IconBox icon={Lock}>
          <TextInput
            id="forgot-pw"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              clear('pw');
            }}
            invalid={Boolean(errors.pw)}
            iconPadding
          />
        </IconBox>
      </Field>
      <Field htmlFor="forgot-pw2" label="New password again" required error={errors.pw2}>
        <IconBox icon={Lock}>
          <TextInput
            id="forgot-pw2"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => {
              setPw2(e.target.value);
              clear('pw2');
            }}
            invalid={Boolean(errors.pw2)}
            iconPadding
          />
        </IconBox>
      </Field>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-bold text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        {show ? 'Hide passwords' : 'Show passwords'}
      </button>
      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />
        <span>
          For your safety our team calls the mobile number registered on your account before the new password starts working. No e-mail link and no
          OTP needed.
        </span>
      </p>
      {errors.form && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {errors.form}
        </p>
      )}
      <Actions>
        <KitButton type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {busy ? 'Saving…' : 'Save new password'}
        </KitButton>
        <KitButton variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </KitButton>
      </Actions>
    </form>
  );
}
