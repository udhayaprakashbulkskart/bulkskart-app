import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, FileText, Globe, Search } from 'lucide-react';
import heroArt from '@/assets/mobile-home/hero-art.webp';
import promoArt from '@/assets/mobile-home/promo-art.webp';
import { CheckBadge, FEATURES, Laurel, PROMO_POINTS, STATS, type HomeSearchType } from '../shared/parts';
import './mobile-home.css';

export type MobileSearchType = HomeSearchType;

interface MobileHomeHeroProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedType: MobileSearchType;
  onSelectedTypeChange: (value: MobileSearchType) => void;
  onSubmit: (e: React.FormEvent) => void;
  popular: Array<{ name: string; query: string }>;
  onQuickTag: (query: string) => void;
}

/** Widths of the popular-search chips in the design (reference pixels). */
const POP_WIDTH: Record<string, number> = {
  Textile: 105, Steel: 87, Chemical: 128, Plastic: 107, Machinery: 124, Agriculture: 131, Packaging: 123, Electrical: 116,
};

export default function MobileHomeHero({
  searchQuery,
  onSearchQueryChange,
  selectedType,
  onSelectedTypeChange,
  onSubmit,
  popular,
  onQuickTag,
}: MobileHomeHeroProps) {
  return (
    <div className="mh-dark">
      <section className="mh-hero" aria-label="BulkSkart">
        <div className="mh-hero-art" aria-hidden="true">
          <img src={heroArt} alt="" width={400} height={298} decoding="async" />
        </div>

        <div className="mh-badge-row">
          <Laurel className="mh-laurel" />
          <Globe className="mh-badge-globe" strokeWidth={2} aria-hidden="true" />
          <span className="mh-badge-text">Global B2B Marketplace</span>
          <Laurel flip className="mh-laurel" />
        </div>

        <h1 className="mh-h1">
          <span className="mh-h1-1">Buy in Bulk.</span>
          <span className="mh-h1-2">Grow Bigger.</span>
        </h1>

        <svg className="mh-swoosh" viewBox="0 0 168 20" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mh-swoosh-g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff8a14" />
              <stop offset="1" stopColor="#ffb84d" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path d="M2 14 C 46 1, 118 0, 166 7 C 120 5, 52 8, 2 14 Z" fill="url(#mh-swoosh-g)" />
        </svg>

        <p className="mh-sub">Connect with verified manufacturers, suppliers and bulk buyers worldwide.</p>

        <div className="mh-feats">
          {FEATURES.map(({ icon: Icon, top, bottom, href }) => {
            const body = (
              <>
                <Icon aria-hidden="true" />
                <span>
                  <b>{top}</b>
                  <small>{bottom}</small>
                </span>
              </>
            );
            return href ? (
              <a key={top} className="mh-feat" href={href}>
                {body}
              </a>
            ) : (
              <div key={top} className="mh-feat">
                {body}
              </div>
            );
          })}
        </div>

        <Link to="/products" className="mh-cta mh-cta-1">
          Explore Marketplace
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link to="/post-requirement" className="mh-cta mh-cta-2">
          <FileText aria-hidden="true" />
          Post a Requirement
        </Link>

        <div className="mh-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className="mh-panel" aria-label="Find products and suppliers">
        <h2 className="mh-panel-title">
          Find <span>Products &amp; Suppliers</span>
        </h2>
        <p className="mh-panel-sub">Search verified catalogues, manufacturers and live RFQs.</p>

        <form className="mh-find" onSubmit={onSubmit} role="search">
          <div className="mh-find-select">
            <select
              value={selectedType}
              onChange={(e) => onSelectedTypeChange(e.target.value as MobileSearchType)}
              aria-label="What to search"
            >
              <option value="products">Products</option>
              <option value="manufacturers">Manufacturers</option>
              <option value="rfqs">Live RFQs</option>
            </select>
            <ChevronDown aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search products, suppliers..."
            aria-label="Search products, suppliers"
          />
          <button type="submit" aria-label="Submit search">
            <Search aria-hidden="true" />
          </button>
        </form>

        <div className="mh-popular">
          <span>Popular Searches:</span>
          <div className="mh-popular-list">
            {[popular.slice(0, 4), popular.slice(4)].map((row, i) => (
              <div key={i} className="mh-popular-row">
                {row.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    className="mh-pop"
                    style={POP_WIDTH[cat.name] ? { width: `calc(${POP_WIDTH[cat.name]} * var(--mh-u))` } : undefined}
                    onClick={() => onQuickTag(cat.query)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mh-divider" />

        <div className="mh-stats">
          {STATS.map(({ icon: Icon, value, label, tone }) => (
            <div key={label} className={`mh-stat mh-stat-${tone}`}>
              <span className="mh-stat-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="mh-stat-text">
                <b>{value}</b>
                <span>{label}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <Link to="/post-requirement" className="mh-promo" aria-label="Post a requirement and get bulk quotations">
        <div className="mh-promo-art" aria-hidden="true">
          <img src={promoArt} alt="" width={374} height={212} loading="lazy" decoding="async" />
        </div>
        <h2>
          Get Bulk Quotations
          <br />
          from <em>Verified Manufacturers</em>
        </h2>
        <ul>
          {PROMO_POINTS.map((text) => (
            <li key={text}>
              <CheckBadge />
              {text}
            </li>
          ))}
        </ul>
      </Link>
    </div>
  );
}
