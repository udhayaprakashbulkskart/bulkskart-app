import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  CheckCircle2, Loader2, FileText, IndianRupee, User, Building2, Phone, Mail, MapPin, ShoppingCart, CalendarDays, Send,
} from 'lucide-react';
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
    ? 'h-11 rounded-xl bg-[#0b1220] border-white/10 text-white placeholder:text-neutral-400 focus-visible:border-[#FF5A00] focus-visible:ring-[#FF5A00]/30'
    : 'h-10 bg-background';
  const label = `text-xs font-semibold ${landing ? 'text-slate-200' : 'text-foreground'}`;
  const hint = landing ? 'text-[#FF7A2E]' : 'text-destructive';

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
      <div className={`mt-5 rounded-2xl border p-4 ${landing ? 'border-[#FF5A00]/40 bg-[#FF5A00]/10' : 'border-[#FF5A00]/30 bg-[#FF5A00]/10'}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A2E]" />
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

  const icon = (Icon: typeof User) => (landing ? <Icon className="mr-1.5 inline h-3.5 w-3.5 text-[#FF5A00]" /> : null);

  return (
    <form
      onSubmit={handleSubmit}
      className={landing
        ? 'mt-6 rounded-2xl border border-white/10 bg-[#0A0A0A]/35 p-5 sm:p-6'
        : 'mt-5 rounded-2xl border border-border bg-muted/30 p-4'}
      noValidate
    >
      {landing ? (
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00]/15 text-[#FF5A00]">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              How Much <span className="text-[#FF5A00]">Loan Do You Need?</span>
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400 sm:text-sm">
              Submit the amount and your details. This is a request for the team to contact you, not an approval.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h3 className="text-base font-black text-foreground">How much loan do you need?</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Submit the amount and your details. This is a request for the team to contact you, not an approval.
          </p>
        </>
      )}

      <div className={landing ? 'mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2' : 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'}>
        <Field label="Loan amount" className={label} error={errors.loanAmount} hint={hint} wide icon={icon(IndianRupee)}>
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
        <Field label="Full name" className={label} error={errors.fullName} hint={hint} icon={icon(User)}>
          <Input value={draft.fullName} onChange={(event) => setField('fullName', event.target.value)} className={field} autoComplete="name" aria-label="Full name" placeholder={landing ? 'Enter your name' : undefined} required />
        </Field>
        <Field label="Company" className={label} error={errors.companyName} hint={hint} icon={icon(Building2)}>
          <Input value={draft.companyName} onChange={(event) => setField('companyName', event.target.value)} className={field} autoComplete="organization" aria-label="Company name" placeholder={landing ? 'Enter company name' : undefined} required />
        </Field>
        <Field label="Phone / WhatsApp" className={label} error={errors.phone} hint={hint} icon={icon(Phone)}>
          <Input value={draft.phone} onChange={(event) => setField('phone', event.target.value)} className={field} inputMode="tel" autoComplete="tel" aria-label="Phone or WhatsApp" placeholder={landing ? 'Enter mobile number' : undefined} required />
        </Field>
        <Field label="Email" className={label} error={errors.email} hint={hint} icon={icon(Mail)}>
          <Input type="email" value={draft.email} onChange={(event) => setField('email', event.target.value)} className={field} autoComplete="email" aria-label="Email" placeholder={landing ? 'Enter email address' : undefined} required />
        </Field>
        <Field label="City" className={label} error={errors.city} hint={hint} icon={icon(MapPin)}>
          <Input value={draft.city} onChange={(event) => setField('city', event.target.value)} className={field} autoComplete="address-level2" aria-label="City" placeholder={landing ? 'Enter city' : undefined} required />
        </Field>
        <Field label="What do you want to buy?" className={label} error={errors.goodsNeeded} hint={hint} wide icon={icon(ShoppingCart)}>
          <Textarea
            value={draft.goodsNeeded}
            onChange={(event) => setField('goodsNeeded', event.target.value)}
            className={landing ? 'min-h-[84px] rounded-xl bg-[#0b1220] border-white/10 text-white placeholder:text-neutral-400 focus-visible:border-[#FF5A00]' : 'min-h-[72px] bg-background'}
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

      {landing ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#FF5A00]/40 bg-[#FF5A00]/5 px-4 py-3 text-sm text-slate-200">
          <CalendarDays className="h-5 w-5 shrink-0 text-[#FF5A00]" />
          <p>
            About <span className="font-bold text-[#FF7A2E]">{Number.isFinite(requested) && requested > 0 ? money(previewEmi) : '—'}</span>
            {' '}per month for <span className="font-bold text-[#FF7A2E]">{quote.months} months</span>. Delivery on the order stays free.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          About <span className="font-bold text-[#FF5A00]">{Number.isFinite(requested) && requested > 0 ? money(previewEmi) : '—'}</span>
          {' '}per month for {quote.months} months. Delivery on the order stays free.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={landing
          ? 'group mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 text-base font-bold text-white shadow-[0_12px_30px_-10px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-70'
          : 'mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C94400] px-5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition-transform active:scale-[0.99] disabled:opacity-70'}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : landing ? <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : null}
        {submitting ? 'Submitting request' : landing ? 'Submit Loan Request' : 'Submit loan request'}
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
  icon,
  children,
}: {
  label: string;
  className: string;
  error?: string;
  hint: string;
  wide?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className={className}>
        {icon}
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {error ? <span className={`mt-1 block text-[11px] ${hint}`}>{error}</span> : null}
    </label>
  );
}

export default memo(LoanRequestForm);
