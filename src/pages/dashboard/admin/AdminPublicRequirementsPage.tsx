/**
 * Admin: review Public Requirements (requirements collected from public pages elsewhere).
 * Approve, reject or remove them, singly or in bulk, and audit where each came from and when it was verified.
 * The source website and original URL are shown here only (public_listing_sources is admin-only).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingColumnError, postedOnLabel } from '@/lib/publicListings';

type Tab = 'pending' | 'approved' | 'rejected' | 'expired' | 'all';
const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved (live)' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'expired', label: 'Expired' },
  { id: 'all', label: 'All' },
];
const PAGE = 50;

interface Row {
  id: string;
  title: string;
  quantity: number | null;
  quantity_unit: string | null;
  destination_city: string | null;
  listing_category: string | null;
  review_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  expires_at: string;
  public_listing_sources: {
    source_name: string;
    source_url: string;
    source_listing_id: string | null;
    verified_at: string | null;
    verified_http_status: number | null;
    reviewed_at: string | null;
  } | null;
}

export default function AdminPublicRequirementsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nowIso = new Date().toISOString();
    let q = supabase
      .from('requirements')
      .select(
        'id,title,quantity,quantity_unit,destination_city,listing_category,review_status,created_at,expires_at,public_listing_sources(source_name,source_url,source_listing_id,verified_at,verified_http_status,reviewed_at)',
        { count: 'exact' },
      )
      .eq('source_type', 'public_listing');
    if (tab === 'expired') q = q.lte('expires_at', nowIso);
    else if (tab !== 'all') q = q.eq('review_status', tab).gt('expires_at', nowIso);
    const { data, error: err, count: n } = await q.order('created_at', { ascending: false }).limit(PAGE);
    if (err) {
      setError(isMissingColumnError(err) ? 'The Public Requirements database update (migration 00068) has not been applied yet.' : err.message);
      setRows([]);
      setCount(0);
    } else {
      setRows((data ?? []) as unknown as Row[]);
      setCount(n ?? 0);
    }
    setSelected(new Set());
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (ids: string[], status: 'approved' | 'rejected') => {
    if (ids.length === 0) return;
    setBusy(true);
    const { error: err } = await supabase.from('requirements').update({ review_status: status }).in('id', ids).eq('source_type', 'public_listing');
    if (!err) {
      await supabase.from('public_listing_sources').update({ reviewed_by: profile?.id ?? null, reviewed_at: new Date().toISOString() }).in('requirement_id', ids);
    }
    setBusy(false);
    if (err) {
      toast.error(`Could not update: ${err.message}`);
      return;
    }
    toast.success(`${ids.length} ${ids.length === 1 ? 'requirement' : 'requirements'} ${status === 'approved' ? 'approved' : 'rejected'}`);
    load();
  };

  const remove = async (ids: string[]) => {
    if (ids.length === 0 || !window.confirm(`Remove ${ids.length} public ${ids.length === 1 ? 'requirement' : 'requirements'} permanently?`)) return;
    setBusy(true);
    const { error: err } = await supabase.from('requirements').delete().in('id', ids).eq('source_type', 'public_listing');
    setBusy(false);
    if (err) {
      toast.error(`Could not remove: ${err.message}`);
      return;
    }
    toast.success(`${ids.length} removed`);
    load();
  };

  const allOnPage = useMemo(() => rows.length > 0 && rows.every((r) => selected.has(r.id)), [rows, selected]);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ids = [...selected];

  return (
    <DashboardLayout>
      <PageMeta title="Public Requirements | Admin | BulkSkart" description="Review public requirements" robots="noindex, nofollow" />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Public Requirements</h1>
            <p className="text-sm text-muted-foreground">
              Requirements collected from public pages elsewhere. Only approved ones are shown to customers, without the source, until
              30 days after posting. Quotations are not possible on them.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-9 rounded-full border px-3.5 text-sm font-semibold ${tab === t.id ? 'border-transparent bg-[#FF5A00] text-white' : 'border-border hover:border-[#FF5A00]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5 text-sm">
          <label className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={allOnPage}
              onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
              aria-label="Select all on this page"
            />
            {selected.size > 0 ? `${selected.size} selected` : `${count} in this list${count > rows.length ? ` (showing ${rows.length})` : ''}`}
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || ids.length === 0} onClick={() => review(ids, 'approved')}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy || ids.length === 0} onClick={() => review(ids, 'rejected')}>
              <XCircle className="mr-1.5 h-4 w-4" /> Reject
            </Button>
            <Button size="sm" variant="outline" disabled={busy || ids.length === 0} onClick={() => remove(ids)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Remove
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : loading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" /></div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Nothing in this list.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const src = r.public_listing_sources;
              const expired = new Date(r.expires_at).getTime() <= Date.now();
              return (
                <li key={r.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.review_status === 'approved' ? 'bg-[#FF5A00]/15 text-[#E04E00]' : 'bg-muted text-muted-foreground'}`}>
                        {expired ? 'expired' : r.review_status}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {r.quantity != null ? `${r.quantity.toLocaleString('en-IN')} ${r.quantity_unit ?? ''}` : 'Quantity not stated'}
                      {r.destination_city ? ` · ${r.destination_city}` : ''}
                      {r.listing_category ? ` · ${r.listing_category}` : ''}
                      {` · posted ${postedOnLabel(r.created_at) ?? '—'} · hidden after ${postedOnLabel(r.expires_at) ?? '—'}`}
                    </p>
                    {src && (
                      <p className="text-xs text-muted-foreground">
                        Source (admin only): {src.source_name}
                        {src.source_listing_id ? ` #${src.source_listing_id}` : ''} · verified {postedOnLabel(src.verified_at) ?? '—'}
                        {src.verified_http_status ? ` (HTTP ${src.verified_http_status})` : ''} ·{' '}
                        <a href={src.source_url} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#E04E00] hover:underline">
                          original page <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {r.review_status !== 'approved' && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => review([r.id], 'approved')}>Approve</Button>
                    )}
                    {r.review_status !== 'rejected' && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => review([r.id], 'rejected')}>Reject</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
