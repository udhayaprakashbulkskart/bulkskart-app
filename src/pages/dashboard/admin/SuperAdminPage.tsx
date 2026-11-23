/**
 * Super Admin: who runs BulkSkart. Only super admins open it; they make people admins, remove admins, and make or
 * remove other super admins. Everything goes through the super_admin_* database functions (migration 00070), which
 * check the caller again and log each change.
 */
import { useCallback, useEffect, useState } from 'react';
import { Crown, History, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { superAdminError } from '@/lib/superAdmin';

interface Person {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_super_admin: boolean;
  status: string;
  created_at: string;
}

interface Change {
  created_at: string;
  changed_by_email: string | null;
  user_email: string | null;
  change: string;
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function SuperAdminPage() {
  const { user, profile } = useAuth();
  const isSuper = Boolean(profile && (profile as { is_super_admin?: boolean }).is_super_admin && profile.role === 'admin');
  const [admins, setAdmins] = useState<Person[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, log] = await Promise.all([supabase.rpc('super_admin_list_admins'), supabase.rpc('super_admin_recent_changes')]);
    if (list.error) {
      setError(superAdminError(list.error));
      setAdmins([]);
    } else {
      setError(null);
      setAdmins((list.data ?? []) as Person[]);
    }
    setChanges(log.error ? [] : ((log.data ?? []) as Change[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSuper) load();
    else setLoading(false);
  }, [isSuper, load]);

  // search as you type (3 letters or more)
  useEffect(() => {
    const q = query.trim();
    if (!isSuper || q.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('super_admin_search_users', { p_query: q });
      if (cancelled) return;
      setSearching(false);
      if (err) toast.error(superAdminError(err));
      setResults(err ? [] : ((data ?? []) as Person[]));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isSuper]);

  const act = async (person: Person, question: string, done: string, call: () => PromiseLike<{ error: { code?: string; message?: string } | null }>) => {
    if (!window.confirm(question)) return;
    setBusy(person.id);
    const { error: err } = await call();
    setBusy(null);
    if (err) {
      toast.error(superAdminError(err));
      return;
    }
    toast.success(done);
    await load();
    setResults((prev) => prev.filter((p) => p.id !== person.id));
  };
  const who = (p: Person) => p.full_name || p.email;
  const makeAdmin = (p: Person) =>
    act(p, `Make ${who(p)} an admin? Admins see every user's contact details and can approve, reject or delete anything.`, `${who(p)} is now an admin`, () =>
      supabase.rpc('super_admin_set_role', { p_user: p.id, p_role: 'admin' }));
  const removeAdmin = (p: Person) =>
    act(p, `Remove admin rights from ${who(p)}? Their account becomes a buyer account.`, `${who(p)} is no longer an admin`, () =>
      supabase.rpc('super_admin_set_role', { p_user: p.id, p_role: 'buyer' }));
  const setSuper = (p: Person, on: boolean) =>
    act(
      p,
      on ? `Make ${who(p)} a super admin? They will be able to add and remove admins, including you.` : `Remove super admin from ${who(p)}? They stay an admin.`,
      on ? `${who(p)} is now a super admin` : `${who(p)} is no longer a super admin`,
      () => supabase.rpc('super_admin_set_super', { p_user: p.id, p_on: on }),
    );

  const badge = (p: Person) =>
    p.is_super_admin ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5B301]/15 px-2 py-0.5 text-[11px] font-bold text-[#B07A00] dark:text-[#FFC928]">
        <Crown className="h-3 w-3" aria-hidden="true" /> Super admin
      </span>
    ) : p.role === 'admin' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5A00]/12 px-2 py-0.5 text-[11px] font-bold text-[#E04E00] dark:text-[#FF8A3D]">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Admin
      </span>
    ) : (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{p.role}</span>
    );

  const row = (p: Person, actions: React.ReactNode) => (
    <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF5A00]/12 text-[15px] font-black text-[#FF5A00]">
        {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-bold">
          <span className="truncate">{p.full_name || p.email}</span>
          {badge(p)}
          {p.id === user?.id && <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">You</span>}
          {p.status !== 'active' && <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-red-500">{p.status}</span>}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">{p.email} · joined {dateLabel(p.created_at)}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </li>
  );

  return (
    <DashboardLayout>
      <PageMeta title="Super Admin | BulkSkart" description="Manage who can run BulkSkart" robots="noindex, nofollow" />
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black">
              <Crown className="h-6 w-6 fill-[#FFC928] text-[#C98A00]" aria-hidden="true" /> Super Admin
            </h1>
            <p className="text-sm text-muted-foreground">Decide who runs BulkSkart. Only super admins can add or remove admins.</p>
          </div>
          {isSuper && (
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          )}
        </div>

        {!isSuper ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-[#FF5A00]" aria-hidden="true" />
            <p className="mt-3 text-[16px] font-bold">Only super admins can open this page</p>
            <p className="mt-1 text-sm text-muted-foreground">Ask a super admin to give you access.</p>
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl border border-[#F5B301]/40 bg-[#F5B301]/10 p-3 text-[12.5px] leading-snug">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C98A00]" aria-hidden="true" />
              Admins see every user's phone number and email and can approve, reject or delete anything. Give admin only to people you fully trust,
              and remove anyone below you do not recognise.
            </p>

            <section className="space-y-2.5">
              <h2 className="text-[15px] font-black">Admins ({admins.length})</h2>
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" /></div>
              ) : (
                <ul className="space-y-2">
                  {admins.map((p) =>
                    row(
                      p,
                      p.id === user?.id ? null : (
                        <>
                          <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => setSuper(p, !p.is_super_admin)}>
                            <Crown className="mr-1 h-3.5 w-3.5" /> {p.is_super_admin ? 'Remove super admin' : 'Make super admin'}
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => removeAdmin(p)} className="border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400">
                            <UserMinus className="mr-1 h-3.5 w-3.5" /> Remove admin
                          </Button>
                        </>
                      ),
                    ),
                  )}
                </ul>
              )}
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[15px] font-black">Add an admin</h2>
              <label className="relative block">
                <span className="sr-only">Search accounts by email or name</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search accounts by email or name (3 letters or more)"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-[#FF5A00]"
                />
              </label>
              {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
              {!searching && query.trim().length >= 3 && results.length === 0 && <p className="text-xs text-muted-foreground">No account matches.</p>}
              <ul className="space-y-2">
                {results.map((p) =>
                  row(
                    p,
                    p.role === 'admin' ? (
                      <span className="text-xs text-muted-foreground">Already an admin</span>
                    ) : (
                      <Button size="sm" disabled={busy === p.id} onClick={() => makeAdmin(p)} className="bg-[#FF5A00] text-white hover:bg-[#e04e00]">
                        <UserPlus className="mr-1 h-3.5 w-3.5" /> Make admin
                      </Button>
                    ),
                  ),
                )}
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="flex items-center gap-1.5 text-[15px] font-black"><History className="h-4 w-4" aria-hidden="true" /> Recent changes</h2>
              {changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {changes.map((c) => (
                    <li key={`${c.created_at}-${c.user_email}-${c.change}`} className="px-3 py-2 text-[12.5px]">
                      <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {' · '}
                      <span className="font-semibold">{c.changed_by_email ?? 'Someone'}</span> → <span className="font-semibold">{c.user_email ?? 'removed account'}</span>: {c.change}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
