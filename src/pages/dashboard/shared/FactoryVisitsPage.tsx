import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarDays, Clock, Factory, Loader2, MapPin, Phone, RefreshCw, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Actions, CountedTextArea, Field, FormDialog, IconBox, KitButton, TextInput } from '@/components/formkit';
import { useAuth } from '@/contexts/AuthContext';
import {
  cancelFactoryVisit,
  getBuyerVisits,
  getCompanyVisits,
  respondFactoryVisit,
  VISIT_STATUS_LABEL,
  visitTime,
  type FactoryVisit,
  type VisitStatus,
} from '@/lib/orderPayments';

const STATUS_STYLE: Record<VisitStatus, string> = {
  requested: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  confirmed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  completed: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  declined: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const OPEN: VisitStatus[] = ['requested', 'confirmed'];

type Reply = { visit: FactoryVisit; action: 'reschedule' | 'decline' } | null;

/** Factory visits: buyers see the visits they booked; manufacturers confirm, move or decline requests. */
export default function FactoryVisitsPage() {
  const { user, profile, company } = useAuth();
  const isSupplier = profile?.role === 'supplier';
  const [visits, setVisits] = useState<FactoryVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState<Reply>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    if (isSupplier && company?.id) setVisits(await getCompanyVisits(company.id));
    else if (!isSupplier && user?.id) setVisits(await getBuyerVisits(user.id));
    setLoading(false);
  }, [isSupplier, company?.id, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, action: () => Promise<string | null>, success: string) => {
    setBusy(key);
    const problem = await action();
    setBusy(null);
    if (problem) toast.error(problem);
    else {
      toast.success(success);
      load();
    }
  };

  const openReply = (visit: FactoryVisit, action: 'reschedule' | 'decline') => {
    const at = new Date(visit.confirmed_at ?? visit.requested_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`);
    setTime(`${pad(at.getHours())}:${pad(at.getMinutes())}`);
    setNote('');
    setError('');
    setReply({ visit, action });
  };

  const sendReply = async () => {
    if (!reply) return;
    let when: Date | null = null;
    if (reply.action === 'reschedule') {
      when = new Date(`${date}T${time || '00:00'}`);
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
        setError('Pick a day and time in the future.');
        document.getElementById('visit-date')?.focus();
        return;
      }
    }
    setBusy('reply');
    const problem = await respondFactoryVisit(reply.visit.id, reply.action === 'decline' ? 'decline' : 'confirm', when, note.trim());
    setBusy(null);
    if (problem) {
      setError(problem);
      return;
    }
    toast.success(reply.action === 'decline' ? 'The buyer has been told you cannot host the visit.' : 'The buyer has been told the new time.');
    setReply(null);
    load();
  };

  const shown = visits.filter((v) => (tab === 'upcoming' ? OPEN.includes(v.status) : !OPEN.includes(v.status)));

  return (
    <DashboardLayout>
      <PageMeta title="Factory Visits | BulkSkart" description="Visits buyers have booked to manufacturers' factories." robots="noindex, nofollow" />
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Factory className="w-5 h-5 text-primary" /> Factory Visits
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSupplier ? 'Buyers who want to visit your factory. Confirm, suggest another time, or decline.' : 'Visits you booked. Book one from a manufacturer’s page or from an order.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Which visits">
          {(['upcoming', 'past'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${tab === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground/80 border-border'}`}
            >
              {key === 'upcoming' ? 'Upcoming' : 'Past and closed'} ({visits.filter((v) => (key === 'upcoming' ? OPEN.includes(v.status) : !OPEN.includes(v.status))).length})
            </button>
          ))}
        </div>

        {loading && visits.length === 0 ? (
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border" />
        ) : shown.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl text-sm text-muted-foreground">
            {tab === 'upcoming' ? (isSupplier ? 'No visit requests waiting.' : 'No upcoming visits.') : 'Nothing here yet.'}
            {!isSupplier && tab === 'upcoming' && (
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link to="/manufacturers">Find a manufacturer</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((v) => {
              const moved = v.confirmed_at && v.confirmed_at !== v.requested_at;
              const place = [v.companies?.address, v.companies?.city, v.companies?.state].filter(Boolean).join(', ');
              const past = new Date(v.confirmed_at ?? v.requested_at).getTime() < Date.now();
              return (
                <li key={v.id} className="bg-card border border-border rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-primary" /> {visitTime(v)}
                      </p>
                      {moved && (
                        <p className="text-xs text-muted-foreground">
                          Asked for {visitTime({ requested_at: v.requested_at, confirmed_at: null })}; the manufacturer set this time.
                        </p>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLE[v.status]}`}>{VISIT_STATUS_LABEL[v.status]}</span>
                  </div>

                  {isSupplier ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">{v.buyer?.full_name || 'Buyer'}</span>
                      {v.contact_phone && (
                        <a href={`tel:${v.contact_phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 text-primary">
                          <Phone className="w-3 h-3" /> {v.contact_phone}
                        </a>
                      )}
                      {v.buyer?.email && <a href={`mailto:${v.buyer.email}`} className="text-primary">{v.buyer.email}</a>}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {v.visitors} {v.visitors === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {v.companies?.slug ? (
                        <Link to={`/companies/${v.companies.slug}`} className="text-foreground font-medium hover:text-primary">{v.companies.company_name}</Link>
                      ) : (
                        <span className="text-foreground font-medium">{v.companies?.company_name ?? 'Manufacturer'}</span>
                      )}
                      {place && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {place}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {v.visitors} {v.visitors === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  )}

                  {v.purpose && <p className="text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">{v.purpose}</p>}
                  {v.manufacturer_note && (
                    <p className="text-xs text-muted-foreground">
                      <b className="text-foreground">{isSupplier ? 'Your note:' : 'From the manufacturer:'}</b> {v.manufacturer_note}
                    </p>
                  )}
                  {v.order_id && (
                    <Link to={`/dashboard/${isSupplier ? 'supplier' : 'buyer'}/orders/${v.order_id}`} className="text-xs text-primary hover:underline">
                      About an order
                    </Link>
                  )}

                  {OPEN.includes(v.status) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {isSupplier ? (
                        <>
                          {v.status === 'requested' && (
                            <Button size="sm" disabled={busy !== null} onClick={() => act(v.id, () => respondFactoryVisit(v.id, 'confirm', null, ''), 'Visit confirmed. The buyer has been told.')} className="gap-1.5">
                              {busy === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarCheck className="w-3.5 h-3.5" />} Confirm this time
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => openReply(v, 'reschedule')} className="gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> {v.status === 'requested' ? 'Suggest another time' : 'Change time'}
                          </Button>
                          {v.status === 'confirmed' && past && (
                            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(v.id, () => respondFactoryVisit(v.id, 'complete', null, ''), 'Marked as visited.')}>
                              Mark visited
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => openReply(v, 'decline')} className="text-destructive">
                            Decline
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act(v.id, () => cancelFactoryVisit(v.id), 'Visit cancelled. The manufacturer has been told.')} className="gap-1.5 text-destructive">
                          {busy === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Cancel visit
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <FormDialog
        open={reply !== null}
        onOpenChange={(open) => busy !== 'reply' && !open && setReply(null)}
        busy={busy === 'reply'}
        width={560}
        title={
          reply?.action === 'decline' ? (
            <>
              Decline <em>Visit</em>
            </>
          ) : (
            <>
              Another <em>Time</em>
            </>
          )
        }
        description={reply?.action === 'decline' ? 'Tell the buyer why, if you like.' : 'Set the time that suits you. The buyer is told and can cancel if it does not suit them.'}
      >
        <form
          noValidate
          className="fk-form fk-stack"
          onSubmit={(e) => {
            e.preventDefault();
            sendReply();
          }}
        >
          {reply?.action === 'reschedule' && (
            <div className="fk-grid">
              <Field htmlFor="visit-date" label="Day" required error={error}>
                <IconBox icon={CalendarDays}>
                  <TextInput id="visit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={Boolean(error)} iconPadding />
                </IconBox>
              </Field>
              <Field htmlFor="visit-time" label="Time" required>
                <IconBox icon={Clock}>
                  <TextInput id="visit-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} iconPadding />
                </IconBox>
              </Field>
            </div>
          )}
          <Field htmlFor="visit-note" label="Note for the buyer" optional>
            <CountedTextArea id="visit-note" icon={Factory} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reply?.action === 'decline' ? 'e.g. The factory is closed that week' : 'e.g. Use gate 2; ask for Mr Ravi'} />
          </Field>
          {error && reply?.action === 'decline' && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Actions>
            <KitButton type="submit" variant={reply?.action === 'decline' ? 'danger' : 'primary'} disabled={busy === 'reply'}>
              {busy === 'reply' ? 'Sending…' : reply?.action === 'decline' ? 'Decline Visit' : 'Send New Time'}
            </KitButton>
            <KitButton variant="ghost" onClick={() => setReply(null)} disabled={busy === 'reply'}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      </FormDialog>
    </DashboardLayout>
  );
}
