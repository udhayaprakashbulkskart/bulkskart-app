/**
 * /dashboard/admin/loan-kyc — review loan KYC: documents, steps, approval, lending partner hand-off and the partner's decision.
 * Admins cannot mark Aadhaar verified (DigiLocker only) and cannot approve a loan: they record the lending partner's decision.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { ArrowLeft, Check, ClipboardList, Loader2, RefreshCw, Search, Send, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Field, KitButton, NativeSelect, TextInput } from '@/components/formkit';
import '@/components/formkit/formkit.css';
import { DocumentRow, StageTracker, StatusBadge } from '@/components/loanKyc/KycBits';
import { cn } from '@/lib/utils';
import {
  type AdminDetail, type AdminList, CHECK_LABEL, DOC_LABEL, ENTITY_LABEL, type KycSettings, REQUEST_STATUS_LABEL, STEP_LABEL, type StepKey,
  VERIFIED_VIA_LABEL, adminApplications, adminDecision, adminDetail, adminDocumentAction, adminForward, adminPurgeExpired, adminRecordDecision,
  adminStepAction, adminUpdateSettings, day, money, openDocument, when,
} from '@/lib/loanKyc/api';
import { supabase } from '@/db/supabase';

const FILTERS: { key: string; label: string }[] = [
  { key: 'review', label: 'To review' },
  { key: 'resubmission', label: 'Resubmission' },
  { key: 'kyc', label: 'KYC in progress' },
  { key: 'verified', label: 'KYC verified' },
  { key: 'partner', label: 'With partner' },
  { key: 'decided', label: 'Decided' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'all', label: 'All' },
];

/** How long a submitted application has waited; past the promised time it is shown in red (the promise is in working hours). */
function SinceSubmitted({ at, hours }: { at: string; hours: number }) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000));
  const text = mins < 60 ? `${mins} min` : mins < 2880 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${Math.floor(mins / 1440)} days`;
  return <span className={mins > hours * 60 ? 'font-bold text-red-600 dark:text-red-400' : 'font-bold text-foreground'}>Waiting {text} since submission</span>;
}

/** Asks for a reason (the applicant sees it). Returns null when cancelled. */
function askReason(what: string): string | null {
  const v = window.prompt(`${what}\n\nWrite the reason. The applicant will see it.`);
  if (v === null) return null;
  if (v.trim().length < 3) { toast.error('Please write a reason (at least 3 characters).'); return null; }
  return v.trim();
}

export default function AdminLoanKycPage() {
  const [filter, setFilter] = useState('review');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<AdminList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [reviewHours, setReviewHours] = useState(2);
  useEffect(() => {
    supabase.from('kyc_settings').select('review_hours').maybeSingle().then(({ data }) => { if (data?.review_hours) setReviewHours(data.review_hours); });
  }, []);

  const load = useCallback(async () => {
    try { setList(await adminApplications(filter, query)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load.'); }
  }, [filter, query]);
  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <PageMeta title="Loan KYC | Admin | BulkSkart" description="Review business loan KYC." robots="noindex, nofollow" />
      <div className="fk-skin mx-auto w-full max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /> Loan KYC</h1>
          <div className="flex gap-2">
            <KitButton variant="ghost" onClick={() => setShowSettings((v) => !v)}><Settings2 className="h-4 w-4" aria-hidden="true" /> Settings</KitButton>
            <KitButton variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</KitButton>
          </div>
        </header>
        <p className="text-[12.5px] text-muted-foreground">BulkSkart verifies KYC and hands applications to lending partners. Only the lending partner approves or declines a loan; record their decision here.</p>
        {showSettings && <SettingsCard />}

        {openId ? (
          <DetailView id={openId} onBack={() => { setOpenId(null); load(); }} />
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                  className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-bold', filter === f.key ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-border hover:bg-muted')}>
                  {f.label}{list?.counts?.[f.key] ? ` (${list.counts[f.key]})` : ''}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }} className="flex gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Search applicants</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, company or city" className="!pl-9" />
              </label>
              <KitButton type="submit">Search</KitButton>
            </form>
            {error && <p className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">{error}</p>}
            {!list && !error && <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>}
            {list && list.rows.length === 0 && <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No applications here.</p>}
            {list && list.rows.length > 0 && (
              <ul className="space-y-2">
                {list.rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setOpenId(r.id)} className="w-full space-y-2 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[#FF5A00]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black">{r.business_name || r.request_company || r.full_name || 'Applicant'}</p>
                          <p className="truncate text-[12px] text-muted-foreground">{[r.full_name, r.email, r.request_city].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black">{money(r.amount, r.currency)}</p>
                          {r.kyc_status ? <StatusBadge status={r.kyc_status} /> : <span className="text-[11px] text-muted-foreground">KYC not started</span>}
                        </div>
                      </div>
                      <StageTracker app={r} />
                      <p className="text-[11.5px] text-muted-foreground">
                        {r.submitted_at && r.kyc_status === 'in_progress' ? <SinceSubmitted at={r.submitted_at} hours={reviewHours} /> : <>Updated {when(r.updated_at)}</>}
                        {r.docs_to_review ? ` · ${r.docs_to_review} document(s) to review` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const ids = useId();
  const [d, setD] = useState<AdminDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [partner, setPartner] = useState('');
  const [reference, setReference] = useState('');
  const [decision, setDecision] = useState<'approved_by_partner' | 'declined_by_partner'>('approved_by_partner');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try { setD(await adminDetail(id)); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load.'); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusy(null); }
  };

  if (!d) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>;
  const p = d.profile;
  const a = d.application;

  return (
    <div className="space-y-4">
      <KitButton variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All applications</KitButton>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-black">{p?.business_name || d.request?.company_name || d.applicant?.full_name}</h2>
            <p className="text-[12.5px] text-muted-foreground">{[d.applicant?.full_name, d.applicant?.email, d.request?.phone, d.request?.city].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black">{money(a.amount, a.currency)}{a.tenure_months ? ` · ${a.tenure_months} mo` : ''}</p>
            {p && <StatusBadge status={p.status} />}
          </div>
        </div>
        <StageTracker app={a} />
        {a.purpose && <p className="text-[12.5px]">For: {a.purpose}</p>}
        <p className="text-[12px] text-muted-foreground">
          Requested {day(a.created_at)} · Consent {p?.consent_at ? `${when(p.consent_at)} (v${p.consent_version})` : 'not given'} · Sharing with lending partner {a.share_consent_at ? `agreed ${when(a.share_consent_at)}` : 'not agreed yet'}
        </p>
      </section>

      {!p ? <p className="rounded-2xl border border-border bg-card p-4 text-sm">The applicant has not started KYC.</p> : (
        <>
          <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-black">Steps</h3>
            <ul className="divide-y divide-border">
              {(['pan', 'aadhaar', 'business', 'bank'] as const).map((s) => (
                <StepRow key={s} step={s} d={d} busy={busy} act={act} />
              ))}
            </ul>
          </section>

          <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-black">Documents</h3>
            {d.missing_documents.length > 0 && <p className="text-[12.5px]"><b>Missing:</b> {d.missing_documents.map((m) => DOC_LABEL[m] ?? m).join(', ')}</p>}
            {d.documents.filter((x) => x.status !== 'purged').length === 0 ? <p className="text-[12.5px] text-muted-foreground">No documents uploaded.</p> : (
              <ul className="space-y-2">
                {d.documents.filter((x) => x.status !== 'purged').map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} busy={busy === doc.id} onOpen={() => openDocument(doc.id).catch((e) => toast.error(e.message))}>
                    {doc.status !== 'accepted' && (
                      <button type="button" className="fk-btn is-primary !min-h-[36px] !px-3 !text-[12px]" disabled={busy === doc.id}
                        onClick={() => act(doc.id, () => adminDocumentAction(doc.id, 'accept'), 'Document accepted')}><Check className="h-3.5 w-3.5" aria-hidden="true" /> Accept</button>
                    )}
                    <button type="button" className="fk-btn is-ghost !min-h-[36px] !px-3 !text-[12px]" disabled={busy === doc.id}
                      onClick={() => { const r = askReason('Ask for a new document'); if (r) act(doc.id, () => adminDocumentAction(doc.id, 'request_resubmission', r), 'New document requested'); }}>Ask for new</button>
                    <button type="button" className="fk-btn is-danger !min-h-[36px] !px-3 !text-[12px]" disabled={busy === doc.id}
                      onClick={() => { const r = askReason('Reject this document'); if (r) act(doc.id, () => adminDocumentAction(doc.id, 'reject', r), 'Document rejected'); }}><X className="h-3.5 w-3.5" aria-hidden="true" /> Reject</button>
                  </DocumentRow>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-black">KYC decision</h3>
            <p className="text-[12.5px] text-muted-foreground">Approve only when every step is verified. Rejecting or asking for changes needs a reason the applicant will see.</p>
            <div className="flex flex-wrap gap-2">
              <KitButton disabled={busy === 'decision' || p.status === 'verified' || !!p.rejected_at || !p.submitted_at || !(['pan', 'aadhaar', 'business', 'bank'] as const).every((s) => p[`${s}_status` as const] === 'verified')}
                onClick={() => act('decision', () => adminDecision(p.id, 'approve', 'All checks complete'), 'KYC verified')}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Approve KYC
              </KitButton>
              <KitButton variant="ghost" disabled={busy === 'decision' || !!p.rejected_at} onClick={() => { const r = askReason('Ask the applicant for changes'); if (r) act('decision', () => adminDecision(p.id, 'request_resubmission', r), 'Resubmission requested'); }}>
                Request resubmission
              </KitButton>
              {p.rejected_at ? (
                <KitButton variant="ghost" disabled={busy === 'decision'} onClick={() => { const r = askReason('Reopen this KYC'); if (r) act('decision', () => adminDecision(p.id, 'reopen', r), 'Reopened'); }}>Reopen</KitButton>
              ) : (
                <KitButton variant="danger" disabled={busy === 'decision'} onClick={() => { const r = askReason('Reject this KYC (final)'); if (r) act('decision', () => adminDecision(p.id, 'reject', r), 'KYC rejected'); }}>Reject KYC</KitButton>
              )}
            </div>
          </section>
        </>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="font-black">Lending partner</h3>
        {a.stage === 'verification' && p?.status === 'verified' ? (
          a.share_consent_at ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field htmlFor={`${ids}-p`} label="Lending partner (bank / NBFC)" required><TextInput id={`${ids}-p`} value={partner} onChange={(e) => setPartner(e.target.value)} /></Field>
              <Field htmlFor={`${ids}-r`} label="Partner reference" optional><TextInput id={`${ids}-r`} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
              <KitButton disabled={partner.trim().length < 2 || busy === 'fwd'} onClick={() => act('fwd', () => adminForward(a.id, partner.trim(), reference.trim()), 'Sent to the lending partner')}>
                <Send className="h-4 w-4" aria-hidden="true" /> Mark as sent
              </KitButton>
            </div>
          ) : <p className="text-[12.5px]">The applicant has not agreed to share with a lending partner yet.</p>
        ) : a.stage === 'partner_review' ? (
          <div className="space-y-2">
            <p className="text-[13px]">With <b>{a.lending_partner}</b>{a.partner_reference ? ` (ref ${a.partner_reference})` : ''} since {day(a.forwarded_at)}. Record the partner's decision when they send it:</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field htmlFor={`${ids}-d`} label="Partner's decision">
                <NativeSelect id={`${ids}-d`} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                  <option value="approved_by_partner">Approved by the partner</option>
                  <option value="declined_by_partner">Declined by the partner</option>
                </NativeSelect>
              </Field>
              {decision === 'approved_by_partner' && (
                <Field htmlFor={`${ids}-a`} label="Sanctioned amount" optional><TextInput id={`${ids}-a`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              )}
              <Field htmlFor={`${ids}-n`} label="Note from the partner" required><TextInput id={`${ids}-n`} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
            <KitButton disabled={note.trim().length < 3 || busy === 'dec'}
              onClick={() => act('dec', () => adminRecordDecision(a.id, decision, decision === 'approved_by_partner' && Number(amount) > 0 ? Number(amount) : null, note.trim()), 'Decision recorded')}>
              Record partner's decision
            </KitButton>
          </div>
        ) : a.stage === 'decision' ? (
          <p className="text-[13px]">{a.decision === 'approved_by_partner' ? 'Approved' : 'Declined'} by <b>{a.lending_partner}</b>{a.decision_amount ? ` · ${money(a.decision_amount, a.currency)}` : ''} · {day(a.decided_at)} — {a.decision_note}</p>
        ) : <p className="text-[12.5px] text-muted-foreground">Available once KYC is verified.</p>}
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 font-black"><ClipboardList className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Checks and audit log</h3>
        <ul className="divide-y divide-border text-[12.5px]">
          {d.checks.map((c) => (
            <li key={c.id} className="py-1.5">
              <b>{CHECK_LABEL[c.check_type]}</b> · {REQUEST_STATUS_LABEL[c.status]} · {c.provider}{c.environment !== 'none' ? ` (${c.environment})` : ''} · {when(c.created_at)}
              {c.message && <span className="block text-muted-foreground">{c.message}</span>}
            </li>
          ))}
          {d.logs.map((l) => (
            <li key={`l${l.id}`} className="py-1.5 text-muted-foreground">
              {when(l.created_at)} · {l.actor_role} · {l.action.replace(/_/g, ' ')}{typeof l.detail?.note === 'string' && l.detail.note ? ` — ${l.detail.note}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StepRow({ step, d, busy, act }: {
  step: Exclude<StepKey, 'review'>; d: AdminDetail; busy: string | null; act: (k: string, fn: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const p = d.profile!;
  const st = p[`${step}_status` as const];
  const via = step === 'pan' ? p.pan_verified_via : step === 'aadhaar' ? p.aadhaar_verified_via : step === 'business' ? p.business_verified_via : d.bank?.verified_via;
  const key = `step-${step}`;
  const details = step === 'pan' ? [p.pan_masked, p.pan_name && `name given: ${p.pan_name}`, p.pan_registered_name && `IT records: ${p.pan_registered_name}`]
    : step === 'aadhaar' ? [p.aadhaar_last4 && `XXXX XXXX ${p.aadhaar_last4}`, p.aadhaar_name]
    : step === 'business' ? [p.business_name, p.entity_type && ENTITY_LABEL[p.entity_type], p.gstin && `GSTIN ${p.gstin}`, p.gst_legal_name && `GST: ${p.gst_legal_name} (${p.gst_status ?? '?'})`,
        p.udyam_number, p.cin && `CIN ${p.cin}`, p.business_pan_masked && `PAN ${p.business_pan_masked}`]
    : [d.bank && `XXXX${d.bank.account_last4} · ${d.bank.ifsc}`, d.bank?.account_holder_name, d.bank?.bank_name, d.bank?.name_at_bank && `bank name: ${d.bank.name_at_bank} (${d.bank.name_match_result ?? '?'})`];
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">{STEP_LABEL[step]}</b>
        <StatusBadge status={st} />
        {st === 'verified' && via && <span className="text-[11.5px] text-muted-foreground">{VERIFIED_VIA_LABEL[via]}</span>}
      </div>
      <p className="text-[12.5px] text-muted-foreground">{details.filter(Boolean).join(' · ') || 'Not provided yet'}</p>
      {p.step_notes?.[step] && <p className="text-[12px]">Note: {p.step_notes[step]}</p>}
      <div className="flex flex-wrap gap-1.5">
        {st !== 'verified' && (
          <button type="button" className="fk-btn is-primary !min-h-[34px] !px-3 !text-[12px]" disabled={busy === key}
            onClick={() => act(key, () => adminStepAction(p.id, step, 'verify_by_document', 'Verified from the accepted documents'), 'Step verified by document review')}>
            Verify from documents
          </button>
        )}
        <button type="button" className="fk-btn is-ghost !min-h-[34px] !px-3 !text-[12px]" disabled={busy === key}
          onClick={() => { const r = askReason(`Ask the applicant to update ${STEP_LABEL[step]}`); if (r) act(key, () => adminStepAction(p.id, step, 'request_resubmission', r), 'Resubmission requested'); }}>
          Request resubmission
        </button>
        <button type="button" className="fk-btn is-danger !min-h-[34px] !px-3 !text-[12px]" disabled={busy === key}
          onClick={() => { const r = askReason(`Reject ${STEP_LABEL[step]}`); if (r) act(key, () => adminStepAction(p.id, step, 'reject', r), 'Step rejected'); }}>
          Reject
        </button>
        {(st === 'verified' || st === 'rejected' || st === 'in_progress') && (
          <button type="button" className="fk-btn is-ghost !min-h-[34px] !px-3 !text-[12px]" disabled={busy === key}
            onClick={() => act(key, () => adminStepAction(p.id, step, 'reopen'), 'Step reopened')}>Reopen</button>
        )}
      </div>
      {step === 'aadhaar' && st !== 'verified' && (
        <p className="text-[11.5px] text-muted-foreground">
          Accept only a masked Aadhaar (first 8 digits hidden); reject a full one. Scan its QR code with UIDAI's official mAadhaar or Aadhaar QR Scanner
          app and check the name and photo match before you verify.
        </p>
      )}
    </li>
  );
}

function SettingsCard() {
  const ids = useId();
  const [s, setS] = useState<KycSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from('kyc_settings').select('document_retention_days, abandoned_retention_days, max_file_mb, review_hours, consent_version').maybeSingle()
      .then(({ data }) => setS((data ?? null) as KycSettings | null));
  }, []);
  if (!s) return null;
  const save = async () => {
    setBusy(true);
    try { setS(await adminUpdateSettings({ document_retention_days: s.document_retention_days, abandoned_retention_days: s.abandoned_retention_days, max_file_mb: s.max_file_mb, review_hours: s.review_hours })); toast.success('Saved'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  const purge = async () => {
    if (!window.confirm('Delete every document whose retention period has ended? This cannot be undone.')) return;
    setBusy(true);
    try {
      const r = await adminPurgeExpired();
      if (r.outcome === 'integration_pending') toast.message('The kyc service is not connected (integration pending).');
      else toast.success(`${r.purged ?? 0} document(s) deleted.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-black">Settings</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field htmlFor={`${ids}-0`} label="Call back within (working hours)" hint="Shown to applicants; 1 – 72"><TextInput id={`${ids}-0`} type="number" min={1} max={72} value={s.review_hours} onChange={(e) => setS({ ...s, review_hours: Number(e.target.value) })} /></Field>
        <Field htmlFor={`${ids}-1`} label="Keep after submission (days)" hint="30 – 3650"><TextInput id={`${ids}-1`} type="number" min={30} max={3650} value={s.document_retention_days} onChange={(e) => setS({ ...s, document_retention_days: Number(e.target.value) })} /></Field>
        <Field htmlFor={`${ids}-2`} label="Keep if never submitted or withdrawn (days)" hint="7 – 1825"><TextInput id={`${ids}-2`} type="number" min={7} max={1825} value={s.abandoned_retention_days} onChange={(e) => setS({ ...s, abandoned_retention_days: Number(e.target.value) })} /></Field>
        <Field htmlFor={`${ids}-3`} label="Largest file (MB)" hint="1 – 10"><TextInput id={`${ids}-3`} type="number" min={1} max={10} value={s.max_file_mb} onChange={(e) => setS({ ...s, max_file_mb: Number(e.target.value) })} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <KitButton onClick={save} disabled={busy}>Save</KitButton>
        <KitButton variant="ghost" onClick={purge} disabled={busy}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete expired documents now</KitButton>
      </div>
    </section>
  );
}
