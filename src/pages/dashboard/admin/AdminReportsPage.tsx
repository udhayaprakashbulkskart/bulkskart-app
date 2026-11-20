import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Flag, Loader2, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { adminCountReports, adminGetReports, adminUpdateReport, type AdminReport, type ReportStatus } from '@/lib/api';

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const STATUS_STYLE: Record<ReportStatus, string> = {
  open: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  under_review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  dismissed: 'bg-muted text-muted-foreground border-border',
};

const FILTERS: (ReportStatus | 'all')[] = ['open', 'under_review', 'resolved', 'dismissed', 'all'];

/**
 * What a report is about. Reports are filed as "[Kind] Title (id)" on the first line, then the reporter's notes,
 * and products and suppliers are also linked by id.
 */
export function describeReport(report: Pick<AdminReport, 'description' | 'reported_product_id' | 'reported_company_id'>): {
  kind: string;
  title: string;
  link: string | null;
  notes: string;
} {
  const text = report.description ?? '';
  const [firstLine, ...rest] = text.split('\n');
  const match = /^\[([^\]]+)\]\s*(.*?)\s*\(([^()]*)\)\s*$/.exec(firstLine ?? '');
  const kind = match?.[1] ?? (report.reported_product_id ? 'Product' : report.reported_company_id ? 'Supplier' : 'Item');
  const title = match?.[2] || (match ? '' : firstLine) || 'Untitled';
  const targetId = match?.[3]?.trim() || '';
  const notes = (match ? rest.join('\n') : rest.join('\n')).trim();
  let link: string | null = null;
  if (report.reported_product_id) link = `/products/${report.reported_product_id}`;
  else if (report.reported_company_id) link = `/companies/${report.reported_company_id}`;
  else if (targetId && kind === 'Requirement') link = `/requirement/${encodeURIComponent(targetId)}`;
  else if (targetId && kind === 'Auction') link = `/auctions/${encodeURIComponent(targetId)}`;
  return { kind, title, link, notes: match ? notes : text.trim() };
}

function ReportCard({ report, onSaved }: { report: AdminReport; onSaved: (updated: AdminReport) => void }) {
  const ids = useId();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [notes, setNotes] = useState(report.admin_notes ?? '');
  const [saving, setSaving] = useState(false);
  const about = useMemo(() => describeReport(report), [report]);
  const changed = status !== report.status || notes.trim() !== (report.admin_notes ?? '').trim();

  const save = async () => {
    setSaving(true);
    const { error } = await adminUpdateReport(report.id, { status, admin_notes: notes });
    setSaving(false);
    if (error) {
      toast.error('The report could not be updated. Please try again.');
      return;
    }
    toast.success(`Report ${report.id.slice(0, 8).toUpperCase()} saved as ${STATUS_LABEL[status].toLowerCase()}.`);
    const closed = status === 'resolved' || status === 'dismissed';
    onSaved({ ...report, status, admin_notes: notes.trim() || null, resolved_at: closed ? new Date().toISOString() : null });
  };

  return (
    <article className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3" aria-labelledby={`${ids}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[report.status]}`}>{STATUS_LABEL[report.status]}</span>
            <span className="text-[11px] font-mono text-muted-foreground">#{report.id.slice(0, 8).toUpperCase()}</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(report.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h3 id={`${ids}-title`} className="text-sm sm:text-base font-bold text-foreground mt-1">{report.reason}</h3>
        </div>
        {report.resolved_at && (
          <span className="text-[11px] text-muted-foreground">
            Closed {new Date(report.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </header>

      <dl className="grid gap-2 sm:grid-cols-2 text-xs">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Reported {about.kind.toLowerCase()}</dt>
          <dd className="font-semibold text-foreground flex items-center gap-1.5 min-w-0">
            <span className="truncate">{about.title}</span>
            {about.link && (
              <Link to={about.link} target="_blank" rel="noreferrer" className="text-primary shrink-0 inline-flex items-center gap-0.5 hover:underline">
                Open <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Reported by</dt>
          <dd className="font-semibold text-foreground flex items-center gap-1.5 min-w-0">
            <span className="truncate">{report.reporter?.full_name || 'Unknown user'}</span>
            {report.reporter?.email && (
              <a href={`mailto:${report.reporter.email}`} className="text-primary shrink-0 inline-flex items-center gap-0.5 hover:underline font-normal">
                <Mail className="w-3 h-3" /> {report.reporter.email}
              </a>
            )}
          </dd>
        </div>
      </dl>

      <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-foreground whitespace-pre-wrap break-words">
        {about.notes || <span className="text-muted-foreground">No details were given.</span>}
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[200px_1fr] items-start">
          <label htmlFor={`${ids}-status`} className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Status</span>
            <select
              id={`${ids}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value as ReportStatus)}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/40"
            >
              {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS_LABEL[key]}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${ids}-notes`} className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">
              Admin notes <span className="font-normal text-muted-foreground">(optional, only admins see these)</span>
            </span>
            <textarea
              id={`${ids}-notes`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was checked, and what was done"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/40"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!changed || saving} className="min-w-[140px] bg-[#C94400] hover:bg-[#B33D00] text-white">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function AdminReportsPage() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [counts, setCounts] = useState<Record<ReportStatus, number | null>>({ open: null, under_review: null, resolved: null, dismissed: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, tally] = await Promise.all([adminGetReports({ status: filter }), adminCountReports()]);
    setReports(list.rows);
    setError(list.error);
    setCounts(tally);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const total = Object.values(counts).every((n) => n !== null) ? Object.values(counts).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) : null;

  const handleSaved = (updated: AdminReport) => {
    const before = reports.find((r) => r.id === updated.id);
    setReports((list) => (filter === 'all' || updated.status === filter ? list.map((r) => (r.id === updated.id ? updated : r)) : list.filter((r) => r.id !== updated.id)));
    if (before && before.status !== updated.status) {
      setCounts((c) => ({ ...c, [before.status]: (c[before.status] ?? 1) - 1, [updated.status]: (c[updated.status] ?? 0) + 1 }));
    }
  };

  if (profile && profile.role !== 'admin') {
    return (
      <DashboardLayout>
        <PageMeta title="Reports | BulkSkart Admin" description="Reports sent by BulkSkart users." robots="noindex, nofollow" />
        <div className="flex items-center justify-center h-64 text-muted-foreground">Access denied.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageMeta title="Reports | BulkSkart Admin" description="Reports sent by BulkSkart users." robots="noindex, nofollow" />
      <div className="max-w-5xl mx-auto space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Flag className="w-5 h-5 text-primary" /> Reports
            </h1>
            <p className="text-sm text-muted-foreground">Products, suppliers, requirements and auctions that users reported.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter reports by status">
          {FILTERS.map((key) => {
            const active = filter === key;
            const count = key === 'all' ? total : counts[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground/80 border-border hover:border-primary/40'
                }`}
              >
                {key === 'all' ? 'All' : STATUS_LABEL[key]}
                {count !== null && <span className={`ml-1 ${active ? 'opacity-90' : 'text-muted-foreground'}`}>({count.toLocaleString('en-IN')})</span>}
              </button>
            );
          })}
        </div>

        {loading && reports.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-48 rounded-2xl bg-muted/40 animate-pulse border border-border" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-14 bg-card border border-border rounded-2xl">
            <p className="text-sm font-semibold text-foreground">Reports could not be loaded.</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-14 bg-card border border-dashed border-border rounded-2xl">
            <p className="text-sm font-semibold text-foreground">
              {filter === 'all' ? 'No reports yet.' : `No ${STATUS_LABEL[filter].toLowerCase()} reports.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={`${report.id}-${report.status}`} report={report} onSaved={handleSaved} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
