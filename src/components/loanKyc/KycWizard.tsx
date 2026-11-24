/**
 * The applicant's five KYC steps: PAN, Aadhaar (DigiLocker), business, bank account, review & submit.
 * Each save goes to the kyc edge function, which checks the details with the provider when it is configured and
 * otherwise records "Integration Pending". This component never decides that anything is verified.
 */
import { useId, useMemo, useState } from 'react';
import { BadgeCheck, Building2, CreditCard, Fingerprint, Landmark, Loader2, Lock, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CheckRow, Field, KitButton, NativeSelect, TextInput } from '@/components/formkit';
import { cn } from '@/lib/utils';
import {
  type Checks, DOC_LABEL, DOCUMENT_TYPES, type DocumentType, ENTITY_LABEL, ENTITY_TYPES, type EntityType, type FnResult, type KycProfile,
  type LoanApplication, type MyKyc, STEP_LABEL, type StepKey, VERIFIED_VIA_LABEL, isValidAccount, isValidBusinessName, isValidCin,
  isValidGstin, isValidIfsc, isValidPan, isValidPersonName, isValidUdyam, normaliseAccount, normaliseCin, normaliseGstin, normaliseIfsc,
  normalisePan, normaliseUdyam, openDocument, removeDocument, saveBank, saveBusiness, savePan, startAadhaar, submitKyc, uploadDocument,
} from '@/lib/loanKyc/api';
import { DocumentRow, PendingBadge, StatusBadge } from './KycBits';

const STEP_ICON = { pan: CreditCard, aadhaar: Fingerprint, business: Building2, bank: Landmark, review: Send } as const;

export function stepEditable(p: KycProfile, step: Exclude<StepKey, 'review'>): boolean {
  if (!p.consent_at || p.rejected_at) return false;
  if (step !== 'aadhaar' && (p.review_status === 'in_progress' || p.review_status === 'verified')) return false;
  const st = p[`${step}_status` as const];
  return st !== 'verified' && st !== 'in_progress';
}

function report(r: FnResult, okText: string) {
  if (r.outcome === 'verified') toast.success('Verified.');
  else if (r.outcome === 'integration_pending') toast.message('Saved', { description: 'Automatic check: Integration Pending. Our team will verify it from your documents.' });
  else if (r.outcome === 'invalid') toast.error(r.message ?? 'Not accepted. Please check the details.');
  else if (r.outcome === 'error') toast.error(r.message ?? 'The check could not be completed. Please try again.');
  else if (r.message) toast.message(okText, { description: r.message });
  else toast.success(okText);
}

interface Props {
  data: MyKyc;
  checks: Checks;
  application: LoanApplication;
  reload: () => Promise<void>;
}

export default function KycWizard({ data, checks, application, reload }: Props) {
  const p = data.profile as KycProfile;
  const firstOpen = (['pan', 'aadhaar', 'business', 'bank'] as const).find((s) => p[`${s}_status` as const] !== 'verified' && stepEditable(p, s));
  const [tab, setTab] = useState<StepKey>(firstOpen ?? 'review');
  const statusOf = (s: StepKey) => p[`${s}_status` as const];

  return (
    <section className="fk-skin rounded-2xl border border-border bg-card" aria-label="KYC steps">
      <div className="flex gap-1 overflow-x-auto border-b border-border p-2" role="tablist">
        {(Object.keys(STEP_LABEL) as StepKey[]).map((s, i) => {
          const Icon = STEP_ICON[s];
          const st = statusOf(s);
          return (
            <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
              className={cn('flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-bold transition-colors',
                tab === s ? 'bg-[#FF5A00] text-white' : 'hover:bg-muted')}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{i + 1}. {STEP_LABEL[s]}</span>
              <span className={cn('h-2 w-2 rounded-full', st === 'verified' ? (tab === s ? 'bg-white' : 'bg-[#FF5A00]')
                : st === 'resubmission_required' || st === 'rejected' ? 'bg-red-500' : st === 'in_progress' ? 'bg-[#FF5A00]/50' : 'bg-muted-foreground/30')} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="p-4 sm:p-5" role="tabpanel">
        {tab === 'pan' && <PanStep p={p} data={data} checks={checks} reload={reload} />}
        {tab === 'aadhaar' && <AadhaarStep p={p} data={data} checks={checks} reload={reload} />}
        {tab === 'business' && <BusinessStep p={p} data={data} checks={checks} reload={reload} />}
        {tab === 'bank' && <BankStep p={p} data={data} checks={checks} reload={reload} />}
        {tab === 'review' && <ReviewStep p={p} data={data} checks={checks} application={application} reload={reload} onGo={setTab} />}
      </div>
    </section>
  );
}

function StepHeader({ p, step, children }: { p: KycProfile; step: Exclude<StepKey, 'review'>; children?: React.ReactNode }) {
  const st = p[`${step}_status` as const];
  const via = step === 'pan' ? p.pan_verified_via : step === 'aadhaar' ? p.aadhaar_verified_via : step === 'business' ? p.business_verified_via : null;
  const note = p.step_notes?.[step];
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-black">{STEP_LABEL[step]}</h3>
        <StatusBadge status={st} />
        {children}
      </div>
      {st === 'verified' && via && <p className="text-[12.5px] text-muted-foreground">Verified: {VERIFIED_VIA_LABEL[via]}.</p>}
      {note && st !== 'verified' && (
        <p className={cn('rounded-xl border p-2.5 text-[12.5px]', st === 'resubmission_required' || st === 'rejected' ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-muted/40')}>{note}</p>
      )}
      {!stepEditable(p, step) && st !== 'verified' && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Locked while it is under review.</p>
      )}
    </div>
  );
}

function checkBadge(state: string) {
  return state === 'integration_pending' ? <PendingBadge /> : state === 'sandbox' ? <PendingBadge label="Test mode" /> : null;
}

// ── documents for one step ─────────────────────────────────────────────────────────────────────────────────────────────
function StepDocuments({ step, types, data, checks, editable, reload }: {
  step: 'pan' | 'aadhaar' | 'business' | 'bank'; types: DocumentType[]; data: MyKyc; checks: Checks; editable: boolean; reload: () => Promise<void>;
}) {
  const ids = useId();
  const [docType, setDocType] = useState<DocumentType>(types[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const maxMb = data.settings?.max_file_mb ?? 5;
  const docs = data.documents.filter((d) => d.step === step);
  const storage = checks.documents !== 'integration_pending';

  const upload = async () => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) && !/\.(jpe?g|png|pdf)$/i.test(file.name)) { toast.error('Only JPG, PNG and PDF files are accepted.'); return; }
    if (file.size > maxMb * 1048576) { toast.error(`The file is larger than ${maxMb} MB.`); return; }
    setBusy('upload');
    try {
      const r = await uploadDocument(step, docType, file);
      if (r.outcome === 'integration_pending') toast.message('Secure document storage: Integration Pending', { description: 'Your file was not uploaded.' });
      else { toast.success('Uploaded (stored encrypted).'); setFile(null); }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-5 space-y-3 border-t border-border pt-4">
      <h4 className="text-[13.5px] font-black">Documents</h4>
      <p className="text-[12px] text-muted-foreground">Needed: {types.filter((t) => t !== 'other').map((t) => DOC_LABEL[t]).join(', ')}. JPG, PNG or PDF, up to {maxMb} MB each.</p>
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} busy={busy === d.id}
              onOpen={() => openDocument(d.id).catch((e) => toast.error(e.message))}
              onRemove={editable && d.status !== 'accepted' ? async () => {
                setBusy(d.id);
                try { await removeDocument(d.id); await reload(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove.'); } finally { setBusy(null); }
              } : undefined} />
          ))}
        </ul>
      )}
      {editable && (storage ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field htmlFor={`${ids}-t`} label="Document">
            <NativeSelect id={`${ids}-t`} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
              {types.map((t) => <option key={t} value={t}>{DOC_LABEL[t]}</option>)}
            </NativeSelect>
          </Field>
          <Field htmlFor={`${ids}-f`} label="File">
            <input id={`${ids}-f`} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full min-w-0 rounded-xl border border-border bg-background p-2 text-[12.5px] file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-[12px] file:font-bold" />
          </Field>
          <KitButton onClick={upload} disabled={!file || busy === 'upload'} className="sm:mb-[1px]">
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />} Upload
          </KitButton>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><PendingBadge /> Secure document storage is not connected yet, so uploads are off.</p>
      ))}
    </div>
  );
}

// ── 1. PAN ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function PanStep({ p, data, checks, reload }: { p: KycProfile; data: MyKyc; checks: Checks; reload: () => Promise<void> }) {
  const ids = useId();
  const editable = stepEditable(p, 'pan');
  const [pan, setPan] = useState('');
  const [name, setName] = useState(p.pan_name ?? '');
  const [busy, setBusy] = useState(false);
  const panOk = isValidPan(normalisePan(pan));
  const nameOk = isValidPersonName(name.trim());

  const save = async () => {
    setBusy(true);
    try { report(await savePan(normalisePan(pan), name.trim()), 'PAN saved'); setPan(''); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <StepHeader p={p} step="pan">{checkBadge(checks.pan)}</StepHeader>
      {p.pan_masked && (
        <p className="mb-3 text-[13px]">Saved PAN: <b className="font-mono">{p.pan_masked}</b>{p.pan_name ? ` · ${p.pan_name}` : ''}
          {p.pan_registered_name ? <> · Income Tax name: <b>{p.pan_registered_name}</b></> : null}</p>
      )}
      {editable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor={`${ids}-pan`} label={p.pan_masked ? 'Change PAN' : 'PAN'} required error={pan && !panOk ? 'Enter a valid 10-character PAN' : undefined}>
            <TextInput id={`${ids}-pan`} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} autoComplete="off" spellCheck={false} placeholder="ABCDE1234F" invalid={Boolean(pan && !panOk)} />
          </Field>
          <Field htmlFor={`${ids}-name`} label="Name as on PAN" required error={name && !nameOk ? 'Letters, spaces and dots only' : undefined}>
            <TextInput id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" invalid={Boolean(name && !nameOk)} />
          </Field>
          <div className="sm:col-span-2">
            <KitButton onClick={save} disabled={!panOk || !nameOk || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
              {checks.pan === 'integration_pending' ? 'Save PAN' : 'Save and verify PAN'}
            </KitButton>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Your PAN is stored encrypted; only the first and last two characters are shown.</p>
          </div>
        </div>
      )}
      {p.pan_status !== 'verified' && <StepDocuments step="pan" types={['pan_card']} data={data} checks={checks} editable={editable} reload={reload} />}
    </div>
  );
}

// ── 2. Aadhaar ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function AadhaarStep({ p, data, checks, reload }: { p: KycProfile; data: MyKyc; checks: Checks; reload: () => Promise<void> }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const editable = stepEditable(p, 'aadhaar');
  const pending = checks.aadhaar === 'integration_pending';

  const start = async () => {
    setBusy(true);
    try {
      const r = await startAadhaar();
      if (r.url) { window.location.assign(r.url); return; }
      report(r, 'DigiLocker');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'DigiLocker could not be opened.');
    }
    setBusy(false);
  };

  return (
    <div>
      <StepHeader p={p} step="aadhaar" />
      {p.aadhaar_status === 'verified' ? (
        <p className="text-[13px]">Aadhaar <b className="font-mono">XXXX XXXX {p.aadhaar_last4}</b>{p.aadhaar_name ? ` · ${p.aadhaar_name}` : ''}</p>
      ) : (
        <div className="space-y-3 text-[13px] leading-relaxed">
          <p>
            Upload a <b>masked Aadhaar</b>: the copy from the official myAadhaar website (UIDAI) that hides the first 8 digits. Please do not
            upload a full Aadhaar with all 12 digits visible; it will be rejected. Our team checks it and calls you back.
          </p>
          {pending ? (
            <p className="flex flex-wrap items-center gap-2 text-muted-foreground"><PendingBadge /> Instant verification through DigiLocker is not connected yet.</p>
          ) : editable ? (
            <>
              <CheckRow checked={consent} onCheckedChange={setConsent}>
                I consent to share my Aadhaar from DigiLocker with BulkSkart for this loan KYC. Only my name and the last 4 digits are kept.
              </CheckRow>
              <KitButton onClick={start} disabled={!consent || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Fingerprint className="h-4 w-4" aria-hidden="true" />} Continue to DigiLocker
              </KitButton>
              <p className="text-[11.5px] text-muted-foreground">
                Or verify instantly through DigiLocker: you sign in on DigiLocker's own site and choose to share your Aadhaar. BulkSkart never sees
                your OTP or PIN and keeps only your name and the last 4 digits. The link is valid for 10 minutes.
              </p>
            </>
          ) : null}
        </div>
      )}
      {p.aadhaar_status !== 'verified' && <StepDocuments step="aadhaar" types={['aadhaar_masked']} data={data} checks={checks} editable={editable} reload={reload} />}
    </div>
  );
}

// ── 3. Business ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function businessDocTypes(entity: EntityType | null, gstin: boolean, udyam: boolean): DocumentType[] {
  const out: DocumentType[] = [];
  if (gstin) out.push('gst_certificate');
  if (udyam) out.push('udyam_certificate');
  if (entity === 'private_limited' || entity === 'public_limited' || entity === 'llp') out.push('incorporation_certificate');
  if (entity === 'partnership') out.push('partnership_deed');
  if (entity && entity !== 'proprietorship') out.push('business_pan_card');
  out.push('other');
  return out;
}

function BusinessStep({ p, data, checks, reload }: { p: KycProfile; data: MyKyc; checks: Checks; reload: () => Promise<void> }) {
  const ids = useId();
  const editable = stepEditable(p, 'business');
  const [entity, setEntity] = useState<EntityType | ''>(p.entity_type ?? '');
  const [name, setName] = useState(p.business_name ?? '');
  const [gstin, setGstin] = useState(p.gstin ?? '');
  const [udyam, setUdyam] = useState(p.udyam_number ?? '');
  const [cin, setCin] = useState(p.cin ?? '');
  const [bpan, setBpan] = useState('');
  const [busy, setBusy] = useState(false);
  const company = entity === 'private_limited' || entity === 'public_limited' || entity === 'llp';
  const needsBpan = entity !== '' && entity !== 'proprietorship';
  const g = normaliseGstin(gstin), u = normaliseUdyam(udyam), c = normaliseCin(cin), b = normalisePan(bpan);
  const errors = {
    gstin: gstin && !isValidGstin(g) ? 'Enter a valid 15-character GSTIN' : undefined,
    udyam: udyam && !isValidUdyam(u) ? 'Format: UDYAM-XX-00-0000000' : undefined,
    cin: company && !cin ? 'Required for companies and LLPs' : cin && !isValidCin(c) ? 'Enter a valid CIN or LLPIN' : undefined,
    bpan: needsBpan && !bpan && !p.business_pan_masked ? 'Required' : bpan && !isValidPan(b) ? 'Enter a valid PAN' : undefined,
  };
  const ok = entity !== '' && isValidBusinessName(name.trim()) && !errors.gstin && !errors.udyam && !errors.cin && !(needsBpan && !isValidPan(b));
  const docTypes = useMemo(() => businessDocTypes(p.entity_type, Boolean(p.gstin), Boolean(p.udyam_number)), [p.entity_type, p.gstin, p.udyam_number]);

  const save = async () => {
    if (!entity) return;
    setBusy(true);
    try {
      report(await saveBusiness({ entity_type: entity, business_name: name.trim(), gstin: g || undefined, udyam_number: u || undefined, cin: c || undefined, business_pan: needsBpan ? b : undefined }), 'Business details saved');
      setBpan('');
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <StepHeader p={p} step="business">{p.gstin || gstin ? checkBadge(checks.gstin) : null}</StepHeader>
      {p.entity_type && (
        <p className="mb-3 text-[13px]"><b>{p.business_name}</b> · {ENTITY_LABEL[p.entity_type]}
          {p.gstin ? <> · GSTIN <span className="font-mono">{p.gstin}</span></> : null}
          {p.gst_legal_name ? <> · GST legal name: <b>{p.gst_legal_name}</b>{p.gst_status ? ` (${p.gst_status})` : ''}</> : null}</p>
      )}
      {editable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor={`${ids}-e`} label="Type of business" required>
            <NativeSelect id={`${ids}-e`} value={entity} onChange={(e) => setEntity(e.target.value as EntityType)}>
              <option value="">Choose…</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_LABEL[t]}</option>)}
            </NativeSelect>
          </Field>
          <Field htmlFor={`${ids}-n`} label="Business name (as registered)" required>
            <TextInput id={`${ids}-n`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
          </Field>
          <Field htmlFor={`${ids}-g`} label="GSTIN" optional hint="Checked with the GST records when connected." error={errors.gstin}>
            <TextInput id={`${ids}-g`} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} spellCheck={false} invalid={Boolean(errors.gstin)} />
          </Field>
          <Field htmlFor={`${ids}-u`} label="Udyam registration number" optional error={errors.udyam}>
            <TextInput id={`${ids}-u`} value={udyam} onChange={(e) => setUdyam(e.target.value.toUpperCase())} maxLength={19} placeholder="UDYAM-XX-00-0000000" spellCheck={false} invalid={Boolean(errors.udyam)} />
          </Field>
          {company && (
            <Field htmlFor={`${ids}-c`} label={entity === 'llp' ? 'LLPIN' : 'CIN'} required error={errors.cin}>
              <TextInput id={`${ids}-c`} value={cin} onChange={(e) => setCin(e.target.value.toUpperCase())} maxLength={21} spellCheck={false} invalid={Boolean(errors.cin)} />
            </Field>
          )}
          {needsBpan && (
            <Field htmlFor={`${ids}-b`} label={p.business_pan_masked ? `Business PAN (saved: ${p.business_pan_masked}; enter again to save changes)` : 'Business PAN'} required error={bpan ? errors.bpan : undefined}>
              <TextInput id={`${ids}-b`} value={bpan} onChange={(e) => setBpan(e.target.value.toUpperCase())} maxLength={10} autoComplete="off" spellCheck={false} invalid={Boolean(bpan && errors.bpan)} />
            </Field>
          )}
          <div className="sm:col-span-2">
            <KitButton onClick={save} disabled={!ok || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />} Save business details
            </KitButton>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Udyam and CIN are checked by a reviewer from the certificates you upload.</p>
          </div>
        </div>
      )}
      {p.entity_type && p.business_status !== 'verified' && <StepDocuments step="business" types={docTypes} data={data} checks={checks} editable={editable} reload={reload} />}
    </div>
  );
}

// ── 4. Bank ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function BankStep({ p, data, checks, reload }: { p: KycProfile; data: MyKyc; checks: Checks; reload: () => Promise<void> }) {
  const ids = useId();
  const editable = stepEditable(p, 'bank');
  const [holder, setHolder] = useState(data.bank?.account_holder_name ?? p.business_name ?? '');
  const [account, setAccount] = useState('');
  const [again, setAgain] = useState('');
  const [ifsc, setIfsc] = useState(data.bank?.ifsc ?? '');
  const [busy, setBusy] = useState(false);
  const a = normaliseAccount(account), i = normaliseIfsc(ifsc);
  const errors = {
    account: account && !isValidAccount(a) ? 'Enter a valid account number' : undefined,
    again: again && normaliseAccount(again) !== a ? 'The numbers do not match' : undefined,
    ifsc: ifsc && !isValidIfsc(i) ? 'Enter a valid 11-character IFSC' : undefined,
  };
  const ok = holder.trim().length >= 2 && isValidAccount(a) && normaliseAccount(again) === a && isValidIfsc(i);

  const save = async () => {
    setBusy(true);
    try { report(await saveBank({ holder_name: holder.trim(), account_number: a, ifsc: i }), 'Bank account saved'); setAccount(''); setAgain(''); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <StepHeader p={p} step="bank">{checkBadge(checks.bank)}</StepHeader>
      {data.bank && (
        <p className="mb-3 text-[13px]">Account <b className="font-mono">XXXX{data.bank.account_last4}</b> · {data.bank.ifsc}{data.bank.bank_name ? ` · ${data.bank.bank_name}` : ''}
          {data.bank.name_at_bank ? <> · Name at bank: <b>{data.bank.name_at_bank}</b></> : null}
          {data.bank.verified_via ? <span className="block text-[12px] text-muted-foreground">Verified: {VERIFIED_VIA_LABEL[data.bank.verified_via]}.</span> : null}</p>
      )}
      {editable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor={`${ids}-h`} label="Account holder name" required>
            <TextInput id={`${ids}-h`} value={holder} onChange={(e) => setHolder(e.target.value)} />
          </Field>
          <Field htmlFor={`${ids}-i`} label="IFSC" required error={errors.ifsc}>
            <TextInput id={`${ids}-i`} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} maxLength={11} spellCheck={false} invalid={Boolean(errors.ifsc)} />
          </Field>
          <Field htmlFor={`${ids}-a`} label="Account number" required error={errors.account}>
            <TextInput id={`${ids}-a`} value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" autoComplete="off" invalid={Boolean(errors.account)} />
          </Field>
          <Field htmlFor={`${ids}-a2`} label="Account number again" required error={errors.again}>
            <TextInput id={`${ids}-a2`} value={again} onChange={(e) => setAgain(e.target.value)} inputMode="numeric" autoComplete="off" onPaste={(e) => e.preventDefault()} invalid={Boolean(errors.again)} />
          </Field>
          <div className="sm:col-span-2">
            <KitButton onClick={save} disabled={!ok || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
              {checks.bank === 'integration_pending' ? 'Save bank account' : 'Save and verify account'}
            </KitButton>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Stored encrypted; only the last 4 digits are shown.</p>
          </div>
        </div>
      )}
      {data.bank && p.bank_status !== 'verified' && (
        <StepDocuments step="bank" types={['cancelled_cheque', 'bank_statement']} data={data} checks={checks} editable={editable} reload={reload} />
      )}
    </div>
  );
}

// ── 5. Review & submit ─────────────────────────────────────────────────────────────────────────────────────────────────
function ReviewStep({ p, data, checks, application, reload, onGo }: {
  p: KycProfile; data: MyKyc; checks: Checks; application: LoanApplication; reload: () => Promise<void>; onGo: (s: StepKey) => void;
}) {
  const [share, setShare] = useState(Boolean(application.share_consent_at));
  const [busy, setBusy] = useState(false);
  const detailsDone = Boolean(p.pan_masked && p.entity_type && data.bank);
  const blocked = (['pan', 'aadhaar', 'business', 'bank'] as const).some((s) => p[`${s}_status` as const] === 'resubmission_required' || p[`${s}_status` as const] === 'rejected');
  const underReview = p.review_status === 'in_progress';
  const alreadyShared = Boolean(application.share_consent_at) && (underReview || p.review_status === 'verified');
  const canSubmit = detailsDone && !blocked && data.missing.length === 0 && share && !underReview && !p.rejected_at && !alreadyShared;

  const submit = async () => {
    setBusy(true);
    try { await submitKyc(application.id); toast.success(`Submitted. Our team will verify your details and call you within ${data.settings?.review_hours ?? 2} working hours.`); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not submit.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-black">Review &amp; submit</h3>
        <StatusBadge status={p.review_status} />
      </div>
      {p.step_notes?.review && p.review_status !== 'verified' && <p className="rounded-xl border border-red-500/40 bg-red-500/5 p-2.5 text-[12.5px]">{p.step_notes.review}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {(['pan', 'aadhaar', 'business', 'bank'] as const).map((s) => (
          <li key={s} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="text-[13px] font-bold">{STEP_LABEL[s]}</span>
            <span className="flex items-center gap-2">
              {s === 'aadhaar' && checks.aadhaar === 'integration_pending' && p.aadhaar_status !== 'verified' && <PendingBadge />}
              <StatusBadge status={p[`${s}_status` as const]} />
              {p[`${s}_status` as const] !== 'verified' && <button type="button" onClick={() => onGo(s)} className="text-[12px] font-bold text-[#C24400] underline dark:text-[#FF8A3D]">Open</button>}
            </span>
          </li>
        ))}
      </ul>
      {data.missing.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-[12.5px]">
          <b>Documents still needed:</b> {data.missing.map((d) => DOC_LABEL[d] ?? d).join(', ')}.
        </div>
      )}
      <p className="text-[12.5px] text-muted-foreground">After you submit, our team verifies your details and documents and calls you on your registered number within {data.settings?.review_hours ?? 2} working hours.</p>
      {!underReview && !alreadyShared && !p.rejected_at && (
        <>
          <CheckRow checked={share} onCheckedChange={setShare}>
            I confirm the details are correct and agree that BulkSkart may share my KYC and this loan application with a lending partner (bank or NBFC)
            for deciding on this loan. BulkSkart is not the lender.
          </CheckRow>
          <KitButton onClick={submit} disabled={!canSubmit || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Submit for verification
          </KitButton>
          {!detailsDone && <p className="text-[12px] text-muted-foreground">Complete PAN, business and bank first.</p>}
        </>
      )}
      {underReview && <p className="text-[13px]">Submitted on {new Date(p.submitted_at ?? '').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Our team is verifying your details and will call you within {data.settings?.review_hours ?? 2} working hours.</p>}
      <p className="text-[11.5px] text-muted-foreground">
        Documents are kept for {data.settings?.document_retention_days ?? '—'} days after submission ({data.settings?.abandoned_retention_days ?? '—'} days if the application is not submitted or is withdrawn), then deleted.
      </p>
    </div>
  );
}
