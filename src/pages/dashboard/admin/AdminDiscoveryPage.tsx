/**
 * Admin: supplier & product discovery (migration 00074, worker in scripts/discovery).
 * Queue searches or company websites, review what the worker found with its evidence and source pages, record a GST
 * portal check, publish, withhold, reject, suspend, mark duplicates, handle removal requests, and tune the rules.
 * Nothing is verified without an active GST registration from an authorised source.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Ban, CheckCircle2, ChevronDown, Clock3, Copy, ExternalLink, FileSearch, Globe2, Loader2, Package, RefreshCw, Search,
  Settings2, ShieldAlert, ShieldCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import {
  type DiscoveredProduct, type DiscoveredSupplier, type DiscoveryJob, type DiscoveryLog, type DiscoveryOverview, type DiscoverySettings,
  type GstCheck, type ProductAction, type PublishStatus, type SupplierAction, type SupplierDetail, type VerificationStatus,
  adminCancelJob, adminJobs, adminLogs, adminOverview, adminProductAction, adminProducts, adminQueueJob, adminSupplierAction,
  adminSupplierDetail, adminSuppliers, adminUpdateSettings, CATEGORY_LABELS, categoryLabel, formatDate, formatDateTime, PUBLISH_LABEL,
  STATUS_LABEL,
} from '@/lib/discovery/api';
import { cn } from '@/lib/utils';

const GST_PORTAL = 'https://services.gst.gov.in/services/searchtp';

const SUPPLIER_TABS = [
  { key: 'new', label: 'New' }, { key: 'needs_review', label: 'Needs review' }, { key: 'verified', label: 'Verified' },
  { key: 'published', label: 'Published' }, { key: 'rejected', label: 'Rejected' }, { key: 'suspended', label: 'Suspended' },
  { key: 'duplicates', label: 'Duplicates' },
] as const;
const OTHER_TABS = [
  { key: 'products', label: 'Products' }, { key: 'failures', label: 'Failures' }, { key: 'jobs', label: 'Jobs' }, { key: 'settings', label: 'Settings' },
] as const;
type TabKey = (typeof SUPPLIER_TABS)[number]['key'] | (typeof OTHER_TABS)[number]['key'];

const STATUS_TONE: Record<VerificationStatus, string> = {
  discovered: 'border border-border text-muted-foreground',
  needs_review: 'border border-[#FF5A00]/50 text-[#E04E00] dark:text-[#FF8A3D]',
  verified: 'bg-[#FF5A00] text-white',
  rejected: 'bg-red-600/12 text-red-600 dark:text-red-400',
  suspended: 'bg-red-600/12 text-red-600 dark:text-red-400',
};
const PUBLISH_TONE: Record<PublishStatus, string> = {
  internal: 'border border-border text-muted-foreground',
  published: 'bg-foreground text-background',
  withheld: 'bg-muted text-muted-foreground',
};

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold', className)}>{children}</span>;
}

function SourceLink({ href, label }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 break-all text-[12px] font-semibold text-[#E04E00] hover:underline dark:text-[#FF8A3D]">
      <span className="truncate">{label ?? href}</span><ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

export default function AdminDiscoveryPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [tab, setTab] = useState<TabKey>('new');
  const [overview, setOverview] = useState<DiscoveryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!isAdmin) return;
    adminOverview().then(({ data, error: e }) => { setOverview(data); setError(e); });
  }, [isAdmin, tick]);

  const count = (k: string): number | null => {
    if (!overview) return null;
    const s = overview.suppliers;
    return ({ new: s.new, needs_review: s.needs_review, verified: s.verified, published: s.published, rejected: s.rejected, suspended: s.suspended,
      duplicates: s.duplicates, products: overview.products.total, failures: overview.failures_7d, jobs: overview.jobs.queued + overview.jobs.running } as Record<string, number>)[k] ?? null;
  };

  return (
    <DashboardLayout>
      <PageMeta title="Supplier Discovery | BulkSkart Admin" description="Review manufacturers and products found on company websites" robots="noindex, nofollow" />
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><FileSearch className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /> Supplier Discovery</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Manufacturers and products read from the companies' own websites. A supplier is verified only when an authorised GST check finds the
              registration active and its name and state match the website. Only verified records can be published.
            </p>
          </div>
          {isAdmin && (
            <button type="button" onClick={refresh} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-bold hover:border-[#FF5A00]">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
            </button>
          )}
        </div>

        {!isAdmin ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-[#FF5A00]" aria-hidden="true" />
            <p className="mt-3 font-bold">Only admins can open this page</p>
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {error}. If this is a new installation, run <code>supabase/migrations/00074_supplier_discovery.sql</code> first.
          </p>
        ) : (
          <>
            <OverviewTiles o={overview} />
            <QueueJobForm onQueued={refresh} />
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Discovery views">
              {[...SUPPLIER_TABS, ...OTHER_TABS].map((t) => {
                const n = count(t.key);
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                    className={cn('inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-bold',
                      tab === t.key ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-border hover:border-[#FF5A00]')}>
                    {t.label}{n !== null && <span className={cn('rounded-full px-1.5 text-[10.5px]', tab === t.key ? 'bg-white/20' : 'bg-muted')}>{n}</span>}
                  </button>
                );
              })}
            </div>
            {tab === 'products' ? <ProductsView key={`p${tick}`} onChanged={refresh} />
              : tab === 'failures' ? <FailuresView key={`f${tick}`} />
              : tab === 'jobs' ? <JobsView key={`j${tick}`} onChanged={refresh} />
              : tab === 'settings' ? <SettingsView settings={overview?.settings ?? null} onSaved={refresh} />
              : <SuppliersView key={`${tab}${tick}`} tab={tab} onChanged={refresh} />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function OverviewTiles({ o }: { o: DiscoveryOverview | null }) {
  const tiles: [string, number | string | undefined][] = [
    ['New this week', o?.suppliers.new], ['Needs review', o?.suppliers.needs_review], ['Verified', o?.suppliers.verified],
    ['Published', o?.suppliers.published], ['Rejected', o?.suppliers.rejected], ['Duplicates', o?.suppliers.duplicates],
    ['Products found', o?.products.total], ['Products published', o?.products.published], ['Failures (7 days)', o?.failures_7d],
    ['Last run', o ? formatDateTime(o.jobs.last_finished_at) : undefined],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-border bg-card p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-lg font-black">{value ?? '…'}</div>
        </div>
      ))}
    </div>
  );
}

function QueueJobForm({ onQueued }: { onQueued: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'search' | 'seed_urls'>('search');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [urls, setUrls] = useState('');
  const [max, setMax] = useState(20);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await adminQueueJob({ kind, query, location, category, maxResults: max, urls: urls.split(/\s+/).map((u) => u.trim()).filter(Boolean) });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success('Queued. The worker picks it up on its next run (every 2 hours, or run the workflow now).');
    setQuery(''); setUrls('');
    onQueued();
  };
  const input = 'min-h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-[#FF5A00]';
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <span className="flex items-center gap-2 font-black"><Search className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Find suppliers</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-border p-4">
          <div className="flex gap-2" role="radiogroup" aria-label="How to find suppliers">
            {([['search', 'Search the web'], ['seed_urls', 'Company websites']] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={cn('min-h-[36px] rounded-full border px-3.5 text-[12.5px] font-bold', kind === k ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-border')}>{l}</button>
            ))}
          </div>
          {kind === 'search' ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="sm:col-span-2 text-[12px] font-bold">Product or industry
                <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. PP woven sacks" maxLength={200} required />
              </label>
              <label className="text-[12px] font-bold">Place (optional)
                <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Gujarat" maxLength={100} />
              </label>
              <label className="text-[12px] font-bold">Websites to read
                <input className={input} type="number" min={1} max={100} value={max} onChange={(e) => setMax(Number(e.target.value) || 20)} />
              </label>
              <p className="sm:col-span-4 text-[12px] text-muted-foreground">
                Uses the configured search API (Brave or Google Programmable Search). Marketplaces, directories and social sites are skipped:
                each company is read only from its own website, obeying its robots.txt.
              </p>
            </div>
          ) : (
            <label className="block text-[12px] font-bold">Company websites, one per line (up to 50)
              <textarea className={cn(input, 'min-h-[110px] py-2')} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={'https://www.company-website.in'} required />
            </label>
          )}
          <label className="block max-w-xs text-[12px] font-bold">Category (optional)
            <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Any</option>
              {Object.entries(CATEGORY_LABELS).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#FF5A00] px-4 text-sm font-black text-white hover:bg-[#E04E00] disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Queue job
          </button>
        </form>
      )}
    </div>
  );
}

function SuppliersView({ tab, onChanged }: { tab: string; onChanged: () => void }) {
  const [rows, setRows] = useState<DiscoveredSupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminSuppliers(tab, query).then(({ data, error: e }) => {
      if (!alive) return;
      setRows(data?.rows ?? []); setTotal(data?.total ?? 0); setError(e); setLoading(false);
    });
    return () => { alive = false; };
  }, [tab, query, tick]);
  const changed = () => { setTick((t) => t + 1); onChanged(); };
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); setQuery(search); }} className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, website, GSTIN or city" aria-label="Search suppliers"
          className="min-h-[40px] flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-[#FF5A00]" />
        <button type="submit" className="min-h-[40px] rounded-xl border border-border px-4 text-sm font-bold hover:border-[#FF5A00]">Search</button>
      </form>
      {error ? <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>
        : loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>
        : rows.length === 0 ? <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
        : (
          <>
            <p className="text-[12px] text-muted-foreground">{total} supplier{total === 1 ? '' : 's'}{total > rows.length ? `, showing the newest ${rows.length}` : ''}</p>
            <ul className="space-y-2">
              {rows.map((s) => <SupplierCard key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} onChanged={changed} />)}
            </ul>
          </>
        )}
    </div>
  );
}

function gstLine(c: GstCheck | null): string {
  if (!c) return 'GST not checked yet';
  const how = c.method === 'gst_portal_manual' ? 'admin, GST portal' : c.provider ?? 'GST provider';
  if (c.result === 'error') return `GST check failed (${how}), ${formatDate(c.checked_at)}`;
  if (c.result === 'not_configured') return 'No GST provider configured';
  if (c.result === 'not_found') return `GSTIN not found (${how}), ${formatDate(c.checked_at)}`;
  return `GST ${c.gst_status ?? '?'} · ${c.legal_name ?? ''} · name match ${c.name_score !== null ? `${Math.round(Number(c.name_score) * 100)}%` : '—'} · state ${c.state_match === null ? 'unknown' : c.state_match ? 'matches' : 'differs'} (${how}, ${formatDate(c.checked_at)})`;
}

function SupplierCard({ s, open, onToggle, onChanged }: { s: DiscoveredSupplier; open: boolean; onToggle: () => void; onChanged: () => void }) {
  return (
    <li className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-col gap-1.5 p-4 text-left sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-black">{s.name_on_site}</span>
            <Chip className={STATUS_TONE[s.verification_status]}>{STATUS_LABEL[s.verification_status]}</Chip>
            <Chip className={PUBLISH_TONE[s.publish_status]}>{PUBLISH_LABEL[s.publish_status]}</Chip>
            {s.duplicate_of && <Chip className="border border-border text-muted-foreground"><Copy className="mr-1 h-3 w-3" aria-hidden="true" />Duplicate of {s.duplicate_of_name ?? 'another record'}</Chip>}
          </div>
          <div className="text-[12.5px] text-muted-foreground">
            {s.website_host} · {[s.city, s.state].filter(Boolean).join(', ') || 'no address found'} · GSTIN {s.gstin ?? 'not found on the website'} · {s.product_count} product{s.product_count === 1 ? '' : 's'} ({s.published_products} published)
          </div>
          <div className="text-[12px] text-muted-foreground">{gstLine(s.latest_gst_check)}</div>
          {s.status_reason && <div className="text-[12px] font-semibold text-[#E04E00] dark:text-[#FF8A3D]">{s.status_reason}</div>}
        </div>
        <div className="shrink-0 text-[11.5px] text-muted-foreground sm:text-right">
          <div>Found {formatDate(s.created_at)}</div>
          <div>Last verified {formatDate(s.last_verified_at)}</div>
          <div>Website read {formatDate(s.last_fetched_at)}</div>
        </div>
      </button>
      {open && <SupplierPanel id={s.id} onChanged={onChanged} />}
    </li>
  );
}

function SupplierPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [d, setD] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    adminSupplierDetail(id).then(({ data, error: e }) => { setD(data); setError(e); });
  }, [id, tick]);
  if (error) return <p className="border-t border-border p-4 text-sm text-muted-foreground">{error}</p>;
  if (!d) return <div className="flex justify-center border-t border-border p-6"><Loader2 className="h-5 w-5 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>;
  const s = d.supplier;
  const found = (s.evidence?.found ?? {}) as Record<string, { value?: string; url?: string; method?: string; context?: string } | null>;
  const changed = () => { setTick((t) => t + 1); onChanged(); };
  return (
    <div className="space-y-4 border-t border-border p-4 text-sm">
      <section className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-muted-foreground">Read from the website</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted-foreground">Website</dt><dd><SourceLink href={s.website_url} label={s.website_host} /></dd>
            <dt className="text-muted-foreground">Found on</dt><dd><SourceLink href={s.source_url} /></dd>
            <dt className="text-muted-foreground">How found</dt><dd>{s.found_via ?? '—'}</dd>
            <dt className="text-muted-foreground">Name</dt><dd>{s.name_on_site}{found.name?.method && <span className="text-muted-foreground"> ({found.name.method})</span>}</dd>
            <dt className="text-muted-foreground">GSTIN</dt><dd>{s.gstin ?? '—'}{found.gstin?.url && <> · <SourceLink href={found.gstin.url} label="where" /></>}</dd>
            <dt className="text-muted-foreground">Address</dt><dd>{s.address ?? '—'}{found.address?.url && <> · <SourceLink href={found.address.url} label="where" /></>}</dd>
            <dt className="text-muted-foreground">Phones</dt><dd>{s.public_phones.join(', ') || '—'} <span className="text-muted-foreground">(admin only)</span></dd>
            <dt className="text-muted-foreground">Emails</dt><dd>{s.public_emails.join(', ') || '—'} <span className="text-muted-foreground">(admin only)</span></dd>
            <dt className="text-muted-foreground">Pages read</dt><dd>{s.evidence?.pages_read ?? s.evidence?.pages?.length ?? 0}, {formatDateTime(s.evidence?.read_at ?? s.last_fetched_at)}</dd>
          </dl>
          {Array.isArray(found.other_gstins) && (found.other_gstins as unknown as { value: string; url: string }[]).length > 0 && (
            <p className="text-[12px] text-muted-foreground">Other GSTINs on the site: {(found.other_gstins as unknown as { value: string }[]).map((g) => g.value).join(', ')}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-muted-foreground">GST checks</h3>
          {d.gst_checks.length === 0 ? <p className="text-[13px] text-muted-foreground">None yet. Without a GST provider configured, check the GSTIN on the portal and record it below.</p>
            : (
              <ul className="space-y-1.5">
                {d.gst_checks.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border p-2 text-[12.5px]">
                    <div className="font-bold">{c.result === 'found' ? `${c.gst_status} · ${c.legal_name ?? ''}${c.trade_name ? ` (${c.trade_name})` : ''}` : c.result.replace('_', ' ')}</div>
                    <div className="text-muted-foreground">
                      {c.method === 'gst_portal_manual' ? 'Admin, GST portal' : c.provider ?? 'API'} · {formatDateTime(c.checked_at)}
                      {c.result === 'found' && <> · name {c.name_score !== null ? `${Math.round(Number(c.name_score) * 100)}%` : '—'} · state {c.state_match === null ? 'unknown' : c.state_match ? 'matches' : 'differs'}{c.registered_state ? ` (${c.registered_state})` : ''}</>}
                      {typeof c.evidence?.note === 'string' && <> · “{c.evidence.note}”</>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </section>

      <SupplierActions s={s} onChanged={changed} />

      <section className="space-y-1.5">
        <h3 className="text-[12px] font-black uppercase tracking-wide text-muted-foreground">Products ({d.products.length})</h3>
        {d.products.length === 0 ? <p className="text-[13px] text-muted-foreground">No product pages were found on the website.</p>
          : <ul className="space-y-1.5">{d.products.map((p) => <ProductRow key={p.id} p={p} onChanged={changed} compact />)}</ul>}
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[12px] font-black uppercase tracking-wide text-muted-foreground">Log</h3>
        <ul className="max-h-64 space-y-1 overflow-y-auto text-[12px]">
          {d.logs.map((l) => (
            <li key={l.id} className="flex gap-2"><span className="shrink-0 text-muted-foreground">{formatDateTime(l.created_at)}</span>
              <span><b>{l.action.replace(/_/g, ' ')}</b>{l.to_status ? ` → ${l.to_status}` : ''}{logDetail(l)}{l.actor ? ' · by an admin' : ''}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function logDetail(l: DiscoveryLog): string {
  const d = l.detail ?? {};
  const bits = [d.reason, d.note, d.error, d.url, d.http_status ? `HTTP ${d.http_status}` : null].filter((x) => typeof x === 'string' || typeof x === 'number');
  return bits.length ? ` · ${bits.join(' · ')}` : '';
}

function SupplierActions({ s, onChanged }: { s: DiscoveredSupplier; onChanged: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [gst, setGst] = useState({ result: 'found', gst_status: 'Active', legal_name: '', trade_name: '' });
  const [dupOf, setDupOf] = useState('');
  const run = async (action: SupplierAction, payload: Record<string, unknown> = {}) => {
    setBusy(action);
    const { data, error } = await adminSupplierAction(s.id, action, note, payload);
    setBusy(null);
    if (error) { toast.error(error); return; }
    toast.success(data ? `${STATUS_LABEL[data.verification_status]} · ${PUBLISH_LABEL[data.publish_status]}${data.reason ? ` — ${data.reason}` : ''}` : 'Done');
    setNote('');
    onChanged();
  };
  const btn = 'inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold disabled:opacity-50';
  const input = 'min-h-[38px] rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-[#FF5A00]';
  return (
    <section className="space-y-3 rounded-2xl border border-border p-3">
      <h3 className="text-[12px] font-black uppercase tracking-wide text-muted-foreground">Decide</h3>
      <label className="block text-[12px] font-bold">Note (needed to reject, suspend, withhold, record a portal check or a removal request)
        <input className={cn(input, 'mt-1 w-full')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What you checked, or why" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={cn(btn, 'border-[#FF5A00] bg-[#FF5A00] text-white')} disabled={busy !== null || s.verification_status !== 'verified' || s.publish_status === 'published'} onClick={() => run('publish')}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Publish</button>
        <button type="button" className={cn(btn, 'border-border')} disabled={busy !== null || s.publish_status === 'withheld'} onClick={() => run('withhold')}>Withhold</button>
        <button type="button" className={cn(btn, 'border-border')} disabled={busy !== null} onClick={() => run('recheck_now')}><Clock3 className="h-4 w-4" aria-hidden="true" />Recheck on next run</button>
        <button type="button" className={cn(btn, 'border-border')} disabled={busy !== null || (s.status_set_by !== 'admin' && s.verification_status !== 'suspended')} onClick={() => run('restore')}><RefreshCw className="h-4 w-4" aria-hidden="true" />Restore</button>
        <button type="button" className={cn(btn, 'border-red-600/50 text-red-600 dark:text-red-400')} disabled={busy !== null} onClick={() => run('suspend')}><Ban className="h-4 w-4" aria-hidden="true" />Suspend</button>
        <button type="button" className={cn(btn, 'border-red-600/50 text-red-600 dark:text-red-400')} disabled={busy !== null} onClick={() => run('reject')}><XCircle className="h-4 w-4" aria-hidden="true" />Reject</button>
        <button type="button" className={cn(btn, 'border-red-600/50 text-red-600 dark:text-red-400')} disabled={busy !== null}
          onClick={() => { if (window.confirm('Remove this company for good? It is unpublished now and never collected again.')) run('suppress'); }}>Removal request</button>
      </div>

      {s.gstin && (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-[12.5px]">
            <b>Record a GST portal check.</b> Open the <SourceLink href={GST_PORTAL} label="official GST taxpayer search" />, look up <b>{s.gstin}</b>, and copy what it shows.
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <select className={input} value={gst.result} onChange={(e) => setGst({ ...gst, result: e.target.value })} aria-label="Portal result">
              <option value="found">GSTIN found</option><option value="not_found">GSTIN not found</option>
            </select>
            <select className={input} value={gst.gst_status} onChange={(e) => setGst({ ...gst, gst_status: e.target.value })} aria-label="GST status" disabled={gst.result !== 'found'}>
              {['Active', 'Cancelled', 'Suspended', 'Inactive'].map((x) => <option key={x}>{x}</option>)}
            </select>
            <input className={input} value={gst.legal_name} onChange={(e) => setGst({ ...gst, legal_name: e.target.value })} placeholder="Legal name of business" aria-label="Legal name" disabled={gst.result !== 'found'} />
            <input className={input} value={gst.trade_name} onChange={(e) => setGst({ ...gst, trade_name: e.target.value })} placeholder="Trade name (if shown)" aria-label="Trade name" disabled={gst.result !== 'found'} />
          </div>
          <button type="button" className={cn(btn, 'border-[#FF5A00] text-[#E04E00] dark:text-[#FF8A3D]')} disabled={busy !== null} onClick={() => run('gst_portal_check', gst)}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />Save portal check
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {s.duplicate_of ? (
          <button type="button" className={cn(btn, 'border-border')} disabled={busy !== null} onClick={() => run('not_duplicate')}>Not a duplicate</button>
        ) : (
          <>
            <input className={cn(input, 'w-72')} value={dupOf} onChange={(e) => setDupOf(e.target.value.trim())} placeholder="ID of the record it duplicates" aria-label="Duplicate of" />
            <button type="button" className={cn(btn, 'border-border')} disabled={busy !== null || !dupOf} onClick={() => run('mark_duplicate', { duplicate_of: dupOf })}><Copy className="h-4 w-4" aria-hidden="true" />Mark duplicate</button>
          </>
        )}
        <span className="text-[11.5px] text-muted-foreground">This record: <code className="select-all">{s.id}</code></span>
      </div>
    </section>
  );
}

function ProductRow({ p, onChanged, compact = false }: { p: DiscoveredProduct; onChanged: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async (action: ProductAction, payload: Record<string, unknown> = {}) => {
    const note = action === 'reject' || action === 'withhold' ? window.prompt('Note (kept in the log):') ?? '' : '';
    if ((action === 'reject' || action === 'withhold') && !note.trim()) return;
    setBusy(true);
    const { error } = await adminProductAction(p.id, action, note, payload);
    setBusy(false);
    if (error) toast.error(error); else onChanged();
  };
  const specs = Object.entries(p.specifications ?? {});
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Package className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" />
            <span className="font-bold">{p.name}</span>
            <Chip className={STATUS_TONE[p.verification_status]}>{STATUS_LABEL[p.verification_status]}</Chip>
            <Chip className={PUBLISH_TONE[p.publish_status]}>{PUBLISH_LABEL[p.publish_status]}</Chip>
            {(p.source_count ?? p.sources?.length ?? 1) > 1 && <Chip className="border border-border text-muted-foreground">{p.source_count ?? p.sources?.length} sources</Chip>}
          </div>
          {!compact && p.supplier_name && <div className="text-[12px] text-muted-foreground">{p.supplier_name} · {p.website_host}</div>}
          <div className="text-[12px] text-muted-foreground">
            {categoryLabel(p.category_slug) ?? 'No category'} · {specs.length} specification{specs.length === 1 ? '' : 's'}
            {p.price_text ? ` · price on page: ${p.price_text}` : ''}{p.moq_text ? ` · MOQ on page: ${p.moq_text}` : ''}
            {p.description_generated ? ' · description rewritten from the page facts' : ''}
          </div>
          {p.status_reason && <div className="text-[12px] font-semibold text-[#E04E00] dark:text-[#FF8A3D]">{p.status_reason}</div>}
          <SourceLink href={p.source_url} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <select disabled={busy} value={p.category_slug ?? ''} aria-label="Category" onChange={(e) => run('set_category', { category_slug: e.target.value })}
            className="min-h-[34px] rounded-lg border border-border bg-background px-2 text-[12px]">
            <option value="">No category</option>
            {Object.entries(CATEGORY_LABELS).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
          {p.publish_status !== 'published' && p.verification_status === 'verified' && <button type="button" disabled={busy} onClick={() => run('publish')} className="min-h-[34px] rounded-lg bg-[#FF5A00] px-2.5 text-[12px] font-bold text-white">Publish</button>}
          {p.publish_status !== 'withheld' && <button type="button" disabled={busy} onClick={() => run('withhold')} className="min-h-[34px] rounded-lg border border-border px-2.5 text-[12px] font-bold">Withhold</button>}
          {p.verification_status !== 'rejected' && <button type="button" disabled={busy} onClick={() => run('reject')} className="min-h-[34px] rounded-lg border border-red-600/50 px-2.5 text-[12px] font-bold text-red-600 dark:text-red-400">Reject</button>}
          {(p.verification_status === 'rejected' || p.verification_status === 'suspended' || p.publish_status === 'withheld') && <button type="button" disabled={busy} onClick={() => run('restore')} className="min-h-[34px] rounded-lg border border-border px-2.5 text-[12px] font-bold">Restore</button>}
        </div>
      </div>
    </li>
  );
}

function ProductsView({ onChanged }: { onChanged: () => void }) {
  const [sub, setSub] = useState('all');
  const [rows, setRows] = useState<DiscoveredProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true);
    adminProducts(sub).then(({ data, error: e }) => { setRows(data?.rows ?? []); setTotal(data?.total ?? 0); setError(e); setLoading(false); });
  }, [sub, tick]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {[['all', 'All'], ['published', 'Published'], ['needs_review', 'Needs review'], ['rejected', 'Rejected'], ['suspended', 'Suspended'], ['duplicates', 'Duplicates']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSub(k)} aria-pressed={sub === k}
            className={cn('min-h-[32px] rounded-full border px-3 text-[12px] font-bold', sub === k ? 'border-foreground bg-foreground text-background' : 'border-border')}>{l}</button>
        ))}
      </div>
      {error ? <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>
        : loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>
        : rows.length === 0 ? <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No products here.</p>
        : (
          <>
            <p className="text-[12px] text-muted-foreground">{total} product{total === 1 ? '' : 's'}</p>
            <ul className="space-y-2">{rows.map((p) => <ProductRow key={p.id} p={p} onChanged={() => { setTick((t) => t + 1); onChanged(); }} />)}</ul>
          </>
        )}
    </div>
  );
}

function FailuresView() {
  const [rows, setRows] = useState<DiscoveryLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { adminLogs('failures').then(({ data, error: e }) => { setRows(data ?? []); setError(e); }); }, []);
  if (error) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>;
  if (!rows) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>;
  if (rows.length === 0) return <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No failures.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((l) => (
        <li key={l.id} className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-card p-3 text-[12.5px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <b>{l.action.replace(/_/g, ' ')}</b>{l.name ? ` · ${l.name}` : ''}<span className="text-muted-foreground">{logDetail(l)}</span>
          </div>
          <span className="text-muted-foreground">{formatDateTime(l.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function JobsView({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<DiscoveryJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { adminJobs().then(({ data, error: e }) => { setRows(data ?? []); setError(e); }); }, [tick]);
  if (error) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>;
  if (!rows) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>;
  if (rows.length === 0) return <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No jobs yet. Use “Find suppliers” above.</p>;
  const cancel = async (id: string) => {
    const { error: e } = await adminCancelJob(id);
    if (e) toast.error(e); else { setTick((t) => t + 1); onChanged(); }
  };
  return (
    <ul className="space-y-2">
      {rows.map((j) => {
        const st = j.stats ?? {};
        return (
          <li key={j.id} className="rounded-2xl border border-border bg-card p-3 text-[12.5px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {j.kind === 'search' ? <Search className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> : <Globe2 className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" />}
                <b>{j.kind === 'search' ? `“${j.query}”${j.location ? ` in ${j.location}` : ''}` : `${j.seed_urls.length} website${j.seed_urls.length === 1 ? '' : 's'}`}</b>
                <Chip className={j.status === 'failed' ? 'bg-red-600/12 text-red-600 dark:text-red-400' : j.status === 'done' ? 'bg-foreground text-background' : 'border border-[#FF5A00]/50 text-[#E04E00] dark:text-[#FF8A3D]'}>{j.status}</Chip>
                {j.source_type && <span className="text-muted-foreground">via {j.source_type}</span>}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>queued {formatDateTime(j.created_at)}{j.finished_at ? ` · finished ${formatDateTime(j.finished_at)}` : ''}</span>
                {(j.status === 'queued' || j.status === 'running') && <button type="button" onClick={() => cancel(j.id)} className="rounded-lg border border-border px-2 py-1 font-bold text-foreground">Cancel</button>}
              </div>
            </div>
            {Object.keys(st).length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {[['sites_considered', 'websites'], ['pages_read', 'pages read'], ['suppliers_new', 'new suppliers'], ['suppliers_updated', 'updated'], ['duplicates', 'duplicates'],
                  ['products_new', 'new products'], ['product_duplicates', 'product duplicates'], ['not_company', 'not company sites'], ['gst_checked', 'GST checks'], ['errors', 'errors']]
                  .filter(([k]) => st[k] !== undefined).map(([k, l]) => `${st[k]} ${l}`).join(' · ')}
                {st.stopped_early ? ' · stopped at the time limit' : ''}
              </p>
            )}
            {j.error && <p className="mt-1 font-semibold text-red-600 dark:text-red-400">{j.error}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function SettingsView({ settings, onSaved }: { settings: DiscoverySettings | null; onSaved: () => void }) {
  const [s, setS] = useState<DiscoverySettings | null>(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(settings), [settings]);
  if (!s) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>;
  const save = async () => {
    setBusy(true);
    const { error } = await adminUpdateSettings(s);
    setBusy(false);
    if (error) toast.error(error); else { toast.success('Saved. The rules were applied to every supplier again.'); onSaved(); }
  };
  const toggle = (k: keyof DiscoverySettings, label: string, help: string) => (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#FF5A00]" checked={Boolean(s[k])} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />
      <span><b className="text-[13px]">{label}</b><span className="block text-[12px] text-muted-foreground">{help}</span></span>
    </label>
  );
  const num = (k: keyof DiscoverySettings, label: string, min: number, max: number) => (
    <label className="text-[12.5px] font-bold">{label}
      <input type="number" min={min} max={max} value={Number(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })}
        className="mt-1 min-h-[38px] w-full rounded-xl border border-border bg-background px-3 text-sm" />
    </label>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-black"><Settings2 className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Verification and publishing rules</h2>
      <p className="text-[12.5px] text-muted-foreground">An active GST registration from an authorised source is always required for “verified”. It cannot be switched off.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {toggle('auto_publish', 'Publish automatically', 'Verified suppliers with enough verified products go into the public directory without waiting for an admin.')}
        {toggle('require_name_match', 'Name must match the GST register', 'The name on the website must match the GST legal or trade name.')}
        {toggle('require_state_match', 'State must match the GSTIN', 'The address on the website must be in the GSTIN’s state.')}
        {toggle('publish_product_images', 'Show product photos', 'Photos belong to each company. Turn on only where you have permission to show them.')}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {num('min_published_products', 'Products needed to publish', 0, 50)}
        {num('recheck_days', 'Recheck websites every (days)', 1, 365)}
        {num('gst_recheck_days', 'Recheck GST every (days)', 1, 365)}
        {num('max_pages_per_site', 'Pages read per website', 3, 200)}
      </div>
      <button type="button" onClick={save} disabled={busy} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#FF5A00] px-4 text-sm font-black text-white disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save rules
      </button>
      <p className="text-[11.5px] text-muted-foreground">Last changed {formatDateTime(s.updated_at)}</p>
    </div>
  );
}
