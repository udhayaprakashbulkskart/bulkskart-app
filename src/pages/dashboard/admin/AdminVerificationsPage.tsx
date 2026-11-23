/**
 * Admin: business verifications for the Live Supplier Map.
 * Read each application, check the numbers on the official portals, open the private documents (signed links that
 * expire), check the factory pin, then approve / ask for more / reject / suspend / recheck. Every change is written to
 * verification_audit_log by the database (migration 00071), which also refuses to approve a company or LLP whose
 * CIN/LLPIN was not ticked as checked.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck, Building2, ChevronDown, Clock3, ExternalLink, FileText, History, Loader2, MapPin, Package, RefreshCw,
  ShieldAlert, ShieldCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  type AdminDecision, adminDecideBusiness, adminDecideLocation, adminHistory, adminListApplications, openPrivateDocument,
} from '@/lib/supplierMap/api';
import { timeAgo } from '@/lib/supplierMap/matchScore';
import { entityLabel, isIncorporated, mapDbError, panFromGstin } from '@/lib/supplierMap/registration';
import type { AdminApplication, AuditEntry, BusinessStatus } from '@/lib/supplierMap/types';
import { cn } from '@/lib/utils';

const LocationPickerMap = lazy(() => import('@/components/supplierMap/LocationPickerMap'));

const TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'needs_info', label: 'Needs info' },
  { key: 'locations', label: 'Locations to check' },
  { key: 'recheck_due', label: 'Recheck due' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'all', label: 'All' },
  { key: 'history', label: 'History' },
];

const PORTALS = {
  mca: 'https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html',
  gst: 'https://services.gst.gov.in/services/searchtp',
  udyam: 'https://udyamregistration.gov.in/Udyam_Verify.aspx',
};

const STATUS_TONE: Record<BusinessStatus, string> = {
  pending: 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
  needs_info: 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
  approved: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/12 text-red-600 dark:text-red-400',
  suspended: 'bg-red-500/12 text-red-600 dark:text-red-400',
};
const STATUS_LABEL: Record<BusinessStatus, string> = { pending: 'Pending', needs_info: 'Needs info', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' };

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminVerificationsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState<AdminApplication[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === 'history') {
      const { rows: h, error: e } = await adminHistory();
      setHistory(h);
      setError(e ? mapDbError(e) : null);
    } else {
      const { rows: r, error: e } = await adminListApplications(tab);
      setRows(r);
      setError(e ? mapDbError(e) : null);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  return (
    <DashboardLayout>
      <PageMeta title="Business Verifications | BulkSkart Admin" description="Check and approve manufacturers for the verified supplier map" robots="noindex, nofollow" />
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /> Business Verifications</h1>
            <p className="text-sm text-muted-foreground">Only approved businesses with a verified factory location, an active account and active products appear on the supplier map.</p>
          </div>
          {isAdmin && (
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-bold hover:border-[#FF5A00]">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" /> Refresh
            </button>
          )}
        </div>

        {!isAdmin ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-[#FF5A00]" aria-hidden="true" />
            <p className="mt-3 font-bold">Only admins can open this page</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Applications">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setOpenId(null); }}
                  className={cn('inline-flex min-h-[36px] shrink-0 items-center rounded-full border px-3.5 text-[12.5px] font-bold', tab === t.key ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-border hover:border-[#FF5A00]')}>
                  {t.key === 'history' && <History className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}{t.label}
                </button>
              ))}
            </div>

            {error ? (
              <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>
            ) : loading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" /></div>
            ) : tab === 'history' ? (
              <HistoryList entries={history} />
            ) : rows.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => (
                  <ApplicationCard key={r.company_id} a={r} open={openId === r.company_id} onToggle={() => setOpenId(openId === r.company_id ? null : r.company_id)} onChanged={load} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function HistoryList({ entries, compact = false }: { entries: AuditEntry[]; compact?: boolean }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <ul className={cn('divide-y divide-border rounded-xl border border-border', !compact && 'bg-card')}>
      {entries.map((h) => (
        <li key={`${h.created_at}-${h.subject}-${h.to_status}-${h.company_name}`} className="px-3 py-2 text-[12.5px]">
          <span className="text-muted-foreground">{when(h.created_at)}</span>
          {!compact && <> · <b>{h.company_name ?? 'Removed company'}</b></>}
          {' · '}{h.subject === 'business' ? 'Registration' : 'Location'}: {h.action === 'submitted' ? 'submitted' : `${h.from_status ?? '—'} → ${h.to_status}`}
          {' · '}<span className="text-muted-foreground">{h.actor_email ?? 'system'}</span>
          {h.note && <span className="block text-muted-foreground">“{h.note}”</span>}
        </li>
      ))}
    </ul>
  );
}

function ApplicationCard({ a, open, onToggle, onChanged }: { a: AdminApplication; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const { theme } = useTheme();
  const [checks, setChecks] = useState({ cin: a.cin_verified, gst: a.gst_verified, udyam: a.udyam_verified, registry: a.registry_verified });
  const [note, setNote] = useState('');
  const [locNote, setLocNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    if (open && history === null) adminHistory(a.company_id).then(({ rows }) => setHistory(rows));
  }, [open, history, a.company_id]);

  const incorporated = isIncorporated(a.entity_type);
  const loc = a.location;
  const recheckDue = a.status === 'approved' && a.recheck_due_at && new Date(a.recheck_due_at).getTime() < Date.now() + 30 * 86_400_000;

  const decide = async (d: AdminDecision) => {
    const ask: Record<AdminDecision, string> = {
      approve: `Approve ${a.company_name}? It appears on the map once its location is verified too.`,
      needs_info: `Ask ${a.company_name} for more information? They see your note.`,
      reject: `Reject ${a.company_name}? They see your note.`,
      suspend: `Suspend ${a.company_name}? It leaves the map at once.`,
      recheck: `Send ${a.company_name} back to review? It leaves the map until approved again.`,
    };
    if (!window.confirm(ask[d])) return;
    setBusy(d);
    const { error } = await adminDecideBusiness(a.company_id, d, note, checks);
    setBusy(null);
    if (error) {
      toast.error(mapDbError(error));
      return;
    }
    toast.success('Saved');
    setNote('');
    onChanged();
  };

  const decideLocation = async (d: 'verify' | 'reject') => {
    if (d === 'reject' && !locNote.trim()) {
      toast.error('Write why the location is rejected. The business sees it.');
      return;
    }
    setBusy(`loc-${d}`);
    const error = await adminDecideLocation(a.company_id, d, locNote);
    setBusy(null);
    if (error) {
      toast.error(mapDbError(error));
      return;
    }
    toast.success(d === 'verify' ? 'Location verified' : 'Location rejected');
    setLocNote('');
    onChanged();
  };

  const openDoc = async (path: string) => {
    if (!(await openPrivateDocument(path))) toast.error('Could not open the file (it may have been removed)');
  };

  const check = (key: 'cin' | 'gst' | 'udyam' | 'registry', label: string, value: string | null, portal: string, portalLabel = 'Check on portal') =>
    value ? (
      <div className="rounded-xl border border-border p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <a href={portal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#E04E00] dark:text-[#FF8A3D]">
            {portalLabel} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
        <p className="mt-0.5 select-all font-mono text-[13.5px] font-bold">{value}</p>
        {key === 'gst' && <p className="text-[11px] text-muted-foreground">PAN inside: {panFromGstin(value)} · state code {value.slice(0, 2)}</p>}
        <label className="mt-1.5 flex min-h-[32px] cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
          I checked it: active, and the name matches <b>{a.legal_name}</b>
        </label>
      </div>
    ) : null;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 p-3.5 text-left hover:bg-muted/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00]/12"><Building2 className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14.5px] font-black">{a.company_name}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_TONE[a.status])}>{STATUS_LABEL[a.status]}</span>
            {a.on_map && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3 w-3" aria-hidden="true" /> On map</span>}
            {loc?.status === 'pending' && <span className="rounded-full bg-orange-500/12 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">Location to check</span>}
            {recheckDue && <span className="rounded-full bg-orange-500/12 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">Recheck due</span>}
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">{entityLabel(a.entity_type)} · {a.owner_email ?? 'no email'} · sent {timeAgo(a.submitted_at)}</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-3.5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 text-[13px]">
              <p><span className="text-muted-foreground">Legal name:</span> <b>{a.legal_name}</b></p>
              <p><span className="text-muted-foreground">Registered office:</span> {a.registered_address}</p>
              <p><span className="text-muted-foreground">Factory:</span> {a.factory_address}</p>
              <p><span className="text-muted-foreground">Contact:</span> {a.contact_name} · {a.contact_phone} · {a.contact_email}</p>
              <p className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> {a.active_products} active product{a.active_products === 1 ? '' : 's'}{a.active_products === 0 && <span className="text-orange-600"> (cannot show on the map until one is added)</span>}</p>
              {a.decision_note && <p className="rounded-lg bg-muted/60 p-2 text-[12px]"><b>Last note:</b> {a.decision_note}</p>}
              {a.recheck_due_at && <p className="flex items-center gap-1 text-[12px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Recheck due {new Date(a.recheck_due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
            </div>
            <div className="space-y-2">
              {check('cin', a.entity_type === 'llp' ? 'LLPIN (MCA)' : 'CIN (MCA)', a.cin_llpin, PORTALS.mca)}
              {check('gst', 'GSTIN', a.gstin, PORTALS.gst)}
              {check('udyam', 'Udyam', a.udyam_number, PORTALS.udyam)}
              {check('registry', `Registration in ${a.registration_country ?? 'its country'}`, a.registration_number,
                `https://opencorporates.com/companies?q=${encodeURIComponent(a.legal_name)}`, 'Search OpenCorporates')}
              {a.entity_type === 'foreign_company' && (
                <p className="text-[11.5px] text-muted-foreground">
                  Registered outside India: approve only after finding it in the official company registry of {a.registration_country ?? 'its country'} (OpenCorporates links to most
                  registries) and checking the name, number and status match the certificate.
                </p>
              )}
              {incorporated && <p className="text-[11.5px] text-muted-foreground">A {entityLabel(a.entity_type).toLowerCase()} is approved only on its checked {a.entity_type === 'llp' ? 'LLPIN' : 'CIN'}. A GSTIN alone does not prove incorporation.</p>}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-black">Documents</p>
            {a.documents.length === 0 ? <p className="text-[12.5px] text-muted-foreground">None attached.</p> : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {a.documents.map((d) => (
                  <button key={d.path} type="button" onClick={() => openDoc(d.path)} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-semibold hover:border-[#FF5A00]">
                    <FileText className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> {d.name} <span className="text-[11px] font-normal text-muted-foreground">({d.kind.replace('_', ' ')})</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">Opens a private link that expires in 5 minutes.</p>
          </div>

          <div className="rounded-2xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[13px] font-black"><MapPin className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Factory location</p>
              {loc && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', loc.status === 'verified' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : loc.status === 'rejected' ? 'bg-red-500/12 text-red-600' : 'bg-orange-500/12 text-orange-600 dark:text-orange-400')}>{loc.status}</span>}
            </div>
            {!loc ? <p className="mt-1 text-[12.5px] text-muted-foreground">Not added yet.</p> : (
              <div className="mt-2 grid gap-3 md:grid-cols-[1fr_260px]">
                <div className="h-56 overflow-hidden rounded-xl border border-border">
                  <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#FF5A00]" /></div>}>
                    <LocationPickerMap readOnly value={{ lat: Number(loc.latitude), lng: Number(loc.longitude) }} theme={theme} className={cn('bsm-map h-full w-full', theme === 'light' && 'bsm-light')} />
                  </Suspense>
                </div>
                <div className="space-y-2 text-[12.5px]">
                  <p>{loc.address}{loc.city ? `, ${loc.city}` : ''}{loc.state ? `, ${loc.state}` : ''} {loc.pincode ?? ''}{loc.country ? `, ${loc.country}` : ''}</p>
                  <p className="text-muted-foreground">Factory address on the application: {a.factory_address}</p>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[#E04E00] dark:text-[#FF8A3D]">
                    Check the pin on Google Maps <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <textarea value={locNote} onChange={(e) => setLocNote(e.target.value)} rows={2} placeholder="Note (needed to reject)" className="w-full rounded-xl border border-border bg-background p-2 text-[12.5px] outline-none focus:border-[#FF5A00]" />
                  <div className="flex gap-2">
                    <button type="button" disabled={!!busy || loc.status === 'verified'} onClick={() => decideLocation('verify')} className="min-h-[38px] flex-1 rounded-xl bg-emerald-600 text-[12.5px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Verify pin</button>
                    <button type="button" disabled={!!busy} onClick={() => decideLocation('reject')} className="min-h-[38px] flex-1 rounded-xl border border-red-500/50 text-[12.5px] font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">Reject pin</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-black" htmlFor={`note-${a.company_id}`}>Decision note</label>
            <textarea id={`note-${a.company_id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="What you checked, or what the business must fix (needed to reject, ask for info or suspend; the business sees it)"
              className="w-full rounded-xl border border-border bg-background p-2.5 text-[13px] outline-none focus:border-[#FF5A00]" />
            <div className="flex flex-wrap gap-2">
              {a.status !== 'approved' && a.status !== 'suspended' && (
                <button type="button" disabled={!!busy} onClick={() => decide('approve')} className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />} Approve
                </button>
              )}
              {a.status !== 'approved' && a.status !== 'suspended' && (
                <button type="button" disabled={!!busy} onClick={() => decide('needs_info')} className="min-h-[42px] rounded-xl border border-orange-500/60 px-4 text-[13px] font-bold text-orange-600 hover:bg-orange-500/10 disabled:opacity-50 dark:text-orange-400">Ask for more info</button>
              )}
              {a.status !== 'rejected' && a.status !== 'suspended' && (
                <button type="button" disabled={!!busy} onClick={() => decide('reject')} className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-red-500/50 px-4 text-[13px] font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">
                  <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                </button>
              )}
              {(a.status === 'approved' || a.status === 'suspended') && (
                <button type="button" disabled={!!busy} onClick={() => decide('recheck')} className="min-h-[42px] rounded-xl border border-border px-4 text-[13px] font-bold hover:border-[#FF5A00] disabled:opacity-50">Recheck</button>
              )}
              {a.status === 'approved' && (
                <button type="button" disabled={!!busy} onClick={() => decide('suspend')} className="min-h-[42px] rounded-xl bg-red-600 px-4 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-50">Suspend</button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-black"><History className="h-4 w-4" aria-hidden="true" /> History</p>
            {history === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <HistoryList entries={history} compact />}
          </div>
        </div>
      )}
    </li>
  );
}
