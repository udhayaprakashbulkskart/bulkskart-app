/**
 * /dashboard/admin/credit — Business Credit: applications (platform eligibility, hand-off to the lender, the lender's
 * decision, KFS and agreement, payouts, schedule, repayments), credit limits and lending partners.
 * Lender results are copied from the lender's own records with its reference, or arrive by its signed webhook.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ArrowLeft, Check, FileUp, Landmark, Loader2, RefreshCw, Search, Send, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { CheckRow, Field, KitButton, NativeSelect, TextInput } from '@/components/formkit';
import '@/components/formkit/formkit.css';
import { cn } from '@/lib/utils';
import { day, money, when } from '@/lib/loanKyc/api';
import {
  type AdminDetail, type AdminRow, type CreditDoc, type Kfs, type LimitRow, type PartnerRow, type ProductRow, STAGE_LABEL, adminDetail, adminDisbursement,
  adminLenderDecision, adminLimits, adminList, adminPartners, adminPlatformDecision, adminRepayment, adminSaveProduct, adminSavePartner, adminSendToLender,
  adminSetLimit, adminSetSchedule, adminUploadCreditDoc, openCreditDoc, scheduleFromKfs,
} from '@/lib/credit/api';

const FILTERS = [
  { key: 'review', label: 'Eligibility review' }, { key: 'to_send', label: 'To send to lender' }, { key: 'with_lender', label: 'With lender' },
  { key: 'agreement', label: 'Awaiting agreement' }, { key: 'payouts', label: 'Payout requests' }, { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Drafts' }, { key: 'closed', label: 'Closed / rejected' }, { key: 'all', label: 'All' },
];

function reason(what: string): string | null {
  const v = window.prompt(`${what}\n\nWrite the reason.`);
  if (v === null) return null;
  if (v.trim().length < 3) { toast.error('Please write a reason (at least 3 characters).'); return null; }
  return v.trim();
}

export default function AdminCreditPage() {
  const [tab, setTab] = useState<'apps' | 'limits' | 'partners'>('apps');
  return (
    <DashboardLayout>
      <PageMeta title="Business Credit | Admin | BulkSkart" description="Manage business credit applications, limits and lending partners." robots="noindex, nofollow" />
      <div className="fk-skin mx-auto w-full max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        <h1 className="flex items-center gap-2 text-2xl font-black"><Landmark className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /> Business Credit</h1>
        <p className="text-[12.5px] text-muted-foreground">
          BulkSkart checks platform eligibility and hands applications to the lending partner. Approvals, amounts, payouts and repayments are the lender's:
          record them only from the lender's own records, with its reference.
        </p>
        <div className="flex gap-1.5" role="tablist">
          {([['apps', 'Applications'], ['limits', 'Credit limits'], ['partners', 'Lending partners']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('rounded-full border px-3 py-1.5 text-[12.5px] font-bold', tab === k ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-border hover:bg-muted')}>{l}</button>
          ))}
        </div>
        {tab === 'apps' && <Applications />}
        {tab === 'limits' && <Limits />}
        {tab === 'partners' && <Partners />}
      </div>
    </DashboardLayout>
  );
}

// ── applications ─────────────────────────────────────────────────────────────────────────────────────────────────────
function Applications() {
  const [filter, setFilter] = useState('review');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<{ rows: AdminRow[]; counts: Record<string, number> } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setList(await adminList(filter, query)); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load.'); }
  }, [filter, query]);
  useEffect(() => { load(); }, [load]);
  if (openId) return <Detail id={openId} onBack={() => { setOpenId(null); load(); }} />;
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold', filter === f.key ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted')}>
            {f.label}{list?.counts?.[f.key] ? ` (${list.counts[f.key]})` : ''}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }} className="flex gap-2">
        <label className="relative flex-1"><span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, company or lender reference" className="!pl-9" />
        </label>
        <KitButton type="submit">Search</KitButton>
        <KitButton variant="ghost" onClick={load} aria-label="Refresh"><RefreshCw className="h-4 w-4" aria-hidden="true" /></KitButton>
      </form>
      {!list ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>
        : list.rows.length === 0 ? <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No applications here.</p> : (
          <ul className="space-y-2">
            {list.rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 text-left hover:border-[#FF5A00]">
                  <span className="min-w-0">
                    <span className="block font-black">{r.company_name || r.full_name || 'Supplier'}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{[r.full_name, r.email, r.partner_name].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-black">{money(r.requested_amount)}{r.approved_amount ? <span className="text-[12px] font-semibold text-muted-foreground"> · approved {money(r.approved_amount)}</span> : null}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{STAGE_LABEL[r.stage]}{r.pending_withdrawals ? ` · ${r.pending_withdrawals} payout request(s)` : ''} · {when(r.updated_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

const EMPTY_KFS = { tenure_months: '12', interest_rate_pct: '', apr_pct: '', processing_fee: '', emi_amount: '', installments: '12', total_repayable: '', cooling_off_days: '3' };

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const ids = useId();
  const [d, setD] = useState<AdminDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [product, setProduct] = useState('');
  const [sendRef, setSendRef] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [ref, setRef] = useState('');
  const [approved, setApproved] = useState('');
  const [kfs, setKfs] = useState(EMPTY_KFS);
  const [agreementUrl, setAgreementUrl] = useState('');
  const [lenderNote, setLenderNote] = useState('');
  const [docKind, setDocKind] = useState<CreditDoc['kind']>('loan_agreement');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [firstDue, setFirstDue] = useState('');
  const [matches, setMatches] = useState(false);
  const [rep, setRep] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'nach', reference: '' });
  const [cap, setCap] = useState('');

  const load = useCallback(async () => {
    try { const x = await adminDetail(id); setD(x); setCap(x.limit?.platform_cap != null ? String(x.limit.platform_cap) : ''); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load.'); }
  }, [id]);
  useEffect(() => { load(); adminPartners().then((p) => { const live = p.products.filter((x) => x.status === 'active'); setProducts(live); setProduct(live[0]?.id ?? ''); }).catch(() => {}); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed.'); } finally { setBusy(null); }
  };
  const preview = useMemo(() => (d?.application.kfs && firstDue ? scheduleFromKfs(d.application.kfs, d.drawn > 0 ? d.disbursements.filter((x) => x.status === 'disbursed').reduce((n, x) => n + Number(x.amount), 0) : Number(d.application.approved_amount), firstDue) : []), [d, firstDue]);

  if (!d) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>;
  const a = d.application;
  const kfsValue = (): Kfs | null => {
    const n = (v: string) => Number(v);
    const amt = Number(approved);
    if (!(amt > 0)) return null;
    return { sanctioned_amount: amt, tenure_months: n(kfs.tenure_months), interest_rate_pct: n(kfs.interest_rate_pct), apr_pct: n(kfs.apr_pct), processing_fee: n(kfs.processing_fee),
      emi_amount: n(kfs.emi_amount), installments: n(kfs.installments), total_repayable: n(kfs.total_repayable), cooling_off_days: n(kfs.cooling_off_days) };
  };
  const checkRow = (label: string, v: boolean) => (
    <li key={label} className="flex items-center gap-2 text-[12.5px]">{v ? <Check className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> : <X className="h-4 w-4 text-red-500" aria-hidden="true" />}{label}</li>
  );

  return (
    <div className="space-y-4">
      <KitButton variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All applications</KitButton>
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-black">{d.company?.company_name ?? d.supplier?.full_name}</h2>
            <p className="text-[12.5px] text-muted-foreground">{[d.supplier?.full_name, d.supplier?.email, d.supplier?.phone, d.company?.city].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black">{money(a.requested_amount)} · {a.tenure_months} mo</p>
            <p className="text-[12px] font-bold text-[#C24400] dark:text-[#FF8A3D]">{STAGE_LABEL[a.stage]}</p>
          </div>
        </div>
        {a.purpose && <p className="text-[12.5px]">For: {a.purpose}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-bold">Eligibility now</p>
            <ul className="mt-1 space-y-0.5">
              {checkRow('Paid subscription', d.checks_now.subscription)}{checkRow('KYC verified', d.checks_now.kyc)}
              {checkRow('Business profile verified', d.checks_now.business)}{checkRow('Bank account verified', d.checks_now.bank)}
              {checkRow('Lender approval', d.checks_now.lender)}
            </ul>
          </div>
          <div className="text-[12.5px]">
            <p><b>Submitted:</b> {when(a.submitted_at)}</p>
            <p><b>Lender reference:</b> {a.lender_reference ?? '—'}</p>
            {a.approved_amount != null && <p><b>Approved by the lender:</b> {money(a.approved_amount)} ({a.lender_decision_source === 'lender_api' ? 'from the lender\'s webhook' : 'recorded by an admin from the lender'})</p>}
            <p><b>Withdrawable:</b> {money(d.withdrawable)} · <b>Drawn/requested:</b> {money(d.drawn)}</p>
          </div>
        </div>
      </section>

      {a.stage === 'submitted' && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-black">Platform eligibility</h3>
          <div className="flex flex-wrap gap-2">
            <KitButton disabled={busy !== null || !(d.checks_now.subscription && d.checks_now.kyc && d.checks_now.business && d.checks_now.bank)}
              onClick={() => act('pe', () => adminPlatformDecision(a.id, 'approve', 'Eligibility checks verified'), 'Marked eligible')}><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Approve eligibility</KitButton>
            <KitButton variant="danger" disabled={busy !== null} onClick={() => { const r = reason('Reject platform eligibility'); if (r) act('pe', () => adminPlatformDecision(a.id, 'reject', r), 'Rejected'); }}>Reject</KitButton>
          </div>
        </section>
      )}

      {a.stage === 'platform_approved' && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-black">Send to the lending partner</h3>
          {products.length === 0 ? <p className="text-[12.5px]">No live lending partner product. Add one under <b>Lending partners</b>.</p> : (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field htmlFor={`${ids}-pr`} label="Product"><NativeSelect id={`${ids}-pr`} value={product} onChange={(e) => setProduct(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
              <Field htmlFor={`${ids}-sr`} label="Lender's application reference" optional><TextInput id={`${ids}-sr`} value={sendRef} onChange={(e) => setSendRef(e.target.value)} /></Field>
              <KitButton disabled={!product || busy !== null} onClick={() => act('send', () => adminSendToLender(a.id, product, sendRef), 'Marked as sent to the lender')}><Send className="h-4 w-4" aria-hidden="true" /> Mark as sent</KitButton>
            </div>
          )}
        </section>
      )}

      {a.stage === 'with_lender' && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-black">Record the lender's decision</h3>
          <p className="text-[12px] text-muted-foreground">Copy it from the lender's sanction letter / KFS. The supplier sees these figures exactly.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field htmlFor={`${ids}-dc`} label="Decision"><NativeSelect id={`${ids}-dc`} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}><option value="approved">Approved by the lender</option><option value="rejected">Declined by the lender</option></NativeSelect></Field>
            <Field htmlFor={`${ids}-rf`} label="Lender reference" required><TextInput id={`${ids}-rf`} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            {decision === 'approved' && <Field htmlFor={`${ids}-am`} label="Approved (sanctioned) amount" required><TextInput id={`${ids}-am`} inputMode="decimal" value={approved} onChange={(e) => setApproved(e.target.value)} /></Field>}
          </div>
          {decision === 'approved' && (
            <div className="grid gap-2 sm:grid-cols-4">
              {([['interest_rate_pct', 'Interest % a year'], ['apr_pct', 'APR %'], ['processing_fee', 'Processing fee ₹'], ['emi_amount', 'EMI ₹'], ['installments', 'Instalments'],
                ['tenure_months', 'Tenure (months)'], ['total_repayable', 'Total repayable ₹'], ['cooling_off_days', 'Cooling-off days']] as const).map(([k, l]) => (
                <Field key={k} htmlFor={`${ids}-${k}`} label={l} required><TextInput id={`${ids}-${k}`} inputMode="decimal" value={kfs[k]} onChange={(e) => setKfs({ ...kfs, [k]: e.target.value })} /></Field>
              ))}
              <Field htmlFor={`${ids}-au`} label="Agreement link on the lender's site" optional wide><TextInput id={`${ids}-au`} value={agreementUrl} onChange={(e) => setAgreementUrl(e.target.value)} placeholder="https://" /></Field>
            </div>
          )}
          <Field htmlFor={`${ids}-ln`} label="Note from the lender" optional><TextInput id={`${ids}-ln`} value={lenderNote} onChange={(e) => setLenderNote(e.target.value)} /></Field>
          <KitButton disabled={ref.trim().length < 3 || busy !== null || (decision === 'approved' && !kfsValue())}
            onClick={() => act('ld', () => adminLenderDecision(a.id, decision, decision === 'approved' ? Number(approved) : null, decision === 'approved' ? kfsValue() : null, ref.trim(), agreementUrl.trim(), lenderNote.trim()), 'Lender decision recorded')}>
            Record lender decision
          </KitButton>
        </section>
      )}

      {['with_lender', 'lender_approved', 'agreement_accepted', 'active'].includes(a.stage) && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-black">Lender documents</h3>
          {d.documents.length > 0 && (
            <div className="flex flex-wrap gap-2">{d.documents.map((x) => <button key={x.id} type="button" className="fk-btn is-ghost !min-h-[36px] !text-[12px]" onClick={() => openCreditDoc(x.id).catch((e) => toast.error(e.message))}>{x.kind.replace('_', ' ')} · {day(x.uploaded_at)}</button>)}</div>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field htmlFor={`${ids}-dk`} label="Document"><NativeSelect id={`${ids}-dk`} value={docKind} onChange={(e) => setDocKind(e.target.value as CreditDoc['kind'])}>
              <option value="loan_agreement">Loan agreement</option><option value="kfs">Key Fact Statement</option><option value="sanction_letter">Sanction letter</option><option value="other">Other</option></NativeSelect></Field>
            <Field htmlFor={`${ids}-df`} label="File (PDF, JPG, PNG)"><input id={`${ids}-df`} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} className="block w-full min-w-0 rounded-xl border border-border bg-background p-2 text-[12.5px]" /></Field>
            <KitButton disabled={!docFile || busy !== null} onClick={() => docFile && act('doc', () => adminUploadCreditDoc(a.id, docKind, docFile), 'Uploaded (encrypted)')}><FileUp className="h-4 w-4" aria-hidden="true" /> Upload</KitButton>
          </div>
        </section>
      )}

      {d.disbursements.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-black">Withdrawals</h3>
          <ul className="divide-y divide-border">
            {d.disbursements.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px]"><b>{money(x.amount)}</b> → XXXX{x.bank_account_last4} · {x.bank_ifsc} · {x.status.replace('_', ' ')} · {when(x.requested_at)}{x.utr ? ` · UTR ${x.utr}` : ''}{x.note ? ` · ${x.note}` : ''}</span>
                {['requested', 'sent_to_lender'].includes(x.status) && (
                  <span className="flex flex-wrap gap-1.5">
                    {x.status === 'requested' && <button type="button" className="fk-btn is-ghost !min-h-[34px] !px-3 !text-[12px]" disabled={busy !== null}
                      onClick={() => { const r = window.prompt("Lender's reference for this payout request (optional)") ?? undefined; act(x.id, () => adminDisbursement(x.id, 'sent_to_lender', undefined, r), 'Marked as sent to the lender'); }}>Sent to lender</button>}
                    <button type="button" className="fk-btn is-primary !min-h-[34px] !px-3 !text-[12px]" disabled={busy !== null}
                      onClick={() => { const utr = window.prompt("UTR of the lender's payment (from the lender)"); if (utr) act(x.id, () => adminDisbursement(x.id, 'disbursed', utr.trim()), 'Marked as paid by the lender'); }}>Paid (UTR)</button>
                    <button type="button" className="fk-btn is-danger !min-h-[34px] !px-3 !text-[12px]" disabled={busy !== null}
                      onClick={() => { const r = reason('Payout failed'); if (r) act(x.id, () => adminDisbursement(x.id, 'failed', undefined, undefined, r), 'Marked as failed'); }}>Failed</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {['agreement_accepted', 'active'].includes(a.stage) && a.kfs && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-black">Repayment schedule {d.schedule.length ? `(${d.schedule.length} instalments recorded)` : ''}</h3>
          {d.repayments.length === 0 && (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field htmlFor={`${ids}-fd`} label="First EMI date (from the lender)"><TextInput id={`${ids}-fd`} type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></Field>
              </div>
              {preview.length > 0 && (
                <>
                  <p className="text-[12px] text-muted-foreground">Worked out from the KFS terms on {money(preview.reduce((n, r) => n + r.principal, 0))}. Compare with the lender's schedule before saving.</p>
                  <div className="max-h-56 overflow-auto rounded-xl border border-border text-[12px]">
                    <table className="w-full"><tbody>{preview.map((r) => <tr key={r.installment_no} className="border-b border-border"><td className="p-1.5">{r.installment_no}</td><td>{r.due_date}</td><td className="text-right">{money(r.principal)}</td><td className="text-right">{money(r.interest)}</td><td className="p-1.5 text-right font-bold">{money(r.amount)}</td></tr>)}</tbody></table>
                  </div>
                  <CheckRow checked={matches} onCheckedChange={setMatches}>This matches the lender's repayment schedule.</CheckRow>
                  <KitButton disabled={!matches || busy !== null} onClick={() => act('sch', () => adminSetSchedule(a.id, preview), 'Schedule saved')}>Save schedule</KitButton>
                </>
              )}
            </>
          )}
          {a.stage === 'active' && d.schedule.length > 0 && (
            <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-5 sm:items-end">
              <Field htmlFor={`${ids}-ra`} label="Repayment ₹"><TextInput id={`${ids}-ra`} inputMode="decimal" value={rep.amount} onChange={(e) => setRep({ ...rep, amount: e.target.value })} /></Field>
              <Field htmlFor={`${ids}-rd`} label="Received on"><TextInput id={`${ids}-rd`} type="date" value={rep.date} onChange={(e) => setRep({ ...rep, date: e.target.value })} /></Field>
              <Field htmlFor={`${ids}-rm`} label="Method"><NativeSelect id={`${ids}-rm`} value={rep.method} onChange={(e) => setRep({ ...rep, method: e.target.value })}>{['nach', 'upi', 'neft', 'rtgs', 'imps', 'cheque', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</NativeSelect></Field>
              <Field htmlFor={`${ids}-rr`} label="Lender reference"><TextInput id={`${ids}-rr`} value={rep.reference} onChange={(e) => setRep({ ...rep, reference: e.target.value })} /></Field>
              <KitButton disabled={!(Number(rep.amount) > 0) || rep.reference.trim().length < 4 || busy !== null}
                onClick={() => act('rep', () => adminRepayment(a.id, Number(rep.amount), `${rep.date}T12:00:00+05:30`, rep.method, rep.reference.trim()), 'Repayment recorded')}>Record</KitButton>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="font-black">Supplier credit limit</h3>
        <p className="text-[12.5px]">Sanctioned by the lender: <b>{d.limit?.sanctioned_limit != null ? money(d.limit.sanctioned_limit) : '—'}</b>{d.limit?.lender_reference ? ` (ref ${d.limit.lender_reference})` : ''} · Status: {d.limit?.status ?? 'active'}</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field htmlFor={`${ids}-cap`} label="BulkSkart cap on what can be applied for" optional hint="Empty = product maximum"><TextInput id={`${ids}-cap`} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} /></Field>
          <KitButton variant="ghost" disabled={busy !== null} onClick={() => act('cap', () => adminSetLimit(a.user_id, cap ? Number(cap) : null, 'active'), 'Limit saved')}>Save cap</KitButton>
          {d.limit?.status === 'suspended'
            ? <KitButton variant="ghost" disabled={busy !== null} onClick={() => act('cap', () => adminSetLimit(a.user_id, cap ? Number(cap) : null, 'active', 'Resumed'), 'Resumed')}>Resume</KitButton>
            : <KitButton variant="danger" disabled={busy !== null} onClick={() => { const r = reason('Suspend business credit for this supplier'); if (r) act('cap', () => adminSetLimit(a.user_id, cap ? Number(cap) : null, 'suspended', r), 'Suspended'); }}>Suspend</KitButton>}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="font-black">Audit log</h3>
        <ul className="divide-y divide-border text-[12.5px]">
          {d.logs.map((l) => <li key={l.id} className="py-1.5 text-muted-foreground">{when(l.created_at)} · {l.actor_role} · {l.action.replace(/_/g, ' ')}{typeof l.detail?.note === 'string' && l.detail.note ? ` — ${l.detail.note}` : ''}</li>)}
        </ul>
      </section>
    </div>
  );
}

// ── limits ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function Limits() {
  const [rows, setRows] = useState<LimitRow[] | null>(null);
  const [search, setSearch] = useState('');
  const load = useCallback(async (q = '') => { try { setRows(await adminLimits(q)); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load.'); } }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); load(search.trim()); }} className="flex gap-2">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" aria-label="Search limits" />
        <KitButton type="submit">Search</KitButton>
      </form>
      <p className="text-[12px] text-muted-foreground">Limits are set from a supplier's application. The sanctioned limit comes only from the lender's decision.</p>
      {!rows ? <Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /> : rows.length === 0 ? <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No limits yet.</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 text-[13px]">
              <span><b>{r.company_name ?? r.full_name}</b> <span className="text-muted-foreground">{r.email}</span></span>
              <span>Cap {r.platform_cap != null ? money(r.platform_cap) : 'product max'} · Sanctioned {r.sanctioned_limit != null ? money(r.sanctioned_limit) : '—'} · <b className={r.status === 'suspended' ? 'text-red-600' : ''}>{r.status}</b></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── lending partners ─────────────────────────────────────────────────────────────────────────────────────────────────
const NEW_PARTNER: Partial<PartnerRow> = { code: '', name: '', legal_name: '', entity_type: 'nbfc', rbi_registration_no: '', grievance_officer_name: '', grievance_email: '', grievance_phone: '', website: '', integration_mode: 'manual', status: 'draft', notes: '' };

function Partners() {
  const ids = useId();
  const [data, setData] = useState<{ partners: PartnerRow[]; products: ProductRow[] } | null>(null);
  const [edit, setEdit] = useState<Partial<PartnerRow> | null>(null);
  const [prod, setProd] = useState<(Partial<ProductRow> & { rate_confirmed?: boolean }) | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await adminPartners()); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load.'); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (fn: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    try { await fn(); toast.success('Saved'); done(); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  };
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" />;
  const pf = (k: keyof PartnerRow, label: string, opts: { required?: boolean; hint?: string } = {}) => (
    <Field htmlFor={`${ids}-${k}`} label={label} required={opts.required} hint={opts.hint}>
      <TextInput id={`${ids}-${k}`} value={String(edit?.[k] ?? '')} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} disabled={k === 'code' && Boolean(edit?.id)} />
    </Field>
  );
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted-foreground">Only an RBI-regulated bank or NBFC can be the lender. A partner goes live with its RBI registration and grievance officer; a product goes live only for a live partner. Mark a rate as confirmed only with the partner's written confirmation.</p>
      {data.partners.map((p) => (
        <section key={p.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-black">{p.name} <span className="text-[12px] font-semibold text-muted-foreground">({p.legal_name}, {p.entity_type.toUpperCase()}, {p.rbi_registration_no ?? 'no RBI no.'})</span></h3>
              <p className="text-[12px] text-muted-foreground">Status: <b>{p.status}</b> · Integration: {p.integration_mode}{p.integration_mode === 'api' ? <> · webhook <code>/functions/v1/credit-lender-webhook?partner={p.code}</code>, secret <code>CREDIT_WEBHOOK_SECRET_{p.code.toUpperCase()}</code></> : ''}</p>
            </div>
            <KitButton variant="ghost" onClick={() => setEdit(p)}>Edit</KitButton>
          </div>
          <ul className="space-y-1.5">
            {data.products.filter((x) => x.partner_id === p.id).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[12.5px]">
                <span><b>{x.name}</b> · {money(x.min_amount)}–{money(x.max_amount)} · {x.tenure_months} mo · {x.interest_rate_pct ?? '?'}% {x.rate_confirmed_at ? `(confirmed, ref ${x.rate_confirmation_ref})` : '(not confirmed)'} · {x.status}</span>
                <button type="button" className="text-[12px] font-bold underline" onClick={() => setProd({ ...x, rate_confirmed: Boolean(x.rate_confirmed_at) })}>Edit</button>
              </li>
            ))}
          </ul>
          <button type="button" className="text-[12px] font-bold text-[#C24400] underline dark:text-[#FF8A3D]" onClick={() => setProd({ partner_id: p.id, name: 'Business Credit 12 months', min_amount: 50000, max_amount: 1500000, tenure_months: 12, interest_rate_pct: null, rate_confirmation_ref: '', processing_fee_pct: null, status: 'draft', rate_confirmed: false })}>+ Add product</button>
        </section>
      ))}
      {!edit && <KitButton onClick={() => setEdit({ ...NEW_PARTNER })}>Add lending partner</KitButton>}
      {edit && (
        <section className="space-y-2 rounded-2xl border border-[#FF5A00]/50 bg-card p-4">
          <h3 className="font-black">{edit.id ? 'Edit partner' : 'New lending partner'}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {pf('code', 'Code (lower case, for the webhook)', { required: true })}{pf('name', 'Display name', { required: true })}{pf('legal_name', 'Legal name', { required: true })}
            <Field htmlFor={`${ids}-et`} label="Type"><NativeSelect id={`${ids}-et`} value={edit.entity_type} onChange={(e) => setEdit({ ...edit, entity_type: e.target.value as 'bank' | 'nbfc' })}><option value="nbfc">NBFC</option><option value="bank">Bank</option></NativeSelect></Field>
            {pf('rbi_registration_no', 'RBI registration / licence no.')}{pf('grievance_officer_name', 'Grievance officer')}{pf('grievance_email', 'Grievance email')}{pf('grievance_phone', 'Grievance phone')}{pf('website', 'Website')}
            <Field htmlFor={`${ids}-im`} label="Integration"><NativeSelect id={`${ids}-im`} value={edit.integration_mode} onChange={(e) => setEdit({ ...edit, integration_mode: e.target.value as 'manual' | 'api' })}><option value="manual">Manual (admins record the lender's results)</option><option value="api">API (signed webhook)</option></NativeSelect></Field>
            <Field htmlFor={`${ids}-st`} label="Status"><NativeSelect id={`${ids}-st`} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as PartnerRow['status'] })}><option value="draft">Draft</option><option value="active">Live</option><option value="paused">Paused</option></NativeSelect></Field>
          </div>
          <div className="flex gap-2"><KitButton disabled={busy} onClick={() => save(() => adminSavePartner(edit), () => setEdit(null))}>Save partner</KitButton><KitButton variant="ghost" onClick={() => setEdit(null)}>Cancel</KitButton></div>
        </section>
      )}
      {prod && (
        <section className="space-y-2 rounded-2xl border border-[#FF5A00]/50 bg-card p-4">
          <h3 className="font-black">{prod.id ? 'Edit product' : 'New product'}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field htmlFor={`${ids}-pn`} label="Name" required><TextInput id={`${ids}-pn`} value={prod.name ?? ''} onChange={(e) => setProd({ ...prod, name: e.target.value })} /></Field>
            <Field htmlFor={`${ids}-mn`} label="Minimum ₹"><TextInput id={`${ids}-mn`} inputMode="numeric" value={String(prod.min_amount ?? '')} onChange={(e) => setProd({ ...prod, min_amount: Number(e.target.value) })} /></Field>
            <Field htmlFor={`${ids}-mx`} label="Maximum ₹"><TextInput id={`${ids}-mx`} inputMode="numeric" value={String(prod.max_amount ?? '')} onChange={(e) => setProd({ ...prod, max_amount: Number(e.target.value) })} /></Field>
            <Field htmlFor={`${ids}-tn`} label="Tenure (months)"><TextInput id={`${ids}-tn`} inputMode="numeric" value={String(prod.tenure_months ?? '')} onChange={(e) => setProd({ ...prod, tenure_months: Number(e.target.value) })} /></Field>
            <Field htmlFor={`${ids}-ir`} label="Interest % a year"><TextInput id={`${ids}-ir`} inputMode="decimal" value={prod.interest_rate_pct == null ? '' : String(prod.interest_rate_pct)} onChange={(e) => setProd({ ...prod, interest_rate_pct: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field htmlFor={`${ids}-pf`} label="Processing fee %"><TextInput id={`${ids}-pf`} inputMode="decimal" value={prod.processing_fee_pct == null ? '' : String(prod.processing_fee_pct)} onChange={(e) => setProd({ ...prod, processing_fee_pct: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field htmlFor={`${ids}-cr`} label="Partner's written confirmation (reference)"><TextInput id={`${ids}-cr`} value={prod.rate_confirmation_ref ?? ''} onChange={(e) => setProd({ ...prod, rate_confirmation_ref: e.target.value })} /></Field>
            <Field htmlFor={`${ids}-ps`} label="Status"><NativeSelect id={`${ids}-ps`} value={prod.status} onChange={(e) => setProd({ ...prod, status: e.target.value as ProductRow['status'] })}><option value="draft">Draft</option><option value="active">Live</option><option value="paused">Paused</option></NativeSelect></Field>
          </div>
          <CheckRow checked={Boolean(prod.rate_confirmed)} onCheckedChange={(v) => setProd({ ...prod, rate_confirmed: v })}>The partner has confirmed this interest rate in writing (needed before "0% interest" is shown).</CheckRow>
          <div className="flex gap-2"><KitButton disabled={busy} onClick={() => save(() => adminSaveProduct(prod), () => setProd(null))}>Save product</KitButton><KitButton variant="ghost" onClick={() => setProd(null)}>Cancel</KitButton></div>
        </section>
      )}
    </div>
  );
}
