/**
 * /dashboard/loans — the applicant's business loan applications and KYC.
 * Loan request (from the loan calculator) → KYC → Verification → Lending partner review → Loan decision.
 * BulkSkart is not the lender: lending partners decide, and their decision is shown as theirs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calculator, ClipboardCheck, History, Info, ListChecks, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { CheckRow, KitButton } from '@/components/formkit';
import '@/components/formkit/formkit.css';
import { IntegrationNotice, StageTracker, StatusBadge } from '@/components/loanKyc/KycBits';
import KycWizard from '@/components/loanKyc/KycWizard';
import {
  CHECK_LABEL, CONSENT_TEXT, type Checks, type LoanApplication, type MyKyc, REQUEST_STATUS_LABEL, STEP_LABEL, aadhaarStatus,
  claimPendingRequest, day, giveConsent, integrationChecks, loadMyKyc, money, nextSteps, when, withdrawApplication,
} from '@/lib/loanKyc/api';

const ACTION_LABEL: Record<string, string> = {
  loan_request_received: 'Loan request received',
  consent_given: 'KYC consent given',
  pan_saved: 'PAN saved',
  business_saved: 'Business details saved',
  bank_saved: 'Bank account saved',
  document_uploaded: 'Document uploaded',
  document_removed: 'Document removed',
  document_viewed: 'Document opened',
  document_accept: 'Document accepted by reviewer',
  document_reject: 'Document rejected by reviewer',
  document_request_resubmission: 'Reviewer asked for a new document',
  submitted_for_review: 'Submitted for verification',
  step_verify_by_document: 'Step verified by reviewer',
  step_reject: 'Step rejected by reviewer',
  step_request_resubmission: 'Reviewer asked you to update a step',
  step_reopen: 'Step reopened',
  kyc_approve: 'KYC verified',
  kyc_reject: 'KYC rejected',
  kyc_request_resubmission: 'Reviewer asked for changes',
  kyc_reopen: 'KYC reopened',
  forwarded_to_partner: 'Sent to lending partner',
  partner_decision_recorded: 'Lending partner decision recorded',
  application_withdrawn: 'Application withdrawn',
  check_recorded: 'Verification check',
};

const STAGE_TEXT: Record<LoanApplication['stage'], string> = {
  kyc: 'KYC to complete',
  verification: 'Verification',
  partner_review: 'With the lending partner',
  decision: 'Decided by the lending partner',
  withdrawn: 'Withdrawn',
};

export default function LoanKycPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<MyKyc | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handledReturn = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([loadMyKyc(), integrationChecks()]);
      setData(d);
      setChecks(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your loan applications.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await claimPendingRequest();
      // back from DigiLocker
      const ref = params.get('ref');
      if (params.get('kyc') === 'aadhaar' && ref && !handledReturn.current) {
        handledReturn.current = true;
        try {
          const r = await aadhaarStatus(ref);
          if (r.outcome === 'verified') toast.success('Aadhaar verified through DigiLocker.');
          else if (r.outcome === 'requested') toast.message('DigiLocker has not confirmed yet', { description: r.message ?? 'Open the Aadhaar step and try again in a moment.' });
          else if (r.message) toast.message('Aadhaar', { description: r.message });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not read the DigiLocker result.');
        }
        setParams({}, { replace: true });
      }
      await reload();
    })();
  }, [params, reload, setParams]);

  const active = data?.applications.find((a) => a.stage !== 'withdrawn' && a.stage !== 'decision') ?? null;

  return (
    <DashboardLayout>
      <PageMeta title="Business Loan & KYC | BulkSkart" description="Your business loan applications and KYC verification." robots="noindex, nofollow" />
      <div className="mx-auto w-full max-w-5xl space-y-5 px-3 py-5 sm:px-4">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /> Business Loan &amp; KYC</h1>
          <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-[12.5px] leading-relaxed">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />
            <span><b>BulkSkart is not a lender.</b> We collect and verify your KYC, then share your application with a lending partner (a bank or NBFC) after you confirm. The lending partner decides on the loan, its amount and its terms.</span>
          </p>
        </header>

        {error && <p className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">{error}</p>}
        {!data && !error && <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>}

        {data && checks && (
          <>
            {data.applications.length === 0 ? (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
                <p className="font-black">You have no loan applications yet.</p>
                <p className="text-sm text-muted-foreground">Work out the monthly payment on the loan calculator and submit a loan request. Then come back here to complete your KYC.</p>
                <Link to="/loan-calculator" className="fk-btn is-primary inline-flex"><Calculator className="h-4 w-4" aria-hidden="true" /> Open the loan calculator</Link>
              </div>
            ) : (
              <section className="space-y-3" aria-label="Applications">
                {data.applications.map((a) => <ApplicationCard key={a.id} app={a} reload={reload} />)}
              </section>
            )}

            {active && (
              <>
                <IntegrationNotice checks={checks} />
                {!data.profile?.consent_at ? (
                  <ConsentCard applicationId={active.id} reload={reload} />
                ) : (
                  <>
                    <KycSummary data={data} checks={checks} />
                    <KycWizard data={data} checks={checks} application={active} reload={reload} />
                  </>
                )}
              </>
            )}
            {data.profile && <HistoryCard data={data} />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ApplicationCard({ app, reload }: { app: LoanApplication; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const canWithdraw = app.stage === 'kyc' || app.stage === 'verification' || app.stage === 'partner_review';
  const withdraw = async () => {
    if (!window.confirm('Withdraw this loan application? Processing stops, and your documents are deleted after the shorter retention period.')) return;
    setBusy(true);
    try { await withdrawApplication(app.id); toast.success('Application withdrawn.'); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not withdraw.'); }
    finally { setBusy(false); }
  };
  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-black">{money(app.amount, app.currency)}{app.tenure_months ? <span className="text-sm font-semibold text-muted-foreground"> · {app.tenure_months} months</span> : null}</p>
          <p className="text-[12px] text-muted-foreground">Requested {day(app.created_at)}{app.purpose ? ` · ${app.purpose}` : ''}</p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[11.5px] font-bold">{STAGE_TEXT[app.stage]}</span>
      </div>
      {app.stage !== 'withdrawn' && <StageTracker app={app} />}
      {app.lending_partner && (
        <p className="text-[12.5px]">Lending partner: <b>{app.lending_partner}</b>{app.partner_reference ? ` · Ref ${app.partner_reference}` : ''}{app.forwarded_at ? ` · sent ${day(app.forwarded_at)}` : ''}</p>
      )}
      {app.decision && (
        <div className={`rounded-xl border p-3 text-[13px] ${app.decision === 'approved_by_partner' ? 'border-[#FF5A00]/50 bg-[#FF5A00]/10' : 'border-border bg-muted/40'}`}>
          <b>{app.decision === 'approved_by_partner' ? `Approved by ${app.lending_partner}` : `Declined by ${app.lending_partner}`}</b>
          {app.decision_amount ? ` · ${money(app.decision_amount, app.currency)}` : ''} · {day(app.decided_at)}
          {app.decision_note && <p className="mt-1 text-[12.5px]">{app.decision_note}</p>}
          <p className="mt-1 text-[11.5px] text-muted-foreground">This decision is the lending partner's. The partner will contact you about the next steps.</p>
        </div>
      )}
      {canWithdraw && (
        <button type="button" onClick={withdraw} disabled={busy} className="text-[12px] font-bold text-muted-foreground underline hover:text-foreground">
          {busy ? 'Withdrawing…' : 'Withdraw application'}
        </button>
      )}
    </article>
  );
}

function ConsentCard({ applicationId, reload }: { applicationId: string; reload: () => Promise<void> }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try { await giveConsent(applicationId); toast.success('KYC started.'); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not start KYC.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="fk-skin space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="kyc-consent">
      <h2 id="kyc-consent" className="flex items-center gap-2 text-lg font-black"><ClipboardCheck className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Before you start KYC</h2>
      <p className="text-[13px] text-muted-foreground">Five steps: PAN, Aadhaar (through DigiLocker), business, bank account, then review and submit. Please read:</p>
      <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed">
        {CONSENT_TEXT.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <CheckRow checked={agree} onCheckedChange={setAgree}>I have read this and I give my consent.</CheckRow>
      <KitButton onClick={start} disabled={!agree || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />} Start KYC
      </KitButton>
    </section>
  );
}

function KycSummary({ data, checks }: { data: MyKyc; checks: Checks }) {
  const p = data.profile;
  if (!p) return null;
  const steps = nextSteps(data, checks);
  return (
    <section className="grid gap-3 md:grid-cols-2" aria-label="KYC status">
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-black">KYC status</h2>
          <StatusBadge status={p.status} />
        </div>
        {p.status_reason && (p.status === 'rejected' || p.status === 'resubmission_required') && <p className="text-[12.5px]">{p.status_reason}</p>}
        <ul className="grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
          {(['pan', 'aadhaar', 'business', 'bank', 'review'] as const).map((s) => (
            <li key={s} className="flex items-center justify-between gap-1 rounded-lg bg-muted/40 px-2 py-1.5">
              <span className="font-semibold">{STEP_LABEL[s]}</span>
              <StatusBadge status={p[`${s}_status` as const]} className="!text-[10px]" />
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-black"><ListChecks className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Next steps</h2>
        {steps.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-[13px]">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        ) : <p className="text-[13px] text-muted-foreground">Nothing to do right now.</p>}
      </div>
    </section>
  );
}

function HistoryCard({ data }: { data: MyKyc }) {
  const items = [
    ...data.checks.map((c) => ({
      id: `c-${c.id}`, at: c.created_at,
      title: `${CHECK_LABEL[c.check_type]}: ${REQUEST_STATUS_LABEL[c.status]}${c.environment === 'sandbox' ? ' (test mode)' : ''}`,
      note: c.message,
    })),
    ...data.logs.filter((l) => l.action !== 'check_recorded' && l.action !== 'document_viewed').map((l) => ({
      id: `l-${l.id}`, at: l.created_at, title: ACTION_LABEL[l.action] ?? l.action.replace(/_/g, ' '),
      note: typeof l.detail?.note === 'string' ? l.detail.note : null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4" aria-labelledby="kyc-history">
      <h2 id="kyc-history" className="flex items-center gap-2 text-base font-black"><History className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Verification history</h2>
      {items.length === 0 ? <p className="text-[13px] text-muted-foreground">Nothing yet.</p> : (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{i.title}</p>
                {i.note && <p className="text-[12px] text-muted-foreground">{i.note}</p>}
              </div>
              <time className="shrink-0 text-[11.5px] text-muted-foreground" dateTime={i.at}>{when(i.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
