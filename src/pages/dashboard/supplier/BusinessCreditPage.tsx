/**
 * /dashboard/supplier/credit — BulkSkart Business Credit for manufacturers.
 * Amounts are labelled by who stands behind them: "eligible to apply" (BulkSkart's checks), "approved" and "withdrawable"
 * (only after the lending partner's recorded decision and the supplier's acceptance of its KFS and agreement).
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine, BadgeCheck, Banknote, CalendarClock, Check, CircleDashed, FileText, Gauge, History, IndianRupee, Info, Landmark, Loader2,
  Nfc, ShieldCheck, Sparkles, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { CheckRow, Field, KitButton, TextArea, TextInput } from '@/components/formkit';
import '@/components/formkit/formkit.css';
import './credit.css';
import { cn } from '@/lib/utils';
import { day, money, when } from '@/lib/loanKyc/api';
import {
  type AppBundle, type CreditState, OPEN_STAGES, STAGE_LABEL, WORKFLOW, acceptAgreement, cancelCredit, isOverdue, myCredit, openCreditDoc,
  requestWithdrawal, saveDraft, submitCredit, workflowStep,
} from '@/lib/credit/api';

const inr = (n: number | null | undefined) => (n == null ? '—' : money(Number(n)));

export default function BusinessCreditPage() {
  const [s, setS] = useState<CreditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setS(await myCredit()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load business credit.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = s?.applications.find((b) => OPEN_STAGES.includes(b.application.stage)) ?? null;
  const latest = s?.applications[0] ?? null;

  return (
    <DashboardLayout>
      <PageMeta title="Business Credit | BulkSkart" description="Business credit for BulkSkart manufacturers, from a regulated lending partner." robots="noindex, nofollow" />
      <div className="fk-skin mx-auto w-full max-w-6xl space-y-5 px-3 py-5 sm:px-4">
        {error && <p className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">{error}</p>}
        {!s && !error && <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>}
        {s && (
          <>
            <Hero s={s} />
            <Metrics s={s} open={open} />
            <Workflow step={workflowStep(s)} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <Eligibility s={s} />
              {open && open.application.stage !== 'draft' ? <ApplicationCard b={open} s={s} reload={load} /> : <AmountCard s={s} draft={open} reload={load} />}
            </div>
            {!open && latest && ['platform_rejected', 'lender_rejected', 'cancelled', 'closed'].includes(latest.application.stage) && (
              <section className="rounded-2xl border border-border bg-card p-4 text-[13px]">
                <b>Last application:</b> {money(latest.application.requested_amount)} · {STAGE_LABEL[latest.application.stage]}
                {latest.application.platform_note && latest.application.stage === 'platform_rejected' ? <> — {latest.application.platform_note}</> : null}
                {latest.application.lender_note && latest.application.stage === 'lender_rejected' ? <> — {latest.application.lender_note}</> : null}
              </section>
            )}
            {open && ['lender_approved', 'agreement_accepted', 'active'].includes(open.application.stage) && <KfsCard b={open} s={s} reload={load} />}
            {open && ['agreement_accepted', 'active'].includes(open.application.stage) && <WithdrawCard b={open} s={s} reload={load} />}
            {s.applications.some((b) => b.schedule.length || b.repayments.length) && <RepaymentCard s={s} />}
            <HistoryCard s={s} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/** Counts up to a value once (skipped when the viewer prefers less motion). */
function useCountUp(target: number, ms = 1400): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const lakh = (n: number) => `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakh`;

function Hero({ s }: { s: CreditState }) {
  const p = s.program;
  const open = s.applications.find((b) => OPEN_STAGES.includes(b.application.stage))?.application;
  // the card shows the lender's approved amount once there is one; until then, the most that can be applied for
  const approved = open?.lender_decision === 'approved' && open.approved_amount ? Number(open.approved_amount) : null;
  const amount = approved ?? Number(p.max_amount);
  const shown = useCountUp(amount);
  const ready = Boolean(open && ['agreement_accepted', 'active'].includes(open.stage));
  const eyebrow = approved ? `Approved by ${p.partner?.name ?? 'your lender'}` : s.eligible_amount > 0 ? 'You can apply for up to' : 'Credit limit up to';
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="bc-hero relative overflow-hidden rounded-3xl border border-[#FF5A00]/25 p-5 text-white sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* the card */}
        <div className="bc-stage order-first flex justify-center lg:order-last">
          <div className="relative w-full max-w-[430px]">
            <div className="bc-glow" aria-hidden="true" />
            <div className="bc-card" role="img" aria-label={`BulkSkart Business Credit: ${eyebrow.toLowerCase()} ${money(amount)}, ${p.tenure_months} months${approved ? '' : ', subject to lender approval'}`}>
              <div className="bc-shine" aria-hidden="true" />
              <div className="relative flex h-full flex-col justify-between p-4 sm:p-6" aria-hidden="true">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-black leading-none tracking-tight">Bulk<span className="text-[#FF5A00]">Skart</span></p>
                    <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.28em] text-white/60">Business Credit</p>
                  </div>
                  <Nfc className="h-6 w-6 text-white/70" />
                </div>
                <div className="flex items-center gap-3"><span className="bc-chip" /></div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFB27A]">{eyebrow}</p>
                  <p className="bc-amount text-[30px] font-black leading-tight min-[400px]:text-[34px] sm:text-[40px]">{money(shown)}</p>
                </div>
                <div className="flex items-end justify-between gap-2 whitespace-nowrap text-[8.5px] font-bold uppercase tracking-[0.12em] sm:gap-3 sm:text-[9.5px] sm:tracking-[0.14em]">
                  <span><span className="block text-white/50">Tenure</span><span className="text-[10.5px] tracking-normal sm:text-[12px]">{p.tenure_months} months</span></span>
                  <span><span className="block text-white/50">Interest</span><span className="text-[10.5px] tracking-normal sm:text-[12px]">{p.zero_interest_confirmed ? '0% p.a.' : 'As per KFS'}</span></span>
                  <span className="text-right"><span className="block text-white/50">{approved ? 'Lender' : 'Subject to'}</span><span className="text-[10.5px] tracking-normal sm:text-[12px]">{approved ? (p.partner?.name ?? 'Approved') : 'Lender approval'}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* the pitch */}
        <div className="min-w-0 space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#FF8A3D]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> BulkSkart Business Credit
          </p>
          <h1 className="text-[30px] font-black leading-[1.08] sm:text-[42px]">
            {approved && ready ? <>Your credit of <span className="text-[#FF5A00]">{lakh(approved)}</span> is ready</>
              : approved ? <><span className="text-[#FF5A00]">{lakh(approved)}</span> approved: accept the offer</> : <>Up to <span className="text-[#FF5A00]">{lakh(Number(p.max_amount))}</span> to grow your factory</>}
          </h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-white/70">
            Working capital for raw material, big orders and new machines. Repay over {p.tenure_months} months; the money goes straight into your bank account.
          </p>
          <ul className="grid gap-2 text-[13px] sm:grid-cols-3">
            {[
              [IndianRupee, `Up to ${lakh(Number(p.max_amount))}`],
              [CalendarClock, `${p.tenure_months}-month repayment`],
              p.zero_interest_confirmed ? [BadgeCheck, '0% interest'] : [FileText, 'Clear terms (KFS) first'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Wallet;
              return (
                <li key={text as string} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-bold">
                  <I className="h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" /> {text as string}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            {approved ? (
              <button type="button" onClick={() => go('kfs-card')} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FF5A00] px-5 text-sm font-black text-white shadow-lg shadow-orange-950/40 transition-transform active:scale-[0.98]">
                <FileText className="h-4 w-4" aria-hidden="true" /> View offer
              </button>
            ) : (
              <>
                <button type="button" onClick={() => go('amt-card')} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FF5A00] px-5 text-sm font-black text-white shadow-lg shadow-orange-950/40 transition-transform active:scale-[0.98]">
                  <IndianRupee className="h-4 w-4" aria-hidden="true" /> Choose your amount
                </button>
                <button type="button" onClick={() => go('elig-card')} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-bold text-white hover:bg-white/10">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Check eligibility
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-white/50">
            BulkSkart is not a lender. Credit is offered, approved and paid by {p.live && p.partner
              ? <>{p.partner.legal_name} ({p.partner.entity_type === 'bank' ? 'a bank' : 'an NBFC'} registered with the RBI{p.partner.rbi_registration_no ? `, ${p.partner.rbi_registration_no}` : ''})</>
              : 'a regulated lending partner (bank or NBFC)'}; approval and the amount are its decision.
            {p.zero_interest_confirmed ? ' 0% interest as confirmed by the lending partner; any fee and the APR are in the KFS before you accept.' : ''}
            {!p.live && <> Lending partner: <b className="text-white/80">Integration Pending</b>; you can check eligibility and apply now.</>}
          </p>
        </div>
      </div>
    </section>
  );
}

function Tile({ icon: Icon, label, value, hint, accent }: { icon: typeof Wallet; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border p-3.5', accent ? 'border-[#FF5A00]/50 bg-[#FF5A00]/10' : 'border-border bg-card')}>
      <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground"><Icon className="h-3.5 w-3.5 text-[#FF5A00]" aria-hidden="true" /> {label}</span>
      <span className="truncate text-lg font-black sm:text-xl">{value}</span>
      {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Metrics({ s, open }: { s: CreditState; open: AppBundle | null }) {
  const a = open?.application;
  const approved = a && a.lender_decision === 'approved' ? a.approved_amount : null;
  return (
    <section aria-label="Your credit" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <Tile icon={Gauge} label="Available credit limit" value={inr(s.available_limit)} hint={s.available_limit == null ? 'Set by the lender on approval' : 'Sanctioned by the lender, not yet drawn'} />
      <Tile icon={ShieldCheck} label="Eligible credit amount" value={s.eligible_amount > 0 ? inr(s.eligible_amount) : '—'} hint={s.eligible_amount > 0 ? 'You can apply for up to this; not an approval' : 'Complete the checks below'} />
      <Tile icon={IndianRupee} label="Applied amount" value={inr(a && a.stage !== 'draft' ? a.requested_amount : null)} hint={a?.stage === 'draft' ? `Selected: ${money(a.requested_amount)}` : undefined} />
      <Tile icon={BadgeCheck} label="Approved amount" value={inr(approved)} hint={approved == null ? 'Only after the lender approves' : 'Approved by the lender'} accent={approved != null} />
      <Tile icon={ArrowDownToLine} label="Withdrawable amount" value={inr(open && open.withdrawable > 0 ? open.withdrawable : null)} hint={open && open.withdrawable > 0 ? 'Request it below' : 'After approval and agreement'} accent={Boolean(open && open.withdrawable > 0)} />
      <Tile icon={Wallet} label="Outstanding balance" value={s.outstanding > 0 ? inr(s.outstanding) : '—'} hint={s.outstanding > 0 ? "As per the lender's schedule" : undefined} />
      <Tile icon={CalendarClock} label="Next EMI date" value={s.next_emi_date ? day(s.next_emi_date) : '—'} />
      <Tile icon={History} label="Repayments made" value={String(s.applications.reduce((n, b) => n + b.repayments.length, 0))} hint="Details below" />
    </section>
  );
}

function Workflow({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5 rounded-2xl border border-border bg-card p-3 sm:grid-cols-8" aria-label="Steps">
      {WORKFLOW.map((w, i) => (
        <li key={w} className="min-w-0" aria-current={i === step ? 'step' : undefined}>
          <span className={cn('block h-1.5 rounded-full', i < step ? 'bg-[#FF5A00]' : i === step ? 'bg-[#FF5A00]/50' : 'bg-muted')} />
          <span className={cn('mt-1 block text-[10.5px] leading-tight sm:text-[11px]', i === step ? 'font-black' : i < step ? 'font-semibold' : 'text-muted-foreground')}>{i + 1}. {w}</span>
        </li>
      ))}
    </ol>
  );
}

function Eligibility({ s }: { s: CreditState }) {
  const rows: { key: keyof CreditState['checks']; label: string; to?: string; cta?: string }[] = [
    { key: 'subscription', label: 'Active paid BulkSkart subscription', to: '/dashboard/supplier/subscription', cta: 'Choose a plan' },
    { key: 'kyc', label: 'KYC verification completed', to: '/dashboard/loans?for=credit', cta: 'Complete KYC' },
    { key: 'business', label: 'Verified business profile', to: '/dashboard/supplier/verification', cta: 'Verify business' },
    { key: 'bank', label: 'Verified bank account', to: '/dashboard/loans?for=credit', cta: 'Add bank account' },
    { key: 'lender', label: 'Approval from the lending partner' },
  ];
  const passed = rows.filter((r) => s.checks[r.key]).length;
  return (
    <section id="elig-card" className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="elig">
      <div className="flex items-center justify-between gap-2">
        <h2 id="elig" className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Eligibility checker</h2>
        <span className="text-[12px] font-bold text-muted-foreground">{passed} of 5</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const ok = s.checks[r.key];
          return (
            <li key={r.key} className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5">
              {ok ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FF5A00] text-white"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>
                : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" aria-hidden="true" /></span>}
              <span className="min-w-0 flex-1 text-[13px] font-semibold">{r.label}<span className="sr-only">{ok ? ': done' : ': not yet'}</span></span>
              {!ok && r.to && <Link to={r.to} className="shrink-0 text-[12px] font-bold text-[#C24400] underline dark:text-[#FF8A3D]">{r.cta}</Link>}
              {!ok && !r.to && <span className="shrink-0 text-[11.5px] text-muted-foreground">After you apply</span>}
            </li>
          );
        })}
      </ul>
      <p className="text-[11.5px] text-muted-foreground">The first four are checked by BulkSkart; the lending partner then makes its own credit assessment.</p>
    </section>
  );
}

function AmountCard({ s, draft, reload }: { s: CreditState; draft: AppBundle | null; reload: () => Promise<void> }) {
  const ids = useId();
  const p = s.program;
  const cap = Math.max(p.min_amount, Math.min(p.max_amount, s.limit?.platform_cap ?? p.max_amount));
  const [amount, setAmount] = useState<number>(draft?.application.requested_amount ?? Math.min(500000, cap));
  const [purpose, setPurpose] = useState(draft?.application.purpose ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const platformOk = s.checks.subscription && s.checks.kyc && s.checks.business && s.checks.bank;
  const valid = amount >= p.min_amount && amount <= cap && amount % 1000 === 0;
  const suspended = s.limit?.status === 'suspended';

  const save = async (submit: boolean) => {
    setBusy(submit ? 'submit' : 'save');
    try {
      const id = await saveDraft(amount, purpose.trim());
      if (submit) { await submitCredit(id); toast.success('Application submitted. BulkSkart checks eligibility, then sends it to the lending partner.'); }
      else toast.success('Amount saved.');
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(null); }
  };

  return (
    <section id="amt-card" className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="amt">
      <h2 id="amt" className="flex items-center gap-2 text-base font-black"><IndianRupee className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Select your credit amount</h2>
      {suspended ? <p className="text-[13px]">Business credit is paused for your account. Please contact BulkSkart support.</p> : (
        <>
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <span className="text-3xl font-black text-[#FF5A00]">{money(amount)}</span>
              <span className="text-[12px] text-muted-foreground">{money(p.min_amount)} – {money(cap)}</span>
            </div>
            <input type="range" min={p.min_amount} max={cap} step={10000} value={Math.min(Math.max(amount, p.min_amount), cap)}
              onChange={(e) => setAmount(Number(e.target.value))} className="w-full accent-[#FF5A00]" aria-label="Credit amount" />
            <Field htmlFor={`${ids}-a`} label="Or type the amount" hint="In steps of ₹1,000" error={!valid ? `Between ${money(p.min_amount)} and ${money(cap)}, in steps of ₹1,000` : undefined}>
              <TextInput id={`${ids}-a`} inputMode="numeric" value={String(amount)} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)} invalid={!valid} />
            </Field>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-[12.5px]">
            {p.zero_interest_confirmed
              ? <><b>About {money(Math.ceil(amount / p.tenure_months))} a month</b> for {p.tenure_months} months at 0% interest. Any processing fee is in the lender's KFS.</>
              : <>Repay over {p.tenure_months} months. Your EMI, interest, fees and APR are set out in the lender's Key Fact Statement before you accept anything.</>}
          </div>
          <Field htmlFor={`${ids}-p`} label="What is it for?" optional>
            <TextArea id={`${ids}-p`} value={purpose} onChange={(e) => setPurpose(e.target.value.slice(0, 300))} rows={2} placeholder="Raw material for an order, new machine, working capital…" />
          </Field>
          {platformOk && (
            <CheckRow checked={consent} onCheckedChange={setConsent}>
              I agree that BulkSkart may share my KYC, business and bank details and this application with the lending partner for a credit decision.
            </CheckRow>
          )}
          <div className="flex flex-wrap gap-2">
            <KitButton onClick={() => save(true)} disabled={!valid || !platformOk || !consent || busy !== null}>
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />} Submit application
            </KitButton>
            <KitButton variant="ghost" onClick={() => save(false)} disabled={!valid || busy !== null}>Save amount</KitButton>
          </div>
          {!platformOk && <p className="text-[12px] text-muted-foreground">Complete the first four eligibility checks to submit. You can save the amount now.</p>}
        </>
      )}
    </section>
  );
}

const STEP_ORDER = ['submitted', 'platform_approved', 'with_lender', 'lender_approved', 'agreement_accepted', 'active'];

function ApplicationCard({ b, s, reload }: { b: AppBundle; s: CreditState; reload: () => Promise<void> }) {
  const a = b.application;
  const [busy, setBusy] = useState(false);
  const idx = STEP_ORDER.indexOf(a.stage);
  const timeline: [string, string | null][] = [
    ['Submitted', a.submitted_at],
    ['Eligible (BulkSkart)', a.platform_decided_at],
    [`Sent to ${s.program.partner?.name ?? 'the lending partner'}`, a.sent_to_lender_at],
    ['Approved by the lender', a.lender_decision === 'approved' ? a.lender_decided_at : null],
    ['KFS and agreement accepted', a.agreement_accepted_at],
    ['First payout', b.disbursements.find((d) => d.status === 'disbursed')?.disbursed_at ?? null],
  ];
  const cancel = async () => {
    if (!window.confirm('Cancel this credit application?')) return;
    setBusy(true);
    try { await cancelCredit(a.id); toast.success('Application cancelled.'); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not cancel.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="app">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="app" className="text-base font-black">Your application</h2>
          <p className="text-[12px] text-muted-foreground">{money(a.requested_amount)} · {a.tenure_months} months{a.purpose ? ` · ${a.purpose}` : ''}</p>
        </div>
        <span className="rounded-full border border-[#FF5A00]/50 bg-[#FF5A00]/10 px-2.5 py-1 text-[11.5px] font-bold text-[#C24400] dark:text-[#FF8A3D]">{STAGE_LABEL[a.stage]}</span>
      </div>
      <ol className="space-y-1.5">
        {timeline.map(([label, at], i) => (
          <li key={label} className="flex items-center gap-2.5 text-[13px]">
            {at ? <Check className="h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" /> : i === idx + 1 ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#FF5A00]" aria-hidden="true" /> : <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className={cn('flex-1', !at && 'text-muted-foreground')}>{label}</span>
            {at && <time className="text-[11.5px] text-muted-foreground" dateTime={at}>{day(at)}</time>}
          </li>
        ))}
      </ol>
      {a.stage === 'with_lender' && <p className="rounded-xl bg-muted/40 p-3 text-[12.5px]">The lending partner is assessing your application. Nothing is approved until it decides; you will see its decision here.</p>}
      {['submitted', 'platform_approved', 'with_lender', 'lender_approved'].includes(a.stage) && (
        <button type="button" onClick={cancel} disabled={busy} className="text-[12px] font-bold text-muted-foreground underline hover:text-foreground">{busy ? 'Cancelling…' : 'Cancel application'}</button>
      )}
    </section>
  );
}

function KfsCard({ b, s, reload }: { b: AppBundle; s: CreditState; reload: () => Promise<void> }) {
  const a = b.application;
  const k = a.kfs;
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const partner = s.program.partner;
  if (!k) return null;
  const rows: [string, string][] = [
    ['Lender', partner ? `${partner.legal_name} (${partner.entity_type === 'bank' ? 'bank' : 'NBFC'})` : '—'],
    ['Sanctioned amount', money(k.sanctioned_amount)],
    ['Tenure', `${k.tenure_months} months · ${k.installments} instalments`],
    ['Interest rate', `${k.interest_rate_pct}% a year`],
    ['Annual percentage rate (APR)', `${k.apr_pct}%`],
    ['Processing fee', money(k.processing_fee)],
    ['EMI', money(k.emi_amount)],
    ['Total repayable', money(k.total_repayable)],
    ['Cooling-off (look-up) period', `${k.cooling_off_days} day${k.cooling_off_days === 1 ? '' : 's'}: you can exit by repaying the principal and the proportionate APR, without penalty`],
    ['Lender reference', a.lender_reference ?? '—'],
  ];
  const accept = async () => {
    setBusy(true);
    try { await acceptAgreement(a.id, a.kfs_sha256 ?? ''); toast.success('Accepted. You can now request a withdrawal.'); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not accept.'); }
    finally { setBusy(false); }
  };
  return (
    <section id="kfs-card" className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="kfs">
      <h2 id="kfs" className="flex items-center gap-2 text-base font-black"><FileText className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Key Fact Statement and loan agreement</h2>
      <p className="text-[12.5px] text-muted-foreground">Issued by the lender on {day(a.lender_decided_at)}. Read both before accepting.</p>
      <dl className="grid gap-x-4 gap-y-2 rounded-xl bg-muted/40 p-3 text-[13px] sm:grid-cols-2">
        {rows.map(([t, v]) => <div key={t} className="min-w-0"><dt className="text-[11.5px] font-bold text-muted-foreground">{t}</dt><dd className="break-words font-semibold">{v}</dd></div>)}
      </dl>
      <div className="flex flex-wrap gap-2">
        {b.documents.map((d) => (
          <button key={d.id} type="button" className="fk-btn is-ghost !min-h-[38px] !text-[12.5px]" onClick={() => openCreditDoc(d.id).catch((e) => toast.error(e.message))}>
            <FileText className="h-4 w-4" aria-hidden="true" /> {d.kind === 'kfs' ? 'KFS (PDF)' : d.kind === 'loan_agreement' ? 'Loan agreement' : d.kind === 'sanction_letter' ? 'Sanction letter' : d.file_name}
          </button>
        ))}
        {a.agreement_url && <a href={a.agreement_url} target="_blank" rel="noopener noreferrer" className="fk-btn is-ghost !min-h-[38px] !text-[12.5px]"><FileText className="h-4 w-4" aria-hidden="true" /> Agreement on the lender's site</a>}
      </div>
      {partner && (
        <p className="text-[11.5px] text-muted-foreground">Grievances: {partner.grievance_officer_name}{partner.grievance_email ? `, ${partner.grievance_email}` : ''}{partner.grievance_phone ? `, ${partner.grievance_phone}` : ''} (the lender's grievance officer).</p>
      )}
      {a.stage === 'lender_approved' ? (
        <>
          <CheckRow checked={agree} onCheckedChange={setAgree}>I have read the Key Fact Statement and the loan agreement from {partner?.legal_name ?? 'the lender'}, and I accept them.</CheckRow>
          <KitButton onClick={accept} disabled={!agree || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />} Accept KFS and agreement</KitButton>
        </>
      ) : <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Check className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Accepted on {when(a.agreement_accepted_at)}</p>}
    </section>
  );
}

const PAYOUT_LABEL = { requested: 'Requested', sent_to_lender: 'With the lender', disbursed: 'Paid', failed: 'Failed', cancelled: 'Cancelled' } as const;

function WithdrawCard({ b, s, reload }: { b: AppBundle; s: CreditState; reload: () => Promise<void> }) {
  const ids = useId();
  const [amount, setAmount] = useState(String(Math.floor(b.withdrawable)));
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const ok = n > 0 && n <= b.withdrawable && (n >= 1000 || n === b.withdrawable);
  const go = async () => {
    setBusy(true);
    try { await requestWithdrawal(b.application.id, n); toast.success('Withdrawal requested. The lender pays it into your bank account.'); setAmount(''); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not request.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="wd">
      <h2 id="wd" className="flex items-center gap-2 text-base font-black"><Banknote className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Withdraw</h2>
      <p className="text-[12.5px] text-muted-foreground">
        The lender pays straight into your verified bank account{s.bank ? ` (XXXX${s.bank.last4} · ${s.bank.ifsc})` : ''}. BulkSkart never holds the money.
        A withdrawal shows as paid only when the lender confirms it with a UTR.
      </p>
      {b.withdrawable > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field htmlFor={`${ids}-w`} label={`Amount (up to ${money(b.withdrawable)})`}>
            <TextInput id={`${ids}-w`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} invalid={Boolean(amount) && !ok} />
          </Field>
          <KitButton onClick={go} disabled={!ok || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />} Request withdrawal</KitButton>
        </div>
      )}
      {b.disbursements.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {b.disbursements.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-[13px]">
              <span className="font-bold">{money(d.amount)}</span>
              <span className="text-[12px] text-muted-foreground">{day(d.requested_at)} · to XXXX{d.bank_account_last4}{d.utr ? ` · UTR ${d.utr}` : ''}{d.status === 'failed' && d.note ? ` · ${d.note}` : ''}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', d.status === 'disbursed' ? 'bg-[#FF5A00] text-white' : d.status === 'failed' ? 'bg-red-600 text-white' : 'border border-border')}>{PAYOUT_LABEL[d.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RepaymentCard({ s }: { s: CreditState }) {
  const schedule = s.applications.flatMap((b) => b.schedule);
  const repayments = s.applications.flatMap((b) => b.repayments);
  const totals = useMemo(() => ({ due: schedule.reduce((n, i) => n + Number(i.amount), 0), paid: schedule.reduce((n, i) => n + Number(i.paid_amount), 0) }), [schedule]);
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-black"><CalendarClock className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Repayment schedule</h2>
        <p className="text-[12px] text-muted-foreground">From the lender. Paid {money(totals.paid)} of {money(totals.due)}. Repayments go directly to the lender (usually by NACH auto-debit).</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12.5px]">
            <thead className="text-[11px] uppercase text-muted-foreground"><tr><th className="py-1.5">#</th><th>Due</th><th className="text-right">EMI</th><th className="text-right">Principal</th><th className="text-right">Interest</th><th className="text-right">Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {schedule.map((i) => (
                <tr key={i.id}>
                  <td className="py-1.5">{i.installment_no}</td><td>{day(i.due_date)}</td><td className="text-right font-semibold">{money(i.amount)}</td>
                  <td className="text-right">{money(i.principal)}</td><td className="text-right">{money(i.interest)}</td>
                  <td className="text-right">{i.paid_amount >= i.amount - 0.005 ? <span className="font-bold text-[#C24400] dark:text-[#FF8A3D]">Paid</span>
                    : isOverdue(i) ? <span className="font-bold text-red-600 dark:text-red-400">Overdue</span> : i.paid_amount > 0 ? 'Part paid' : 'Due'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="min-w-0 space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-black"><History className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Repayment history</h2>
        {repayments.length === 0 ? <p className="text-[13px] text-muted-foreground">No repayments yet.</p> : (
          <ul className="divide-y divide-border">
            {repayments.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="font-bold">{money(r.amount)}</span>
                <span className="text-[12px] text-muted-foreground">{day(r.paid_at)} · {r.method.toUpperCase()} · {r.reference}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const HISTORY_LABEL: Record<string, string> = {
  amount_selected: 'Amount selected', submitted: 'Application submitted', platform_approve: 'Eligible (BulkSkart)', platform_reject: 'Not eligible (BulkSkart)',
  sent_to_lender: 'Sent to the lending partner', lender_approved: 'Approved by the lender', lender_rejected: 'Declined by the lender',
  agreement_accepted: 'KFS and agreement accepted', withdrawal_requested: 'Withdrawal requested', disbursement_sent_to_lender: 'Withdrawal with the lender',
  disbursement_disbursed: 'Paid out by the lender', disbursement_failed: 'Payout failed', schedule_set: 'Repayment schedule received',
  repayment_recorded: 'Repayment received by the lender', closed_repaid: 'Fully repaid', cancelled: 'Application cancelled', document_added: 'Lender document added',
  document_viewed: 'Document opened', limit_updated: 'Credit limit updated',
};

function HistoryCard({ s }: { s: CreditState }) {
  const items = s.history.filter((h) => h.action !== 'document_viewed').slice(0, 30);
  if (!items.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-black"><Landmark className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Activity</h2>
      <ul className="divide-y divide-border">
        {items.map((h, i) => (
          <li key={`${h.created_at}-${i}`} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[13px] font-semibold">{HISTORY_LABEL[h.action] ?? h.action.replace(/_/g, ' ')}{h.actor_role === 'lender' ? ' (from the lender)' : ''}</span>
            <time className="text-[11.5px] text-muted-foreground" dateTime={h.created_at}>{when(h.created_at)}</time>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Every step is recorded in an audit log that cannot be changed.</p>
    </section>
  );
}

