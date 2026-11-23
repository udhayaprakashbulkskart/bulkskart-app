/** Supplier cards for the map page: a compact card (list and phone carousel) and the full details panel. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck, Boxes, Building2, CalendarClock, ChevronRight, Clock3, ExternalLink, Factory, Info, MapPin, Navigation,
  Package, Send, Sparkles, Star, X,
} from 'lucide-react';
import type { MapProduct, MapSupplier, MapSupplierDetail } from '@/lib/supplierMap/types';
import { formatKm, type MatchResult, STOCK_LABEL, timeAgo } from '@/lib/supplierMap/matchScore';
import { entityLabel } from '@/lib/supplierMap/registration';
import { placeLine } from '@/lib/supplierMap/places';
import { cn } from '@/lib/utils';

/** Indian digit grouping (1,00,000) for Indian factories and rupee prices, international (100,000) elsewhere. */
const inr = (n: number, country?: string | null) => n.toLocaleString(!country || country === 'India' ? 'en-IN' : 'en-US');

export function priceText(p: Pick<MapProduct, 'price_min' | 'price_max' | 'currency'>): string | null {
  if (p.price_min == null && p.price_max == null) return null;
  const sym = !p.currency || p.currency === 'INR' ? '₹' : `${p.currency} `;
  const loc = !p.currency || p.currency === 'INR' ? 'India' : 'other';
  if (p.price_min != null && p.price_max != null && Number(p.price_max) !== Number(p.price_min)) return `${sym}${inr(Number(p.price_min), loc)}–${inr(Number(p.price_max), loc)}`;
  return `${sym}${inr(Number(p.price_min ?? p.price_max), loc)}`;
}

const stockTone = (s: string | null) =>
  s === 'in_stock' ? 'text-emerald-500' : s === 'limited' ? 'text-orange-500' : s === 'out_of_stock' ? 'text-red-500' : 'text-muted-foreground';

export function VerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 font-bold text-emerald-600 dark:text-emerald-400', small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]')}>
      <BadgeCheck className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" /> Verified
    </span>
  );
}

export function MatchPill({ match }: { match: MatchResult | null }) {
  if (!match) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF5A00]/12 px-2 py-0.5 text-[11px] font-black text-[#E04E00] dark:text-[#FF8A3D]" title="Smart match score">
      <Sparkles className="h-3 w-3" aria-hidden="true" /> {match.score}% match
    </span>
  );
}

function Logo({ url, name, className }: { url: string | null; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('object-cover', className)} />;
  return (
    <span className={cn('flex items-center justify-center bg-gradient-to-br from-[#FF7A2E] to-[#D94A00] font-black text-white', className)} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** A compact card: list rows and the swipeable cards on phones. */
export function SupplierCard({ s, match, selected, onSelect, onQuote, compact = false }: {
  s: MapSupplier;
  match: MatchResult | null;
  selected: boolean;
  onSelect: () => void;
  onQuote: () => void;
  compact?: boolean;
}) {
  const product = s.matched_products[0];
  return (
    <article
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors',
        selected ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/30' : 'border-border hover:border-[#FF5A00]/50',
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 items-start gap-3 text-left" aria-label={`Show ${s.company_name} on the map`}>
        <Logo url={s.logo_url} name={s.company_name} className="h-12 w-12 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14.5px] font-black leading-tight">{s.company_name}</span>
            <VerifiedBadge small />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" aria-hidden="true" />{placeLine(s.city, s.state, s.country)}</span>
            {s.distance_km != null && <span className="font-bold text-foreground">{formatKm(s.distance_km)}</span>}
            {(s.review_count ?? 0) > 0 && s.rating != null && (
              <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-[#F5B301] text-[#F5B301]" aria-hidden="true" />{Number(s.rating).toFixed(1)} ({s.review_count})</span>
            )}
          </span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>

      {product ? (
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-2.5 py-2 text-[12px]">
          <Package className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-semibold">{product.name}</span>
          {product.moq != null && <span className="shrink-0 text-muted-foreground">MOQ {inr(Number(product.moq), s.country)} {product.moq_unit ?? ''}</span>}
        </div>
      ) : (
        <p className="rounded-xl bg-muted/60 px-2.5 py-2 text-[12px] text-muted-foreground">{s.product_count} product{s.product_count === 1 ? '' : 's'} listed</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
        {s.stock_status && <span className={cn('font-bold', stockTone(s.stock_status))}>● {STOCK_LABEL[s.stock_status]}</span>}
        {s.monthly_capacity != null && (
          <span className="text-muted-foreground"><Factory className="mr-0.5 inline h-3 w-3" aria-hidden="true" />{inr(s.monthly_capacity, s.country)} {s.capacity_unit ?? 'units'}/month</span>
        )}
        {!compact && s.availability_updated_at && <span className="text-muted-foreground">Updated {timeAgo(s.availability_updated_at)}</span>}
        <span className="ml-auto"><MatchPill match={match} /></span>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onQuote} className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF5A00] px-3 text-[12.5px] font-bold text-white hover:bg-[#E04E00]">
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Request Quotation
        </button>
        <Link to={`/manufacturers/${s.slug}`} className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-border px-3 text-[12.5px] font-bold hover:border-[#FF5A00] hover:text-[#FF5A00]">
          Profile
        </Link>
      </div>
    </article>
  );
}

/** The full card for one supplier. */
export function SupplierDetailPanel({ s, detail, loading, match, onClose, onQuote }: {
  s: MapSupplier;
  detail: MapSupplierDetail | null;
  loading: boolean;
  match: MatchResult | null;
  onClose: () => void;
  onQuote: (product?: MapProduct) => void;
}) {
  const images = [detail?.cover_url ?? s.cover_url, detail?.banner_url, ...(detail?.gallery_images ?? [])].filter((u, i, a): u is string => Boolean(u) && a.indexOf(u) === i);
  const [shown, setShown] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  useEffect(() => setShown(0), [s.company_id]);
  const photos = images.filter((u) => !broken[u]);
  const products = detail?.products?.length ? detail.products : s.matched_products;
  const checks = [s.cin_verified && 'CIN/LLPIN', s.gst_verified && 'GSTIN', s.udyam_verified && 'Udyam'].filter(Boolean) as string[];
  const registryCountry = detail?.registration_country;
  const lead = detail?.lead_time_days ?? s.lead_time_days;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative h-40 shrink-0 overflow-hidden bg-gradient-to-br from-[#1a1a1d] to-[#0b0b0d] sm:h-44">
        {photos.length > 0 ? (
          <img key={photos[shown % photos.length]} src={photos[shown % photos.length]} alt={`${s.company_name} factory`} className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [photos[shown % photos.length]]: true }))} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/50">
            <Factory className="h-10 w-10" aria-hidden="true" />
            <span className="text-[11px]">No factory photos yet</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        <button type="button" onClick={onClose} aria-label="Close details" className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-[#FF5A00]">
          <X className="h-4 w-4" />
        </button>
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {photos.map((u, i) => (
              <button key={u} type="button" aria-label={`Photo ${i + 1} of ${photos.length}`} onClick={() => setShown(i)}
                className={cn('relative h-2 rounded-full after:absolute after:-inset-2.5 after:content-[""]', i === shown % photos.length ? 'w-5 bg-[#FF5A00]' : 'w-2 bg-white/60')} />
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-start gap-3">
          <Logo url={detail?.logo_url ?? s.logo_url} name={s.company_name} className="h-14 w-14 shrink-0 rounded-2xl border border-border shadow-sm" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-black leading-tight">{s.company_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <VerifiedBadge />
              <MatchPill match={match} />
              {(s.review_count ?? 0) > 0 && s.rating != null ? (
                <span className="inline-flex items-center gap-0.5 text-[12px] font-bold"><Star className="h-3.5 w-3.5 fill-[#F5B301] text-[#F5B301]" aria-hidden="true" />{Number(s.rating).toFixed(1)} <span className="font-normal text-muted-foreground">({s.review_count} review{s.review_count === 1 ? '' : 's'})</span></span>
              ) : (
                <span className="text-[12px] text-muted-foreground">No reviews yet</span>
              )}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-[12px]">
          <Fact icon={MapPin} label="Location" value={placeLine(s.city, s.state, s.country)} sub={s.distance_km != null ? `${formatKm(s.distance_km)} from you` : undefined} />
          <Fact icon={Boxes} label="Monthly capacity" value={s.monthly_capacity != null ? `${inr(s.monthly_capacity, s.country)} ${s.capacity_unit ?? 'units'}` : 'Not listed'} sub={!s.monthly_capacity && detail?.production_capacity_text ? detail.production_capacity_text : undefined} />
          <Fact icon={Package} label="Lowest MOQ" value={s.min_moq != null ? `${inr(s.min_moq, s.country)} ${s.moq_unit ?? ''}` : 'Ask the supplier'} />
          <Fact icon={Clock3} label="Stock" value={s.stock_status ? STOCK_LABEL[s.stock_status] : 'Not updated'} sub={lead != null ? `Lead time ${lead} day${lead === 1 ? '' : 's'}` : undefined} tone={stockTone(s.stock_status)} />
        </dl>
        <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {s.availability_updated_at ? `Availability last updated ${timeAgo(s.availability_updated_at)} by the supplier` : 'The supplier has not updated availability yet'}
        </p>

        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <h3 className="flex items-center gap-1.5 text-[13px] font-black text-emerald-700 dark:text-emerald-400"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified business</h3>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            {entityLabel(detail?.entity_type)}
            {s.registry_verified
              ? `: registration checked in the official company registry${registryCountry ? ` of ${registryCountry}` : ''}`
              : checks.length ? `: ${checks.join(', ')} checked on the government portal` : ''}{' '}
            and the factory location checked by BulkSkart
            {s.verified_since ? ` (approved ${new Date(s.verified_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})` : ''}.
          </p>
        </section>

        {match && (
          <section>
            <h3 className="flex items-center gap-1.5 text-[13px] font-black"><Sparkles className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Why {match.score}% match</h3>
            <ul className="mt-2 space-y-1.5">
              {match.parts.map((p) => (
                <li key={p.key} className="text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{p.label}</span>
                    <span className="tabular-nums text-muted-foreground">{p.points}/{p.max}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#FF5A00]" style={{ width: `${(p.points / p.max) * 100}%` }} /></div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{p.reason}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-start gap-1 text-[10.5px] leading-snug text-muted-foreground"><Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />Scored by fixed rules from what the supplier lists and your search. Nothing is paid for or estimated.</p>
          </section>
        )}

        <section>
          <h3 className="text-[13px] font-black">Products {loading && <span className="text-[11px] font-normal text-muted-foreground">loading…</span>}</h3>
          <ul className="mt-2 space-y-2">
            {products.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-xl border border-border p-2">
                {p.image ? <img src={p.image} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg bg-muted object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.moq != null ? `MOQ ${inr(Number(p.moq), s.country)} ${p.moq_unit ?? ''}` : 'MOQ on request'}
                    {priceText(p) ? ` · ${priceText(p)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => onQuote(p)} className="min-h-[32px] shrink-0 rounded-lg border border-[#FF5A00]/50 px-2.5 text-[11.5px] font-bold text-[#E04E00] hover:bg-[#FF5A00] hover:text-white dark:text-[#FF8A3D]">
                  Quote
                </button>
              </li>
            ))}
          </ul>
        </section>

        {detail?.description && <p className="line-clamp-4 text-[12.5px] leading-relaxed text-muted-foreground">{detail.description}</p>}
        {detail?.factory_address && (
          <p className="flex items-start gap-1.5 text-[12px]"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />{detail.factory_address}</p>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-[1fr_auto_auto] gap-2 border-t border-border bg-card p-3">
        <button type="button" onClick={() => onQuote()} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#FF5A00] px-3 text-[13.5px] font-black text-white hover:bg-[#E04E00]">
          <Send className="h-4 w-4" aria-hidden="true" /> Request Quotation
        </button>
        <Link to={`/manufacturers/${s.slug}`} className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-border px-3 text-[12.5px] font-bold hover:border-[#FF5A00] hover:text-[#FF5A00]">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Factory profile
        </Link>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`} target="_blank" rel="noopener noreferrer" aria-label="Directions to the factory"
          className="inline-flex min-h-[44px] w-11 items-center justify-center rounded-xl border border-border hover:border-[#FF5A00] hover:text-[#FF5A00]">
          <Navigation className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, sub, tone }: { icon: typeof MapPin; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5">
      <dt className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3 w-3" aria-hidden="true" />{label}</dt>
      <dd className={cn('mt-0.5 text-[13px] font-black', tone)}>{value}</dd>
      {sub && <dd className="text-[11px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}
