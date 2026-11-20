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
import {
  CYCLE_MS,
  NO_RFQ_ALERT_PATHS,
  RFQ_ALERTS_EVENT,
  VISIBLE_MS,
  isNewRfq,
  rfqAlertsOff,
  rfqBudgetPerUnit,
  rfqQuantity,
  setRfqAlertsOff,
  usableLeads,
  type RfqLead as Lead,
} from '@/lib/rfqAlerts';

/** The first one, a few seconds after the page settles. */
const FIRST_MS = 6_000;
const REFRESH_MS = 5 * 60_000;
const LIMIT = 12;
const SELECT =
  'id,req_number,title,description,specifications,quantity,quantity_unit,budget_min,budget_max,currency,status,created_at,deadline,expires_at';





async function loadLeads(): Promise<Lead[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('requirements')
    .select(SELECT)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`deadline.is.null,deadline.gt.${now}`)
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
  const budget = rfqBudgetPerUnit(current);
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
      className="fixed inset-x-2 top-[max(8px,env(safe-area-inset-top))] z-[85] mx-auto max-w-[620px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-6 motion-safe:duration-300 sm:top-3"
    >
      {/* orange edge on the left fading to a light edge on the right, as in the design */}
      <div className="rounded-[20px] bg-gradient-to-r from-[#FF7A1A] via-[#FF6A00]/45 to-white/35 p-[1.5px] shadow-[0_18px_46px_-16px_rgba(255,106,0,0.75)] sm:rounded-[26px]">
        <div className="relative overflow-hidden rounded-[18.5px] bg-[#0b0b0b]/[0.97] backdrop-blur-xl sm:rounded-[24.5px]">
          <div aria-hidden="true" className="pointer-events-none absolute -left-10 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-[#FF6A00]/25 blur-3xl" />

          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:right-3 sm:top-3 sm:h-9 sm:w-9"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
          </button>

          <div className="relative flex gap-3 px-3 pb-2.5 pt-3 sm:gap-5 sm:px-5 sm:pb-4 sm:pt-4">
            {/* bell */}
            <div className="flex shrink-0 items-start pt-1 sm:items-center sm:pt-0">
              <BellRing className="bs-bell-ring h-10 w-10 fill-[#FF6A00] text-[#FF6A00] sm:h-14 sm:w-14" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-white/25" />

            <div className="min-w-0 flex-1 pr-7 sm:pr-9">
              <span className="inline-flex rounded-[10px] bg-gradient-to-r from-[#FF7A1A] to-[#E85500] px-2.5 py-1 text-[13px] font-black leading-none text-white shadow-[0_6px_16px_-6px_rgba(255,106,0,0.9)] sm:rounded-xl sm:px-3.5 sm:py-1.5 sm:text-[17px]">
                {fresh ? 'New RFQ Posted!' : 'Live RFQ'}
              </span>
              <p id="rfq-alert-title" className="mt-1.5 truncate text-[16px] font-black leading-tight text-white sm:mt-2 sm:text-[22px]" title={current.title}>
                {current.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-white sm:mt-2 sm:gap-x-4 sm:text-[16px]">
                {quantity && (
                  <span className="flex items-center gap-1.5">
                    <Box className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={1.9} aria-hidden="true" />
                    Qty: {quantity}
                  </span>
                )}
                {quantity && <span aria-hidden="true" className="h-4 w-px bg-white/30 sm:h-5" />}
                <span className="flex items-center gap-1">
                  <IndianRupee className="h-4 w-4 shrink-0 text-[#FF6A00] sm:h-5 sm:w-5" strokeWidth={2.2} aria-hidden="true" />
                  Budget:&nbsp;
                  <span className="font-semibold text-[#FF7A1A]">{budget ?? 'Open to quotes'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-between gap-2 px-3 pb-3 sm:px-5 sm:pb-4">
            <button
              type="button"
              onClick={hideAlerts}
              className="flex h-8 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold text-white/55 transition-colors hover:bg-white/5 hover:text-white sm:text-[12.5px]"
            >
              <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
              Hide alerts
            </button>
            <button
              type="button"
              onClick={view}
              className="group flex h-9 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] px-4 text-[14px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(255,106,0,0.95)] transition-transform hover:brightness-110 active:scale-[0.98] sm:h-12 sm:px-7 sm:text-[18px]"
            >
              View RFQ
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 sm:h-5 sm:w-5" strokeWidth={2.4} />
            </button>
          </div>

          {/* time left before it slides away; full while it is being read, then counts down again */}
          <span
            key={held ? 'held' : 'running'}
            aria-hidden="true"
            className={`absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-[#FF7A1A] to-[#FF6A00]/40 ${held ? '' : 'bs-alert-drain'}`}
            style={held ? undefined : { animationDuration: `${VISIBLE_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
