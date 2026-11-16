import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/db/supabase';
import type { LoanQuote } from '@/lib/orderFinance';
import {
  buildLoanRequestPayload,
  installmentForRequestedAmount,
  submitLoanRequest,
  validateLoanRequest,
  type LoanRequestDraft,
  type LoanRequestErrors,
} from '@/lib/loanRequest';
import '@/components/formkit/formkit.css';

interface LoanRequestFormProps {
  tone?: 'landing' | 'page';
  currency: string;
  quote: LoanQuote;
  money: (value: number) => string;
}

function suggestedAmount(quote: LoanQuote): string {
  const value = quote.principal > 0 ? quote.principal : quote.orderAmount;
  return String(Math.round(value));
}

function LoanRequestForm({ tone = 'page', currency, quote, money }: LoanRequestFormProps) {
  const landing = tone === 'landing';
  const editedAmount = useRef(false);
  const [draft, setDraft] = useState<LoanRequestDraft>(() => ({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    city: '',
    loanAmount: suggestedAmount(quote),
    goodsNeeded: '',
    honeypot: '',
  }));
  const [errors, setErrors] = useState<LoanRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentName, setSentName] = useState('');

  useEffect(() => {
    if (editedAmount.current) return;
    setDraft((current) => ({ ...current, loanAmount: suggestedAmount(quote) }));
  }, [quote]);

  const requested = Number(draft.loanAmount);
  const previewEmi = useMemo(
    () => installmentForRequestedAmount(quote, requested),
    [quote, requested],
  );

  const field = landing
    ? 'h-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
    : 'h-10 bg-background';
  const label = `text-xs font-semibold ${landing ? 'text-slate-300' : 'text-foreground'}`;
  const hint = landing ? 'text-rose-300' : 'text-destructive';

  const setField = (key: keyof LoanRequestDraft, value: string) => {
    if (key === 'loanAmount') editedAmount.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (draft.honeypot.trim()) {
      setSentName(draft.fullName.trim() || 'there');
      return;
    }
    const nextErrors = validateLoanRequest(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const payload = buildLoanRequestPayload(draft, quote, currency, data.session?.user?.id ?? null);
      if (!payload) return;
      await submitLoanRequest(payload);
      setSentName(payload.full_name);
      toast.success('Loan request submitted. We will contact you shortly.');
    } catch {
      toast.error('Could not submit the loan request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sentName) {
    return (
      <div className={`mt-5 rounded-2xl border p-4 ${landing ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className={`text-sm font-bold ${landing ? 'text-white' : 'text-foreground'}`}>Loan request received</p>
            <p className={`mt-1 text-xs leading-relaxed ${landing ? 'text-slate-300' : 'text-muted-foreground'}`}>
              Thanks {sentName}. We have your loan amount and contact details. The BulkSkart team will reach you on the phone or email you entered.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`mt-5 rounded-2xl border p-4 ${landing ? 'border-white/10 bg-black/30' : 'fk-skin border-border bg-muted/30'}`} noValidate>
      <h3 className={`text-base font-black ${landing ? 'text-white' : 'text-foreground'}`}>How much loan do you need?</h3>
      <p className={`mt-1 text-xs leading-relaxed ${landing ? 'text-slate-400' : 'text-muted-foreground'}`}>
        Submit the amount and your details. This is a request for the team to contact you, not an approval.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Loan amount" className={label} error={errors.loanAmount} hint={hint} wide>
          <Input
            inputMode="decimal"
            value={draft.loanAmount}
            onChange={(event) => setField('loanAmount', event.target.value)}
            className={field}
            aria-label="Loan amount"
            autoComplete="off"
            required
          />
        </Field>
        <Field label="Full name" className={label} error={errors.fullName} hint={hint}>
          <Input value={draft.fullName} onChange={(event) => setField('fullName', event.target.value)} className={field} autoComplete="name" aria-label="Full name" required />
        </Field>
        <Field label="Company" className={label} error={errors.companyName} hint={hint}>
          <Input value={draft.companyName} onChange={(event) => setField('companyName', event.target.value)} className={field} autoComplete="organization" aria-label="Company name" required />
        </Field>
        <Field label="Phone / WhatsApp" className={label} error={errors.phone} hint={hint}>
          <Input value={draft.phone} onChange={(event) => setField('phone', event.target.value)} className={field} inputMode="tel" autoComplete="tel" aria-label="Phone or WhatsApp" required />
        </Field>
        <Field label="Email" className={label} error={errors.email} hint={hint}>
          <Input type="email" value={draft.email} onChange={(event) => setField('email', event.target.value)} className={field} autoComplete="email" aria-label="Email" required />
        </Field>
        <Field label="City" className={label} error={errors.city} hint={hint}>
          <Input value={draft.city} onChange={(event) => setField('city', event.target.value)} className={field} autoComplete="address-level2" aria-label="City" required />
        </Field>
        <Field label="What do you want to buy?" className={label} error={errors.goodsNeeded} hint={hint} wide>
          <Textarea
            value={draft.goodsNeeded}
            onChange={(event) => setField('goodsNeeded', event.target.value)}
            className={landing ? 'min-h-[72px] bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'min-h-[72px] bg-background'}
            placeholder="Product, quantity, or order you want to finance"
            aria-label="Goods to finance"
            maxLength={300}
          />
        </Field>
      </div>

      <input
        tabIndex={-1}
        autoComplete="off"
        value={draft.honeypot}
        onChange={(event) => setField('honeypot', event.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      <p className={`mt-3 text-xs ${landing ? 'text-slate-300' : 'text-muted-foreground'}`}>
        About <span className="font-bold text-[#FF5A00]">{Number.isFinite(requested) && requested > 0 ? money(previewEmi) : '—'}</span>
        {' '}per month for {quote.months} months. Delivery on the order stays free.
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A00] px-5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition-transform active:scale-[0.99] disabled:opacity-70"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? 'Submitting request' : 'Submit loan request'}
      </button>
    </form>
  );
}

function Field({
  label,
  className,
  error,
  hint,
  wide,
  children,
}: {
  label: string;
  className: string;
  error?: string;
  hint: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className={className}>{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className={`mt-1 block text-[11px] ${hint}`}>{error}</span> : null}
    </label>
  );
}

export default memo(LoanRequestForm);
