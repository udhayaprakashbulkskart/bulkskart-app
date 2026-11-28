import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkMobile, looksLikeEmail, suggestEmailFix } from '@/lib/signup';
import { AssistantNote } from './SignupShell';

export interface AccountValues {
  companyName: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
  agreed: boolean;
}

export type AccountField = keyof AccountValues;
export type AccountErrors = Partial<Record<AccountField, string>>;

/**
 * `new`: the person has no login yet. `existing`: they are already signed in (their account was made but the business
 * was not saved), so only the business and a phone number are asked for.
 */
export type AccountMode = 'new' | 'existing';

/** What is wrong with the form, in the order the fields appear; empty when it is fine. */
export function validateAccount(values: AccountValues, mode: AccountMode): AccountErrors {
  const errors: AccountErrors = {};
  const company = values.companyName.trim();
  if (company.length < 2) errors.companyName = 'Please enter your company or factory name.';
  else if (company.length > 80) errors.companyName = 'That name is too long (80 characters at most).';
  if (mode === 'new' && values.fullName.trim().length < 2) errors.fullName = 'Please enter your name.';
  if (!checkMobile(values.phone).ok) errors.phone = 'Please enter a 10-digit mobile number, like 98765 43210.';
  if (mode === 'new') {
    if (!looksLikeEmail(values.email)) errors.email = 'Please enter a valid e-mail address, like you@company.com.';
    if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
    if (!values.agreed) errors.agreed = 'Please accept the User Agreement and Privacy Policy to continue.';
  }
  return errors;
}

const FIELD_ORDER: AccountField[] = ['companyName', 'fullName', 'phone', 'email', 'password', 'agreed'];

interface AccountStepProps {
  mode: AccountMode;
  initial: Pick<AccountValues, 'companyName' | 'fullName' | 'phone' | 'email'>;
  /** one line about the business, so the person sees their answers were kept */
  summary: string;
  busy: boolean;
  /** something the server said, shown above the button */
  error: string;
  /** the server says an account with this e-mail exists */
  emailTaken: boolean;
  signInHref: string;
  /** gets what has been typed, so it is still there when the person comes back */
  onBack: (values: AccountValues) => void;
  onSubmit: (values: AccountValues) => void;
  /** shown with a save error, so payment is not blocked by an unfinished profile */
  onPayNow?: () => void;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

export function AccountStep({ mode, initial, summary, busy, error, emailTaken, signInHref, onBack, onSubmit, onPayNow }: AccountStepProps) {
  const [values, setValues] = useState<AccountValues>({ ...initial, password: '', agreed: false });
  const [errors, setErrors] = useState<AccountErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const refs = useRef<Partial<Record<AccountField, HTMLElement | null>>>({});

  const set = <K extends AccountField>(field: K, value: AccountValues[K]) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateAccount(values, mode);
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    onSubmit({ ...values, companyName: values.companyName.trim(), fullName: values.fullName.trim(), email: values.email.trim().toLowerCase() });
  };

  const emailFix = mode === 'new' ? suggestEmailFix(values.email) : null;
  const input = 'h-11 rounded-xl bg-card text-base';

  return (
    <section aria-labelledby="account-title" className="space-y-5">
      <div>
        <h1 id="account-title" tabIndex={-1} className="text-2xl font-extrabold leading-tight tracking-tight outline-none sm:text-3xl">
          {mode === 'new' ? 'Create your login' : 'Confirm your business'}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{mode === 'new' ? 'Five details, then you are in.' : 'Two details, then you can choose a plan.'}</p>
      </div>

      <AssistantNote>
        <span className="font-semibold">Got it.</span> {summary}
      </AssistantNote>

      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="acc-company" className="text-sm font-semibold">
            Company or factory name
          </Label>
          <Input
            id="acc-company"
            ref={(element) => {
              refs.current.companyName = element;
            }}
            value={values.companyName}
            onChange={(event) => set('companyName', event.target.value)}
            autoComplete="organization"
            placeholder="Your Manufacturing Co."
            aria-invalid={Boolean(errors.companyName)}
            aria-describedby={errors.companyName ? 'acc-company-error' : undefined}
            className={input}
          />
          <FieldError id="acc-company-error" message={errors.companyName} />
        </div>

        {mode === 'new' && (
          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-sm font-semibold">
              Your name
            </Label>
            <Input
              id="acc-name"
              ref={(element) => {
                refs.current.fullName = element;
              }}
              value={values.fullName}
              onChange={(event) => set('fullName', event.target.value)}
              autoComplete="name"
              placeholder="Priya Nair"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'acc-name-error' : undefined}
              className={input}
            />
            <FieldError id="acc-name-error" message={errors.fullName} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="acc-phone" className="text-sm font-semibold">
            Mobile number
          </Label>
          <Input
            id="acc-phone"
            ref={(element) => {
              refs.current.phone = element;
            }}
            value={values.phone}
            onChange={(event) => set('phone', event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'acc-phone-error' : undefined}
            className={input}
          />
          <FieldError id="acc-phone-error" message={errors.phone} />
        </div>

        {mode === 'new' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="acc-email" className="text-sm font-semibold">
                Work e-mail
              </Label>
              <Input
                id="acc-email"
                ref={(element) => {
                  refs.current.email = element;
                }}
                value={values.email}
                onChange={(event) => set('email', event.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'acc-email-error' : undefined}
                className={input}
              />
              {emailFix && (
                <p className="text-xs text-muted-foreground">
                  Did you mean{' '}
                  <button type="button" onClick={() => set('email', emailFix)} className="font-semibold text-primary underline-offset-2 hover:underline">
                    {emailFix}
                  </button>
                  ?
                </p>
              )}
              <FieldError id="acc-email-error" message={errors.email} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="acc-password"
                  ref={(element) => {
                    refs.current.password = element;
                  }}
                  value={values.password}
                  onChange={(event) => set('password', event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'acc-password-error' : undefined}
                  className={`${input} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError id="acc-password-error" message={errors.password} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="acc-agree"
                  ref={(element) => {
                    refs.current.agreed = element;
                  }}
                  checked={values.agreed}
                  onCheckedChange={(checked) => set('agreed', checked === true)}
                  aria-describedby={errors.agreed ? 'acc-agree-error' : undefined}
                  className="mt-0.5 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
                <label htmlFor="acc-agree" className="cursor-pointer select-none text-xs leading-relaxed text-muted-foreground">
                  I agree to the BulkSkart{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
                    User Agreement
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
              <FieldError id="acc-agree-error" message={errors.agreed} />
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              {emailTaken && (
                <Link to={signInHref} className="mt-1 inline-block font-semibold underline">
                  Sign in instead
                </Link>
              )}
              {onPayNow && (
                <button type="button" onClick={onPayNow} className="mt-1 block font-semibold text-primary underline">
                  Pay for a plan now
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onBack(values)} disabled={busy} className="h-11 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button type="submit" disabled={busy} className="h-12 rounded-xl px-6 text-base font-bold shadow-[0_10px_26px_-12px_rgba(255,90,0,0.85)] sm:min-w-[260px]">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {mode === 'new' ? 'Creating your account…' : 'Saving…'}
              </>
            ) : (
              <>
                {mode === 'new' ? 'Create account and choose a plan' : 'Save and choose a plan'} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
