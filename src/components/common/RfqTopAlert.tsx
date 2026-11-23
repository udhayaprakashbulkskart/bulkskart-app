/**
 * "New RFQ Posted!" popup notification at the top of the site.
 *
 * Every 10 seconds the next open buyer requirement slides in at the top (centred on large screens), stays about
 * seven seconds and slides away; hovering or focusing it keeps it on screen. A requirement posted while the page is
 * open is shown straight away. Only real, open RFQs posted on BulkSkart are shown (no tender-portal listings, no
 * template rows); with none open, nothing appears. × closes the one on screen; "Hide alerts" turns the popups off
 * for this browser (they can be turned back on from the Live RFQ section).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BellOff, BellRing, Box, IndianRupee, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { Requirement } from '@/types/types';
import { withoutOutsideOrDemoRfqs } from '@/lib/rfqSources';
import {
  CYCLE_MS,
  NO_RFQ_ALERT_PATHS,
  RFQ_ALERTS_EVENT,
  VISIBLE_MS,
  isNewRfq,
  rfqAlertsOff,
  rfqBudget,
  rfqQuantity,
  setRfqAlertsOff,
  usableLeads,
  type RfqLead as Lead,
} from '@/lib/rfqAlerts';

/** The first one, a few seconds after the page settles. */
const FIRST_MS = 6_000;
const REFRESH_MS = 5 * 60_000;
const LIMIT = 12;
// '*' so source_type is read when the database has it (public listings are left out) and nothing breaks before
const SELECT = '*';

async function loadLeads(): Promise<Lead[]> {
  const now = new Date().toISOString();
  const query = supabase
    .from('requirements')
    .select(SELECT)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`deadline.is.null,deadline.gt.${now}`);
  const { data, error } = await withoutOutsideOrDemoRfqs(query)
    .order('created_at', { ascending: false })
    .limit(LIMIT * 2);
  if (error) throw error;
  return usableLeads((data ?? []) as unknown as Lead[]).slice(0, LIMIT);
}

/** On phones the Download App popup also sits at the top; the RFQ popup waits while it is open. */
function topSpotTaken(): boolean {
  if (typeof window === 'undefined') return false;
  const phone = window.matchMedia?.('(max-width: 767px)').matches;
  return Boolean(phone && document.getElementById('download-app-title'));
}

export default function RfqTopAlert() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [off, setOff] = useState(rfqAlertsOff);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [current, setCurrent] = useState<Lead | null>(null);
  const [showKey, setShowKey] = useState(0);
  const [held, setHeld] = useState(false);
  const nextIndex = useRef(0);
  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;
  const heldRef = useRef(false);
  heldRef.current = held;
  const blockedPage = NO_RFQ_ALERT_PATHS.test(pathname);
  const active = !off && !blockedPage;

  // follow the on/off choice made here or in the Live RFQ section
  useEffect(() => {
    const sync = () => setOff(rfqAlertsOff());
    window.addEventListener(RFQ_ALERTS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RFQ_ALERTS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const show = useCallback((lead: Lead) => {
    if (topSpotTaken()) return;
    setCurrent(lead);
    setShowKey((k) => k + 1);
  }, []);

  const showNext = useCallback(() => {
    const list = leadsRef.current;
    if (list.length === 0 || heldRef.current) return;
    const lead = list[nextIndex.current % list.length];
    nextIndex.current += 1;
    show(lead);
  }, [show]);

  // open RFQs, refreshed now and then
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const refresh = () =>
      loadLeads()
        .then((rows) => {
          if (!cancelled) setLeads(rows);
        })
        .catch(() => {
          /* keep what is already loaded */
        });
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active]);

  // a requirement posted while the page is open is shown straight away
  useEffect(() => {
    if (!active) return;
    const channel = supabase
      .channel('rfq-top-alert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requirements' }, (payload) => {
        const row = payload.new as Lead & { status?: string };
        if (row.status && row.status !== 'active') return;
        const [lead] = usableLeads([row]);
        if (!lead) return;
        setLeads((prev) => [lead, ...prev.filter((p) => p.id !== lead.id)].slice(0, LIMIT));
        if (!heldRef.current) show(lead);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, show]);

  // one every 10 seconds
  const hasLeads = leads.length > 0;
  useEffect(() => {
    if (!active || !hasLeads) return;
    let cycle = 0;
    const first = window.setTimeout(() => {
      showNext();
      cycle = window.setInterval(showNext, CYCLE_MS);
    }, FIRST_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(cycle);
    };
  }, [active, hasLeads, showNext]);

  // each one slides away after a while, unless the visitor is reading it
  useEffect(() => {
    if (!current || held) return;
    const timer = window.setTimeout(() => setCurrent(null), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [current, held, showKey]);

  useEffect(() => {
    if (!active) setCurrent(null);
  }, [active]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCurrent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!active || !current) return null;

  const quantity = rfqQuantity(current);
  const budget = rfqBudget(current);
  const fresh = isNewRfq(current.created_at);

  const close = () => {
    setHeld(false);
    setCurrent(null);
  };
  const hideAlerts = () => {
    setRfqAlertsOff(true);
    close();
    toast('RFQ alerts turned off', {
      description: 'Turn them back on any time from the Live RFQ section on the home page.',
      action: { label: 'Undo', onClick: () => setRfqAlertsOff(false) },
    });
  };
  const view = () => {
    close();
    navigate(`/requirement/${current.id}`);
  };

  return (
    <div
      key={showKey}
      role="status"
      aria-live="polite"
      aria-labelledby="rfq-alert-title"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      className="fixed inset-x-2 top-[max(6px,env(safe-area-inset-top))] z-[85] mx-auto max-w-[440px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-300 sm:top-2.5 sm:max-w-[500px]"
    >
      {/* orange edge on the left fading to a light edge on the right, as in the design */}
      <div className="rounded-2xl bg-gradient-to-r from-[#FF7A1A] via-[#FF6A00]/45 to-white/35 p-px shadow-[0_12px_32px_-14px_rgba(255,106,0,0.75)]">
        <div className="relative overflow-hidden rounded-[15px] bg-[#0b0b0b]/[0.97] backdrop-blur-xl">
          <div aria-hidden="true" className="pointer-events-none absolute -left-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-[#FF6A00]/25 blur-2xl" />

          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>

          <div className="relative flex items-center gap-2.5 py-2 pl-2.5 pr-2.5 sm:gap-3 sm:py-2.5 sm:pl-3">
            <BellRing className="bs-bell-ring h-7 w-7 shrink-0 fill-[#FF6A00] text-[#FF6A00] sm:h-8 sm:w-8" strokeWidth={1.8} aria-hidden="true" />
            <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-white/20" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="inline-flex shrink-0 rounded-md bg-gradient-to-r from-[#FF7A1A] to-[#E85500] px-1.5 py-[3px] text-[10.5px] font-black leading-none text-white sm:text-[11.5px]">
                  {fresh ? 'New RFQ Posted!' : 'Live RFQ'}
                </span>
                <button
                  type="button"
                  onClick={hideAlerts}
                  className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-white/45 transition-colors hover:text-white sm:text-[11px]"
                >
                  <BellOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Hide alerts</span>
                </button>
              </div>
              <p id="rfq-alert-title" className="mt-1 truncate text-[14px] font-extrabold leading-tight text-white sm:text-[15.5px]" title={current.title}>
                {current.title}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-white/90 min-[400px]:text-[11px] sm:gap-x-2 sm:text-[12px]">
                {quantity && (
                  <span className="flex items-center gap-1">
                    <Box className="hidden h-3 w-3 shrink-0 min-[400px]:block" strokeWidth={2} aria-hidden="true" />
                    Qty: {quantity}
                  </span>
                )}
                {quantity && <span aria-hidden="true" className="h-3 w-px bg-white/30" />}
                <span className="flex items-center gap-0.5">
                  <IndianRupee className="hidden h-3 w-3 shrink-0 text-[#FF6A00] sm:block" strokeWidth={2.4} aria-hidden="true" />
                  Budget:&nbsp;
                  <span className="font-semibold text-[#FF7A1A]">{budget ?? 'Open to quotes'}</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={view}
              className="group mt-5 flex h-7 shrink-0 items-center gap-1 self-end rounded-full bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] px-2.5 text-[11.5px] font-extrabold text-white shadow-[0_6px_16px_-8px_rgba(255,106,0,0.95)] transition-transform hover:brightness-110 active:scale-[0.98] sm:h-8 sm:px-3.5 sm:text-[13px]"
            >
              View RFQ
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
            </button>
          </div>

          {/* time left before it slides away; full while it is being read, then counts down again */}
          <span
            key={held ? 'held' : 'running'}
            aria-hidden="true"
            className={`absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-[#FF7A1A] to-[#FF6A00]/40 ${held ? '' : 'bs-alert-drain'}`}
            style={held ? undefined : { animationDuration: `${VISIBLE_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
