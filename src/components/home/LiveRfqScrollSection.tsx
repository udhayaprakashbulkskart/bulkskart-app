/**
 * Live RFQs on the home page: a continuous auto-scrolling strip of real open
 * requirements, placed under Verified Suppliers and above Verified Products.
 *
 * Uses the same public query as /requirements (getOpenRequirements). Buyer phone
 * and email are never kept or shown (PR #54). The section hides itself when there
 * are no open RFQs. The earlier full LiveRequirementsFeed block is no longer on
 * the home page so this is not a second copy of the same list.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, MapPin, Package } from 'lucide-react';
import { getOpenRequirements } from '@/lib/api';
import { isPublicListing } from '@/lib/publicListings';
import RfqPriorityBadge from '@/components/common/RfqPriorityBadge';
import { displayPriorityTag, type RfqPriorityTag } from '@/lib/rfqPriority';
import { placeLabel, quantityLabel } from '@/lib/requirementVisuals';
import type { Requirement } from '@/types/types';
import './live-rfq-scroll.css';

const PAGE_SIZE = 20;

export type LiveRfqCard = {
  id: string;
  title: string;
  quantityLabel: string;
  city: string;
  /** Same source as the RFQ page's reference picture: first images[] URL, else attachment_url. */
  photo: string | null;
  /** Required delivery date (deadline), e.g. "12 Dec 2026". Null when the buyer left it blank. */
  deliveryDate: string | null;
  priorityTag: RfqPriorityTag | null;
};

/** The reference picture on /requirements/<id>: first saved image, otherwise the attachment. */
export function rfqReferencePhoto(req: Pick<Requirement, 'images' | 'attachment_url'>): string | null {
  const fromGallery = Array.isArray(req.images)
    ? req.images.find((url): url is string => typeof url === 'string' && Boolean(url.trim()))
    : undefined;
  if (fromGallery) return fromGallery.trim();
  const attachment = (req.attachment_url ?? '').trim();
  return attachment || null;
}

import { deliveryByLabel } from '@/lib/deliveryDate';
export { deliveryByLabel, deliveryDateLabel } from '@/lib/deliveryDate';

/** Fields the ticker may keep — never phone, email or a profile object. */
export function toLiveRfqCard(req: Requirement): LiveRfqCard {
  return {
    id: req.id,
    title: req.title,
    quantityLabel: quantityLabel(req),
    city: (req.destination_city || '').trim() || placeLabel(req) || 'Location not stated',
    photo: rfqReferencePhoto(req),
    deliveryDate: deliveryByLabel(req.deadline),
    priorityTag: displayPriorityTag(req),
  };
}

/** Repeat the list so the first copy of the track is wide enough for a seamless loop. */
export function loopUnit<T>(items: T[], minCount = 8): T[] {
  if (!items.length) return [];
  const times = Math.max(1, Math.ceil(minCount / items.length));
  return Array.from({ length: times }, () => items).flat();
}

export default function LiveRfqScrollSection() {
  const [cards, setCards] = useState<LiveRfqCard[] | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOpenRequirements({ page: 1, pageSize: PAGE_SIZE, sort: 'latest' }).then((result) => {
      if (cancelled) return;
      const rows = (result.rows ?? []).filter((row) => !isPublicListing(row)).map((row) => toLiveRfqCard(row));
      setCards(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const unit = useMemo(() => loopUnit(cards ?? []), [cards]);
  const durationSec = Math.max(24, unit.length * 4);

  if (!cards || cards.length === 0) return null;

  return (
    <section
      className="live-rfq-scroll border-b border-border bg-background py-5 text-foreground sm:py-6 md:py-7"
      aria-labelledby="live-rfq-scroll-title"
    >
      <div className="mx-auto w-full max-w-[1400px] px-2.5 sm:px-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/50 bg-[#FF5A00]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#E04E00] dark:text-[#FF7A2E] sm:text-[12px]">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF5A00] opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF5A00]" />
              </span>
              Live
            </span>
            <h2 id="live-rfq-scroll-title" className="truncate text-[20px] font-black tracking-tight min-[400px]:text-[22px] sm:text-[28px] md:text-[32px]">
              Live <span className="text-[#FF5A00]">RFQs</span>
            </h2>
          </div>
          <Link
            to="/requirements"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FF5A00] px-3 py-1.5 text-[11px] font-bold text-[#FF5A00] transition-colors hover:bg-[#FF5A00]/10 sm:px-4 sm:text-[13px]"
          >
            View all RFQs
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <div
          className={`live-rfq-scroll__viewport mt-3 sm:mt-4 ${paused ? 'is-paused' : ''}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
          }}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            className={`live-rfq-scroll__track${paused ? ' is-paused' : ''}`}
            style={{ ['--live-rfq-duration' as string]: `${durationSec}s` }}
          >
            <ul className="flex gap-3">
              {unit.map((card, index) => (
                <li key={`a-${card.id}-${index}`}>
                  <RfqTickerCard card={card} />
                </li>
              ))}
            </ul>
            <ul className="flex gap-3" aria-hidden="true">
              {unit.map((card, index) => (
                <li key={`b-${card.id}-${index}`}>
                  <RfqTickerCard card={card} tabIndex={-1} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function RfqPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed;
  return (
    <div className="aspect-[16/9] overflow-hidden rounded-xl bg-[#FF5A00]/10">
      {showPhoto ? (
        <img
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#FF5A00]" data-testid="rfq-photo-placeholder" aria-hidden="true">
          <Package className="h-8 w-8" strokeWidth={1.6} />
        </div>
      )}
    </div>
  );
}

function RfqTickerCard({ card, tabIndex }: { card: LiveRfqCard; tabIndex?: number }) {
  return (
    <article className="flex w-[230px] shrink-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm sm:w-[260px] sm:p-3.5">
      <div className="relative">
        <RfqPhoto src={card.photo} alt={card.title} />
        {card.priorityTag && (
          <div className="pointer-events-none absolute left-2 top-2 z-10" data-testid="rfq-priority-badge">
            <RfqPriorityBadge tag={card.priorityTag} className="shadow-sm" />
          </div>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-snug text-foreground sm:text-[14px]">{card.title}</h3>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Package className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
        <span className="truncate">{card.quantityLabel}</span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
        <span className="truncate">{card.city}</span>
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {card.deliveryDate ? (
          <span className={`flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold ${card.deliveryDate === 'Delivery date passed' ? 'text-muted-foreground' : 'text-[#FF5A00]'}`}>
            <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{card.deliveryDate}</span>
          </span>
        ) : (
          <span />
        )}
        <Link
          to={`/requirements/${card.id}`}
          tabIndex={tabIndex}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#E04E00] hover:underline dark:text-[#FF7A2E]"
        >
          View
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
