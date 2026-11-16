import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { Actions, Done, Field, FormDialog, IconBox, KitButton, TextInput } from '@/components/formkit';

/**
 * Read once, when the app loads: a password-reset e-mail link brings the person back with `type=recovery` in the
 * address, which the sign-in client removes as soon as it has read it.
 */
const OPENED_FROM_RESET_LINK = typeof window !== 'undefined' && /type=recovery/.test(`${window.location.hash}${window.location.search}`);

/**
 * Asks for a new password after someone opens the reset link from "Forgot password?". Without this step the link
 * would only sign them in and leave the old password in place.
 */
export default function PasswordRecoveryDialog() {
  const ids = useId();
  const [open, setOpen] = useState(OPENED_FROM_RESET_LINK);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setOpen(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setPassword('');
      setConfirm('');
      setErrors({});
      setDone(false);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    else if (confirm !== password) found.confirm = 'The two passwords do not match.';
    setErrors(found);
    if (found.password || found.confirm) {
      document.getElementById(found.password ? `${ids}-password` : `${ids}-confirm`)?.focus();
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setErrors({
        save: /session|expired|invalid|jwt/i.test(error.message)
          ? 'This reset link has expired. Please ask for a new one from "Forgot password?".'
          : error.message || 'Your password could not be changed. Please try again.',
      });
      return;
    }
    setDone(true);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      busy={saving}
      title={
        <>
          Set a <em>New Password</em>
        </>
      }
      description="You opened a password reset link. Choose the new password for your BulkSkart account."
      width={560}
    >
      {done ? (
        <Done
          title="Password changed"
          actions={
            <Actions single>
              <KitButton onClick={close}>Continue</KitButton>
            </Actions>
          }
        >
          <p>Use your new password the next time you log in.</p>
        </Done>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
          <Field htmlFor={`${ids}-password`} label="New password" required error={errors.password} hint="At least 8 characters.">
            <IconBox icon={KeyRound}>
              <TextInput
                id={`${ids}-password`}
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors({});
                }}
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${ids}-password-error` : `${ids}-password-hint`}
                iconPadding
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </IconBox>
          </Field>

          <Field htmlFor={`${ids}-confirm`} label="Confirm new password" required error={errors.confirm}>
            <IconBox icon={Lock}>
              <TextInput
                id={`${ids}-confirm`}
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErrors({});
                }}
                invalid={Boolean(errors.confirm)}
                aria-describedby={errors.confirm ? `${ids}-confirm-error` : undefined}
                iconPadding
              />
            </IconBox>
          </Field>

          {errors.save && (
            <p className="fk-error" role="alert">
              {errors.save}
            </p>
          )}

          <Actions>
            <KitButton type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save New Password'}
            </KitButton>
            <KitButton variant="ghost" onClick={close} disabled={saving}>
              Not now
            </KitButton>
          </Actions>
        </form>
      )}
    </FormDialog>
  );
}
