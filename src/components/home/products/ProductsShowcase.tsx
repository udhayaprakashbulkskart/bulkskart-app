import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Armchair,
  Box,
  Building2,
  Car,
  CheckCircle2,
  ChevronDown,
  Cpu,
  HardHat,
  Heart,
  House,
  Layers,
  LayoutGrid,
  Loader2,
  Package,
  PackageCheck,
  ShoppingCart,
  Shirt,
  Sparkles,
  Sun,
  Truck,
  Wheat,
  Zap,
} from 'lucide-react';
import SafeImage from '@/components/common/SafeImage';
import { Laurel } from '../shared/parts';
import { Flag } from '../suppliers/flags';
import { optimizeCatalogUrl } from '../suppliers/images';
import type { MoqParts } from './format';
import './products-showcase.css';

/** What one card needs. The section's own product type has all of this and more. */
export interface ShowcaseProduct {
  id: string;
  name: string;
  /** Where the picture and the name lead. */
  href: string;
  img: string;
  categoryName?: string;
  /** The price already written for the visitor's currency, for example "₹13,77,750". */
  price: string;
  /** The longer price text shown as a tooltip (a range, for example). */
  priceTitle?: string;
  /** What the price is per, for example "Piece". */
  priceUnit: string;
  moq: MoqParts;
  supplier: string;
  verified: boolean;
  country: string;
  /** The emoji flag, used only when there is no drawn flag for the country. */
  flag: string;
}

export interface ShowcaseCategory {
  id: string;
  label: string;
}

export type ShowcaseStatus = 'loading' | 'error' | 'empty' | 'ready';

interface ProductsShowcaseProps<T extends ShowcaseProduct> {
  products: T[];
  status: ShowcaseStatus;
  error: string | null;
  onRetry: () => void;
  onClearFilters: () => void;
  categories: ShowcaseCategory[];
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  /** The search box and the filter buttons; the section owns their state. */
  toolbar: React.ReactNode;
  favourites: ReadonlySet<string>;
  onToggleFavourite: (product: T) => void;
  onBuy: (product: T) => void;
  isRotating: boolean;
  /** Changes whenever a new batch of cards is shown, so the cards fade in again. */
  batchKey: string | number;
  shown: number;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/** A shield with a tick, as wide as the one in the design (the library's is narrower). */
function StripShield() {
  return (
    <svg viewBox="0 0 52 58" fill="none" stroke="currentColor" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M26 4C20 9 12 11 4 11v17c0 14 10 23 22 27 12-4 22-13 22-27V11C40 11 32 9 26 4Z" />
      <path d="m15.5 29.5 8 8 14-16" />
    </svg>
  );
}

/** The four points in the strip, as printed in the design. */
const POINTS: Array<{ icon: React.ComponentType; top: string; bottom: string; green?: boolean }> = [
  { icon: StripShield, top: 'Verified', bottom: 'Manufacturers' },
  { icon: Box, top: 'Bulk', bottom: 'Pricing' },
  { icon: Layers, top: 'MOQ', bottom: 'Min. 10 Pieces' },
  { icon: Truck, top: 'Free', bottom: 'Delivery', green: true },
];

/** Crossed tools: the mark for machinery. */
function ToolsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="matrix(-1 0 0 1 24 0)">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
      </g>
      <path d="M21 3 11.5 12.5" />
      <path d="m18.6 5.4-2-2" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, React.ComponentType> = {
  all: LayoutGrid,
  machinery: ToolsIcon,
  electronics: Cpu,
  apparel: Shirt,
  'home-garden': House,
  beauty: Sparkles,
  furniture: Armchair,
  construction: HardHat,
  automotive: Car,
  agriculture: Wheat,
  packaging: Package,
  electrical: Zap,
  'renewable-energy': Sun,
  'raw-materials': Layers,
};

/** A shield with a tick: the mark beside the section title. */
function TitleShield() {
  return (
    <svg className="pv-shield" viewBox="0 0 80 79" aria-hidden="true">
      <defs>
        <linearGradient id="pv-shield-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffa233" />
          <stop offset="1" stopColor="#f26a05" />
        </linearGradient>
        <linearGradient id="pv-shield-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e1507" />
          <stop offset="1" stopColor="#170b05" />
        </linearGradient>
      </defs>
      <path
        d="M40 5C30 11 18 13 6 13v26c0 17 14 29 34 36 20-7 34-19 34-36V13C62 13 50 11 40 5Z"
        fill="url(#pv-shield-fill)"
        stroke="url(#pv-shield-edge)"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path d="M24 41l12 12 22-24" fill="none" stroke="#ff9a2b" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A truck with speed lines behind it. */
function FastTruck() {
  return (
    <svg viewBox="0 0 69 33" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6.5h11M2 15h17M9 23.5h10" />
      <path d="M22 2.5h25v22.5H22z" />
      <path d="M47 7h9l9.5 11.5V25H47" />
      <path d="M52 11.5h3.2l5 6.3H52z" strokeWidth="2.6" />
      <circle cx="31" cy="27" r="3.4" />
      <circle cx="57" cy="27" r="3.4" />
    </svg>
  );
}

/** The green circle with a tick that starts the "Verified Product" badge. */
function VerifiedDot() {
  return (
    <svg viewBox="0 0 38 38" aria-hidden="true">
      <circle cx="19" cy="19" r="19" fill="#05d046" />
      <path d="M10.5 19.5l6.2 6.3L28 13.2" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The orange seal with a tick next to the supplier's name. */
function Seal() {
  return (
    <svg className="pv-seal" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        fill="#fa8c04"
        stroke="#fa8c04"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="m8.6 12.2 2.4 2.4 4.6-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardPhoto({ product }: { product: ShowcaseProduct }) {
  // the picture is asked for at the shape it is shown in, so the card never loads more than it needs
  const src = useMemo(() => optimizeCatalogUrl(product.img, 450, 238), [product.img]);
  return (
    <SafeImage
      src={src}
      alt={product.name}
      productId={product.id}
      category={product.categoryName}
      isDuplicateOnPage={false}
      isRepresentativeImage
      className="pv-photo"
      sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 280px"
      // without a srcset the picture can still fall back to another one when it fails to load
      srcSet={undefined}
      width={450}
      height={238}
      // the section is below the first screen, so its pictures never compete with the ones on top
      {...({ fetchpriority: 'low' } as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="pv-card is-skeleton" aria-hidden="true">
          <div className="pv-media" />
          <div className="pv-body">
            <div className="pv-bar" style={{ width: '80%' }} />
            <div className="pv-bar" style={{ width: '55%' }} />
            <div className="pv-bar" style={{ width: '70%' }} />
          </div>
        </div>
      ))}
    </>
  );
}

export default function ProductsShowcase<T extends ShowcaseProduct>({
  products,
  status,
  error,
  onRetry,
  onClearFilters,
  categories,
  selectedCategory,
  onCategoryChange,
  toolbar,
  favourites,
  onToggleFavourite,
  onBuy,
  isRotating,
  batchKey,
  shown,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: ProductsShowcaseProps<T>) {
  return (
    <section className="pv" aria-labelledby="pv-title">
      <div className="pv-wrap">
        <header className="pv-head">
          <div className="pv-title-block">
            <Laurel className="pv-laurel" idPrefix="pv-laurel" />
            <TitleShield />
            <h2 id="pv-title">
              Verified <span>Bulk Products</span>
            </h2>
            <Laurel flip className="pv-laurel" idPrefix="pv-laurel" />
          </div>
          <p className="pv-sub">
            <span>100% Verified Manufacturers</span>
            <i aria-hidden="true">•</i>
            <span>Wholesale Only</span>
            <i aria-hidden="true">•</i>
            <span>Min. Order 10 Pieces</span>
            <i aria-hidden="true">•</i>
            <span className="pv-free">
              <FastTruck />
              Free Delivery
            </span>
          </p>
        </header>

        <ul className="pv-stats" aria-label="Bulk buying at a glance">
          {POINTS.map(({ icon: Icon, top, bottom, green }) => (
            <li key={top} className={green ? 'is-green' : undefined}>
              <Icon aria-hidden="true" />
              <span>
                <b>{top}</b>
                <span>{bottom}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="pv-chips" role="group" aria-label="Filter products by category">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] ?? Package;
            const selected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`pv-chip${category.id === 'all' ? ' pv-chip-all' : ''}${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onCategoryChange(category.id)}
              >
                <Icon aria-hidden="true" />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pv-tools">{toolbar}</div>

        {status === 'error' && (
          <div className="pv-empty" role="alert">
            <AlertCircle aria-hidden="true" />
            <h3>Catalog Connection Error</h3>
            <p>{error}</p>
            <button type="button" onClick={onRetry}>
              Retry Loading Catalog
            </button>
          </div>
        )}

        {status === 'empty' && (
          <div className="pv-empty">
            <PackageCheck aria-hidden="true" />
            <h3>No products match your criteria</h3>
            <p>Try adjusting your keyword, expanding price or MOQ thresholds, or switching category tabs.</p>
            <button type="button" onClick={onClearFilters}>
              Clear All Filters
            </button>
          </div>
        )}

        {(status === 'loading' || status === 'ready') && (
          <div className={`pv-grid${isRotating ? ' is-rotating' : ''}`} aria-busy={status === 'loading' ? true : undefined}>
            {status === 'loading' ? (
              <Skeleton />
            ) : (
              products.map((product) => {
                const isFavourite = favourites.has(product.id);
                const buyLabel = product.moq.qty ? `Buy in Bulk (Min. ${product.moq.text})` : 'Buy in Bulk';
                return (
                  <article key={`${product.id}-${batchKey}`} className="pv-card" aria-label={product.name}>
                    <div className="pv-media">
                      <CardPhoto product={product} />
                      <Link className="pv-media-hit" to={product.href} aria-label={`View ${product.name}`} tabIndex={-1} />
                      {product.verified && (
                        <span className="pv-badge">
                          <VerifiedDot />
                          Verified Product
                        </span>
                      )}
                      <button
                        type="button"
                        className={`pv-heart${isFavourite ? ' is-on' : ''}`}
                        aria-pressed={isFavourite}
                        aria-label={isFavourite ? `Remove ${product.name} from your wishlist` : `Save ${product.name} to your wishlist`}
                        onClick={() => onToggleFavourite(product)}
                      >
                        <Heart aria-hidden="true" />
                      </button>
                    </div>

                    <div className="pv-body">
                      <h3 className="pv-name" title={product.name}>
                        <Link to={product.href}>{product.name}</Link>
                      </h3>

                      <p className="pv-price" title={product.priceTitle}>
                        <b>{product.price}</b>
                        <span>/ {product.priceUnit}</span>
                      </p>

                      <p className="pv-moq">
                        <Box aria-hidden="true" />
                        <span>
                          Minimum Order: <b>{product.moq.text}</b>
                        </span>
                      </p>

                      <p className="pv-deliver">
                        <FastTruck />
                        <span>Free Delivery</span>
                      </p>

                      <div className="pv-seller">
                        <Building2 aria-hidden="true" />
                        <span className="pv-seller-name" title={product.supplier}>
                          {product.supplier}
                        </span>
                        {product.verified && <Seal />}
                        <span className="pv-sep" aria-hidden="true" />
                        <span className="pv-origin">
                          <Flag country={product.country} fallback={product.flag} className="pv-flag" />
                          <span>{product.country}</span>
                        </span>
                      </div>

                      <button type="button" className="pv-buy" onClick={() => onBuy(product)}>
                        <ShoppingCart aria-hidden="true" />
                        <span>{buyLabel}</span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {status === 'ready' && (
          <div className="pv-foot">
            <p className="pv-count">
              Showing <b>{shown}</b> of <b>{total.toLocaleString('en-US')}+</b> wholesale products
            </p>
            {hasMore ? (
              <button type="button" className="pv-more" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="is-spinning" aria-hidden="true" />
                    <span>Loading Catalog Products...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Products</span>
                    <ChevronDown aria-hidden="true" />
                  </>
                )}
              </button>
            ) : (
              <p className="pv-end">
                <CheckCircle2 aria-hidden="true" />
                <span>You've reached the end of the filtered catalog. Explore more in the complete Products Directory.</span>
              </p>
            )}
            <Link to="/products" className="pv-all">
              <span>View All Products</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
