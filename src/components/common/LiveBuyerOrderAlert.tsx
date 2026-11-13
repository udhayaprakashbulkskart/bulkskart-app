/**
 * Homepage buyer-alert carousel.
 * Active, unexpired rows from public.requirements only.
 * Buyer names and companies stay hidden, matching the public Buy Leads cards.
 * When no leads qualify, the popup stays hidden.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { checkDirectMessageQuota, checkSupplierPaidSubscription } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import BrandLogo from '@/components/common/BrandLogo';
import { resolveRfqImage } from '@/lib/contentImages';

const DISMISS_KEY = 'bsk_live_buyer_alert_dismissed';
const LEGACY_DISMISS_KEY = 'bsk_lead_popup_session';
const PAUSE_KEY = 'bsk_live_buyer_alert_paused';
const ROTATE_MS = 6000;
const POLL_MS = 60_000;
const LEAD_LIMIT = 8;
const PEEK = 0.22;
const GAP = 10;
const DRAG_THRESHOLD = 48;

const LEAD_SELECT =
  'id,req_number,title,quantity,quantity_unit,destination_city,destination_country,status,is_verified_buyer,created_at,deadline,expires_at,attachment_url,images,buyer_id,category_id,categories!category_id(id,name,slug)';

function isTestTitle(title: string): boolean {
  return /\b(test|debug|timed|timeout)\b/i.test(title) || /^test\b/i.test(title.trim());
}

function activeFilters(nowIso: string) {
  return supabase
    .from('requirements')
    .select(LEAD_SELECT)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .or(`deadline.is.null,deadline.gt.${nowIso}`);
}

function timeAgo(iso?: string | null): string | null {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function locationOf(req: Requirement): string | null {
  const city = req.destination_city?.trim();
  const country = req.destination_country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || null;
}

function quantityOf(req: Requirement): string | null {
  const qty = Number(req.quantity);
  if (!Number.isFinite(qty)) return null;
  const unit = req.quantity_unit?.trim();
  const formatted = qty.toLocaleString('en-IN');
  return unit ? `${formatted} ${unit}` : formatted;
}

function leadImage(req: Requirement): string {
  const listed = (req.images || []).find(url => url?.includes('/product-images/catalog/'));
  if (listed) return listed;
  if (req.attachment_url?.includes('/product-images/catalog/')) return req.attachment_url;
  return resolveRfqImage({
    id: req.id,
    title: req.title,
    attachment_url: req.attachment_url,
    category: req.categories?.name,
    categories: req.categories,
  });
}

function dedupe(rows: Requirement[]): Requirement[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: Requirement[] = [];
  for (const row of rows) {
    if (!row?.id || !row.title) continue;
    if (isTestTitle(row.title)) continue;
    const title = row.title.trim().toLowerCase();
    if (seenIds.has(row.id) || (title && seenTitles.has(title))) continue;
    seenIds.add(row.id);
    if (title) seenTitles.add(title);
    out.push(row);
  }
  return out;
}

function readDismissed(): boolean {
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return true;
    return sessionStorage.getItem(LEGACY_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function withClones(leads: Requirement[]): Requirement[] {
  if (leads.length < 2) return leads;
  return [leads[leads.length - 1], ...leads, leads[0]];
}

function logicalIndex(pos: number, count: number): number {
  if (count <= 1) return 0;
  if (pos <= 0) return count - 1;
  if (pos > count) return 0;
  return pos - 1;
}

export default function LiveBuyerOrderAlert() {
  const { user, profile, company } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [dismissed, setDismissed] = useState(readDismissed);
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
  });
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [leads, setLeads] = useState<Requirement[]>([]);
  const [pos, setPos] = useState(1);
  const [instant, setInstant] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<SubscriptionReason>('not_logged_in');
  const [respondReq, setRespondReq] = useState<Requirement | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const leadsRef = useRef(leads);
  const dragRef = useRef({ pointerId: -1, startX: 0, startY: 0, dx: 0, locked: false });
  const suppressClick = useRef(false);
  leadsRef.current = leads;

  const hiddenRoute =
    location.pathname.includes('/business-setup') ||
    location.pathname.includes('/onboarding') ||
    location.pathname.includes('/post-requirement') ||
    location.pathname.includes('/negotiation') ||
    location.pathname.includes('/auth') ||
    location.pathname.includes('/settings');

  const loadLeads = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await activeFilters(nowIso)
      .order('created_at', { ascending: false })
      .limit(LEAD_LIMIT);
    if (error) throw error;
    return dedupe((data ?? []) as unknown as Requirement[]);
  }, []);

  useEffect(() => {
    if (dismissed || hiddenRoute) return;
    let cancelled = false;
    const showTimer = window.setTimeout(() => { if (!cancelled) setReady(true); }, 900);
    (async () => {
      try {
        const rows = await loadLeads();
        if (!cancelled) setLeads(rows);
      } catch {
        if (!cancelled) setLeads([]);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, [dismissed, hiddenRoute, loadLeads]);

  useEffect(() => {
    if (dismissed || hiddenRoute) return;
    const timer = window.setInterval(async () => {
      try {
        const rows = await loadLeads();
        const prev = leadsRef.current;
        const same = prev.length === rows.length && prev.every((row, index) => row.id === rows[index]?.id);
        if (same) return;
        const added = rows.find(row => !prev.some(item => item.id === row.id));
        if (added && prev.length > 0) setArrivedId(added.id);
        setLeads(rows);
      } catch {
        /* keep the leads already on screen */
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [dismissed, hiddenRoute, loadLeads]);

  useEffect(() => {
    if (!arrivedId) return;
    const timer = window.setTimeout(() => setArrivedId(null), 700);
    return () => window.clearTimeout(timer);
  }, [arrivedId]);

  useEffect(() => {
    if (leads.length === 0) return;
    if (arrivedId && leads[0]?.id === arrivedId && leads.length > 1) {
      setPos(1);
      return;
    }
    setPos(current => {
      if (leads.length < 2) return 0;
      if (current < 1 || current > leads.length) return 1;
      return current;
    });
  }, [leads, arrivedId]);

  const loop = leads.length > 1;
  const slides = useMemo(() => withClones(leads), [leads]);
  const hold = paused || hovering || focused || dragging || reduce || leads.length < 2;

  useEffect(() => {
    if (dismissed || hiddenRoute || hold) return;
    const timer = window.setTimeout(() => setPos(current => current + 1), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [dismissed, hiddenRoute, hold, pos]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const apply = () => setViewportWidth(el.clientWidth);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, leads.length]);

  const cardWidth = viewportWidth === 0
    ? 0
    : leads.length < 2
      ? Math.round(viewportWidth * 0.9)
      : Math.round((viewportWidth - GAP * 2) / (1 + PEEK * 2));
  const stride = cardWidth + GAP;
  const trackX = viewportWidth === 0 || cardWidth === 0
    ? 0
    : (viewportWidth - cardWidth) / 2 - pos * stride + dragX;
  const active = logicalIndex(pos, leads.length);

  const settleClone = () => {
    if (!loop) return;
    if (pos === 0 || pos === leads.length + 1) {
      setInstant(true);
      setPos(pos === 0 ? leads.length : 1);
    }
  };

  useEffect(() => {
    if (!instant) return;
    const frame = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(frame);
  }, [instant, pos]);

  const step = (direction: number) => {
    if (leads.length < 2) return;
    setDragX(0);
    if (reduce) {
      setInstant(true);
      setPos(() => {
        const next = (active + direction + leads.length) % leads.length;
        return next + 1;
      });
      return;
    }
    setInstant(false);
    setPos(current => current + direction);
  };

  const goTo = (index: number) => {
    setDragX(0);
    setInstant(reduce);
    setPos(leads.length > 1 ? index + 1 : 0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (leads.length < 2) return;
    if ((event.target as HTMLElement).closest('[data-no-drag]')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      locked: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = { pointerId: -1, startX: 0, startY: 0, dx: 0, locked: false };
        return;
      }
      drag.locked = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    drag.dx = dx;
    setDragX(dx);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const dx = drag.dx;
    const locked = drag.locked;
    dragRef.current = { pointerId: -1, startX: 0, startY: 0, dx: 0, locked: false };
    if (!locked) return;
    setDragging(false);
    if (Math.abs(dx) < DRAG_THRESHOLD || stride === 0) {
      setDragX(0);
      return;
    }
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    const shifts = Math.max(1, Math.round(Math.abs(dx) / stride));
    setDragX(0);
    if (reduce) {
      step(dx < 0 ? shifts : -shifts);
      return;
    }
    setInstant(false);
    setPos(current => {
      const max = leads.length + 1;
      return Math.max(0, Math.min(max, current + (dx < 0 ? shifts : -shifts)));
    });
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
      sessionStorage.setItem(LEGACY_DISMISS_KEY, 'true');
    } catch { /* storage blocked */ }
    setDismissed(true);
  };

  const togglePause = () => {
    setPaused(current => {
      const next = !current;
      try { localStorage.setItem(PAUSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const openRequirement = (req: Requirement) => {
    if (suppressClick.current) return;
    navigate(`/requirement/${req.id}`);
  };

  const contactBuyer = async (req: Requirement) => {
    if (suppressClick.current) return;
    if (!user || !profile) { setDialogReason('not_logged_in'); setDialogOpen(true); return; }
    if (!company) { setDialogReason('not_registered_business'); setDialogOpen(true); return; }
    const sub = await checkSupplierPaidSubscription(company.id, company);
    if (!sub.allowed) { setDialogReason(sub.reason); setDialogOpen(true); return; }
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') { setDialogReason(quota); setDialogOpen(true); return; }
    setRespondReq(req);
  };

  if (dismissed || hiddenRoute || !ready || leads.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes bsk-alert-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bsk-card-arrive { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes bsk-live-glow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,101,0,0.75), 0 10px 28px -16px rgba(255,138,0,0.95); }
          50% { box-shadow: 0 0 0 1px rgba(255,138,0,0.95), 0 12px 32px -12px rgba(255,101,0,1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bsk-alert-motion { animation: none !important; }
        }
      `}</style>
      <aside
        className="bsk-alert-motion fixed z-40 w-[92%] max-w-[440px] overflow-hidden rounded-[22px] border border-[#FF6500]/75 bg-[#080808]/90 text-white shadow-[0_18px_40px_-24px_rgba(255,138,0,0.85)] backdrop-blur-xl bottom-[max(12px,env(safe-area-inset-bottom))] left-[4%] md:bottom-auto md:left-auto md:right-5 md:top-[116px] md:w-[440px]"
        style={{ animation: reduce ? undefined : 'bsk-alert-in 0.35s ease both' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
        }}
        aria-roledescription="carousel"
        aria-label="Live buyer alert"
        data-pos={active}
      >
        <div className="relative">
          <div
            ref={viewportRef}
            data-carousel
            className="overflow-hidden py-3"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className="flex items-stretch"
              style={{
                gap: GAP,
                transform: `translate3d(${trackX}px,0,0)`,
                transition: dragging || instant || reduce ? 'none' : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform',
              }}
              onTransitionEnd={event => {
                if (event.propertyName !== 'transform' || event.target !== event.currentTarget) return;
                settleClone();
              }}
            >
              {cardWidth > 0 && slides.map((req, index) => {
                const distance = Math.abs(index - (pos - dragX / Math.max(stride, 1)));
                const isActive = distance < 0.5;
                return (
                  <AlertCard
                    key={`${req.id}-${index}`}
                    req={req}
                    width={cardWidth}
                    active={isActive}
                    arrived={arrivedId === req.id && isActive && !reduce}
                    reduce={reduce}
                    onView={() => openRequirement(req)}
                    onContact={() => contactBuyer(req)}
                    onDismiss={dismiss}
                  />
                );
              })}
            </div>
          </div>
          {loop && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                className="absolute left-1 top-1/2 z-10 flex h-11 min-h-[44px] w-11 min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#080808]/85 text-white hover:border-[#FF6500]"
                aria-label="Previous lead"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="absolute right-1 top-1/2 z-10 flex h-11 min-h-[44px] w-11 min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#080808]/85 text-white hover:border-[#FF6500]"
                aria-label="Next lead"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" role="tablist" aria-label="Buyer requirements">
            {leads.map((req, index) => (
              <button
                key={req.id}
                type="button"
                role="tab"
                aria-label={`Show lead ${index + 1}: ${req.title}`}
                aria-selected={index === active}
                onClick={() => goTo(index)}
                className="flex h-11 w-6 shrink-0 items-center justify-center"
              >
                <span className={`block h-2 rounded-full ${index === active ? 'w-4 bg-[#FF6500]' : 'w-2 bg-white/30'}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={togglePause}
            className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label={paused ? 'Resume buyer alerts' : 'Pause buyer alerts'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>
        <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Link
            to="/requirements"
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#FF6500] text-[13px] font-bold text-white hover:bg-[#FF8A00]"
          >
            View all buyer requirements
          </Link>
        </div>
      </aside>

      <SubscribeToContactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} reason={dialogReason} />
      {respondReq && user && company && (
        <SupplierRespondDialog
          requirement={respondReq}
          open={!!respondReq}
          onClose={() => setRespondReq(null)}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => setRespondReq(null)}
        />
      )}
    </>
  );
}

function AlertCard({
  req,
  width,
  active,
  arrived,
  reduce,
  onView,
  onContact,
  onDismiss,
}: {
  req: Requirement;
  width: number;
  active: boolean;
  arrived: boolean;
  reduce: boolean;
  onView: () => void;
  onContact: () => void;
  onDismiss: () => void;
}) {
  const qty = quantityOf(req);
  const place = locationOf(req);
  const posted = timeAgo(req.created_at);
  return (
    <article
      data-card={req.id}
      data-active={active ? 'true' : 'false'}
      className="shrink-0"
      style={{
        width: width || undefined,
        transform: `scale(${active ? 1.03 : 0.94})`,
        opacity: active ? 1 : 0.48,
        zIndex: active ? 2 : 1,
        transition: reduce ? 'none' : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease',
      }}
    >
      <div
        className={`overflow-hidden rounded-[18px] border bg-[#080808] ${active ? 'border-[#FF6500]' : 'border-white/10'} ${active && !reduce ? 'bsk-alert-motion' : ''}`}
        style={active && !reduce ? { animation: 'bsk-live-glow 3.8s ease-in-out infinite' } : undefined}
      >
        <div
          className="p-2.5"
          style={arrived ? { animation: 'bsk-card-arrive 0.45s ease' } : undefined}
        >
          <header className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <BrandLogo size="sm" variant="dark" linkTo={null} className="!h-5 !max-w-[108px]" />
              <div className="mt-1 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-[#FF8A00] opacity-70 ${reduce ? '' : 'animate-ping'}`} />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF8A00]" />
                </span>
                <span className="text-[10px] font-black tracking-[0.14em] text-white">LIVE</span>
                {posted && <span className="truncate text-[10px] text-white/60">{posted}</span>}
              </div>
            </div>
            {active && (
              <button
                type="button"
                data-no-drag
                onClick={onDismiss}
                className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
                aria-label="Close buyer alerts"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </header>

          <span className="mt-1 inline-flex rounded-md bg-[#FF6500] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">
            New Buyer Requirement
          </span>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onView} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#141414]" aria-label={`View ${req.title}`}>
              <img
                src={leadImage(req)}
                alt=""
                width={112}
                height={112}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
            <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
              <h3 className="line-clamp-3 break-words text-[13px] font-semibold leading-snug text-white">{req.title}</h3>
            </button>
          </div>
          <div className="mt-2 space-y-0.5 text-[12px] leading-snug text-white/80">
            {qty && <p className="break-words text-[#FF8A00]">Qty: {qty}</p>}
            {place && <p className="break-words">{place}</p>}
            {req.is_verified_buyer && (
              <p className="inline-flex items-center gap-1 font-medium text-white">
                <BadgeCheck className="h-3.5 w-3.5 text-[#FF8A00]" /> Verified Buyer
              </p>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" data-no-drag onClick={onView} className="h-11 min-h-[44px] rounded-full border border-white/20 text-[12px] font-semibold text-white hover:border-[#FF6500]">
              View Lead
            </button>
            <button type="button" data-no-drag onClick={onContact} className="h-11 min-h-[44px] rounded-full bg-[#FF6500] text-[12px] font-bold text-white hover:bg-[#FF8A00]">
              Contact Buyer
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
