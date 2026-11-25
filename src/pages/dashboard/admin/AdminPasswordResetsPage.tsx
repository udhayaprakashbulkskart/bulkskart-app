/**
 * Password reset requests (no e-mail link, no OTP): a visitor set a new password on the login page; the admin calls
 * the mobile number registered on the account, confirms it is the owner, then approves (the new password starts working
 * and the account is signed out everywhere) or rejects. Migration 00079.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, KeyRound, Loader2, Phone, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { type AdminResetRequest, decideResetRequest, loadResetRequests } from '@/lib/passwordResetRequest';

const STATUS_LABEL: Record<AdminResetRequest['status'], string> = {
  pending: 'Waiting for a call',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired (48 h)',
  superseded: 'Replaced by a newer request',
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

/** a number as it is dialled from India */
const dial = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

function RequestCard({ row, onDone }: { row: AdminResetRequest; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [called, setCalled] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const pending = row.status === 'pending';

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    try {
      const result = await decideResetRequest(row.id, approve, note);
      if (result === 'approved') toast.success(`New password is active for ${row.email}. The account was signed out everywhere.`);
      else if (result === 'rejected') toast.message(`Request for ${row.email} rejected. The password was not changed.`);
      else if (result === 'account_gone') toast.error('That account no longer exists.');
      else toast.message('This request was already decided or has expired.');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the decision.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label={`Password reset request for ${row.email}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-foreground">{row.full_name || 'Name not set'}</p>
          <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
            {row.email}
            {row.role ? ` · ${row.role === 'supplier' ? 'manufacturer' : row.role}` : ''}
            {row.company_name ? ` · ${row.company_name}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Registered mobile (call this)</dt>
          <dd className="font-semibold text-foreground">
            {row.phone_registered ? (
              <a href={`tel:${dial(row.phone_registered)}`} className="inline-flex items-center gap-1.5 text-[#C24400] hover:underline dark:text-[#FF8A3D]">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {row.phone_registered}
              </a>
            ) : (
              <span className="text-destructive">No number on the account</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Number typed with the request</dt>
          <dd className="font-semibold text-foreground">{row.phone_given}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Asked</dt>
          <dd>{when(row.created_at)}{pending ? ` · expires ${when(row.expires_at)}` : ''}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">From address</dt>
          <dd className="[overflow-wrap:anywhere]">
            {row.ip || 'unknown'}
            {row.requests_same_ip_24h > 2 ? ` · ${row.requests_same_ip_24h} requests from it in 24 h` : ''}
          </dd>
        </div>
      </dl>

      {pending && row.phone_match === false && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12.5px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          The number typed with the request is not the one on the account. Call the registered number, not the typed one.
        </p>
      )}

      {!pending && (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          {row.decided_at ? `Decided ${when(row.decided_at)}` : ''}
          {row.decided_by_name ? ` by ${row.decided_by_name}` : ''}
          {row.note ? ` · “${row.note}”` : ''}
        </p>
      )}

      {pending && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <label className="flex items-start gap-2 text-[13px] font-semibold text-foreground">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#FF5A00]" checked={called} onChange={(e) => setCalled(e.target.checked)} />
            I called the registered mobile number and the account owner confirmed they asked for this reset.
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Note (optional), e.g. who you spoke to"
            aria-label="Note about the call"
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[13px] text-foreground"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide(true)} disabled={!called || busy !== null} className="gap-1.5 bg-[#FF5A00] text-white hover:bg-[#e04e00]">
              {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              Approve new password
            </Button>
            <Button variant="outline" onClick={() => decide(false)} disabled={busy !== null} className="gap-1.5">
              {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
              Reject
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function AdminPasswordResetsPage() {
  const [view, setView] = useState<'pending' | 'done'>('pending');
  const [rows, setRows] = useState<AdminResetRequest[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await loadResetRequests(view);
      setRows(out.rows);
      setPending(out.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the requests.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout>
      <PageMeta title="Password Resets | BulkSkart Admin" description="Password reset requests waiting for a phone check." robots="noindex, nofollow" />
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> Password Resets
            </h1>
            <p className="text-sm text-muted-foreground">
              People who forgot their password set a new one on the login page. Call the registered mobile number, confirm it is the owner, then approve.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </Button>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Which requests">
          {(['pending', 'done'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                view === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground/80 hover:border-primary/40'
              }`}
            >
              {key === 'pending' ? `Waiting${pending !== null ? ` (${pending})` : ''}` : 'Decided'}
            </button>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card py-14 text-center">
            <p className="text-sm font-semibold text-foreground">The requests could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-14 text-center">
            <p className="text-sm font-semibold text-foreground">{view === 'pending' ? 'No password reset is waiting.' : 'No decided requests yet.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <RequestCard key={`${row.id}-${row.status}`} row={row} onDone={load} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
