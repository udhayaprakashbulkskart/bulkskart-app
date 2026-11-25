/**
 * "Forgot password?" without an e-mail link: e-mail → 6-digit code on the account's WhatsApp → code + new password → saved.
 * Rendered inside the sign-in page's reset dialog.
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MessageCircle } from 'lucide-react';
import { Actions, Done, Field, IconBox, KitButton, TextInput } from '@/components/formkit';
import { type ResetAnswer, passwordHint, requestResetCode, resetMessage, resetWithCode } from '@/lib/passwordReset';

interface Props {
  initialEmail: string;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
  /** after the password is saved: back to sign-in with this e-mail filled in */
  onDone: (email: string) => void;
}

export default function WhatsAppPasswordReset({ initialEmail, onBusy, onClose, onDone }: Props) {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setError(clean ? 'Please enter a valid e-mail address.' : 'Please enter your e-mail address.'); return; }
    setBusy(true); setError('');
    const a: ResetAnswer = await requestResetCode(clean);
    setBusy(false);
    if (a.status === 'sent') { setHint(a.phone_hint ?? ''); setStep('code'); setWait(60); setCode(''); return; }
    setError(resetMessage(a));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from WhatsApp.'); return; }
    const weak = passwordHint(pw);
    if (weak) { setError(weak); return; }
    if (pw !== pw2) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError('');
    const a = await resetWithCode(email, code, pw);
    setBusy(false);
    if (a.status === 'ok') { setStep('done'); setPw(''); setPw2(''); return; }
    setError(resetMessage(a));
    if (a.status === 'expired' || a.status === 'locked') setCode('');
  };

  if (step === 'done') {
    return (
      <Done title="Password changed" actions={<Actions single><KitButton onClick={() => onDone(email.trim())}>Log in now</KitButton></Actions>}>
        <p>Your new password is saved, and every other device signed in to this account has been signed out.</p>
      </Done>
    );
  }

  if (step === 'email') {
    return (
      <form onSubmit={send} noValidate className="fk-form fk-stack">
        <Field htmlFor="forgot-email" label="E-mail address" required error={error}>
          <IconBox icon={Mail}>
            <TextInput id="forgot-email" type="email" inputMode="email" autoComplete="email" value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }} placeholder="you@company.com" invalid={Boolean(error)} iconPadding />
          </IconBox>
        </Field>
        <p className="text-[12.5px] text-muted-foreground">We send a 6-digit code to the WhatsApp number on your BulkSkart account.</p>
        <Actions>
          <KitButton type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
            {busy ? 'Sending…' : 'Send code on WhatsApp'}
          </KitButton>
          <KitButton variant="ghost" onClick={onClose} disabled={busy}>Cancel</KitButton>
        </Actions>
      </form>
    );
  }

  return (
    <form onSubmit={save} noValidate className="fk-form fk-stack">
      <p className="text-[13px]">
        We sent a 6-digit code on WhatsApp{hint ? <> to <b>{hint}</b></> : ''} for <b>{email.trim()}</b>. It works for 10 minutes.
      </p>
      <Field htmlFor="reset-code" label="Code from WhatsApp" required>
        <IconBox icon={KeyRound}>
          <TextInput id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError(''); }} placeholder="6 digits" iconPadding />
        </IconBox>
      </Field>
      <Field htmlFor="reset-pw" label="New password" required hint="At least 8 characters, with letters and a number">
        <IconBox icon={Lock}>
          <TextInput id="reset-pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw}
            onChange={(e) => { setPw(e.target.value); if (error) setError(''); }} iconPadding />
        </IconBox>
      </Field>
      <Field htmlFor="reset-pw2" label="New password again" required error={error}>
        <IconBox icon={Lock}>
          <TextInput id="reset-pw2" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2}
            onChange={(e) => { setPw2(e.target.value); if (error) setError(''); }} invalid={Boolean(error)} iconPadding />
        </IconBox>
      </Field>
      <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-bold text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />} {show ? 'Hide passwords' : 'Show passwords'}
      </button>
      <Actions>
        <KitButton type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {busy ? 'Saving…' : 'Save new password'}
        </KitButton>
        <KitButton variant="ghost" onClick={() => { setStep('email'); setError(''); }} disabled={busy}>Change e-mail</KitButton>
      </Actions>
      <p className="text-[12px] text-muted-foreground">
        No message?{' '}
        {wait > 0 ? <span>You can ask for a new code in {wait} s.</span>
          : <button type="button" onClick={() => send()} disabled={busy} className="font-bold text-[#C24400] underline dark:text-[#FF8A3D]">Send a new code</button>}
      </p>
    </form>
  );
}
