import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, FileText, FlaskConical, Globe, Plug, Search } from 'lucide-react';
import heroArt from '@/assets/desktop-home/hero-art-2x.webp';
import promoArt from '@/assets/desktop-home/promo-art-2x.webp';
import machineryIcon from '@/assets/mobile-home/cat-machinery.webp';
import packagingIcon from '@/assets/mobile-home/cat-packaging.webp';
import textileIcon from '@/assets/mobile-home/cat-textile.webp';
import { CheckBadge, FEATURES, Laurel, MoreIcon, PROMO_POINTS, STATS, type HomeSearchType } from '../shared/parts';
import './desktop-home.css';

interface DesktopHomeHeroProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedType: HomeSearchType;
  onSelectedTypeChange: (value: HomeSearchType) => void;
  onSubmit: (e: React.FormEvent) => void;
  popular: Array<{ name: string; query: string }>;
  onQuickTag: (query: string) => void;
}

/** The six squares under the header: the same six as on the phone, with the same links. */
const CATEGORY_TILES: Array<{ label: string; href: string; image?: string; icon?: React.ReactNode }> = [
  { label: 'Machinery', href: '/products?q=machinery', image: machineryIcon },
  { label: 'Packaging', href: '/products?q=packaging', image: packagingIcon },
  { label: 'Electrical', href: '/products?q=electrical', icon: <Plug /> },
  { label: 'Textile', href: '/products?q=textile', image: textileIcon },
  { label: 'Chemicals', href: '/products?q=chemicals', icon: <FlaskConical /> },
  { label: 'More', href: '/products', icon: <MoreIcon /> },
];

/**
 * The home page top section on screens 768px wide and up: the phone design (same colours, shapes, text and links)
 * laid out for a wide screen.
 */
export default function DesktopHomeHero({
  searchQuery,
  onSearchQueryChange,
  selectedType,
  onSelectedTypeChange,
  onSubmit,
  popular,
  onQuickTag,
}: DesktopHomeHeroProps) {
  return (
    <div className="dh-dark">
      <nav className="dh-cats" aria-label="Product categories">
        <ul className="dh-wrap">
          {CATEGORY_TILES.map((tile) => (
            <li key={tile.label}>
              <Link to={tile.href} className="dh-cat">
                <span className="dh-cat-icon">{tile.image ? <img src={tile.image} alt="" /> : tile.icon}</span>
                {tile.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="dh-hero" aria-label="BulkSkart">
        <div className="dh-wrap dh-hero-grid">
          <div className="dh-hero-copy">
            <div className="dh-badge-row">
              <Laurel className="dh-laurel" />
              <Globe className="dh-badge-globe" strokeWidth={2} aria-hidden="true" />
              <span className="dh-badge-text">Global B2B Marketplace</span>
              <Laurel flip className="dh-laurel" />
            </div>

            <h1 className="dh-h1">
              <span className="dh-h1-1">Buy in Bulk.</span>
              <span className="dh-h1-2">Grow Bigger.</span>
            </h1>

            <svg className="dh-swoosh" viewBox="0 0 168 20" aria-hidden="true" preserveAspectRatio="none">
              <defs>
                <linearGradient id="dh-swoosh-g" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#ff8a14" />
                  <stop offset="1" stopColor="#ffb84d" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path d="M2 14 C 46 1, 118 0, 166 7 C 120 5, 52 8, 2 14 Z" fill="url(#dh-swoosh-g)" />
            </svg>

            <p className="dh-sub">Connect with verified manufacturers, suppliers and bulk buyers worldwide.</p>

            <div className="dh-feats">
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
                  <a key={top} className="dh-feat" href={href}>
                    {body}
                  </a>
                ) : (
                  <div key={top} className="dh-feat">
                    {body}
                  </div>
                );
              })}
            </div>

            <div className="dh-ctas">
              <Link to="/products" className="dh-cta dh-cta-1">
                Explore Marketplace
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/post-requirement" className="dh-cta dh-cta-2">
                <FileText aria-hidden="true" />
                Post a Requirement
              </Link>
            </div>
          </div>

          <div className="dh-hero-art" aria-hidden="true">
            <img src={heroArt} alt="" width={800} height={596} decoding="async" />
          </div>
        </div>

        <div className="dh-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className="dh-panel" aria-label="Find products and suppliers">
        <div className="dh-wrap dh-panel-grid">
          <div className="dh-panel-main">
            <h2 className="dh-panel-title">
              Find <span>Products &amp; Suppliers</span>
            </h2>
            <p className="dh-panel-sub">Search verified catalogues, manufacturers and live RFQs.</p>

            <form className="dh-find" onSubmit={onSubmit} role="search">
              <div className="dh-find-select">
                <select
                  value={selectedType}
                  onChange={(e) => onSelectedTypeChange(e.target.value as HomeSearchType)}
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

            <div className="dh-popular">
              <span>Popular Searches:</span>
              <div className="dh-popular-list">
                {popular.map((cat) => (
                  <button key={cat.name} type="button" className="dh-pop" onClick={() => onQuickTag(cat.query)}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="dh-stats">
            {STATS.map(({ icon: Icon, value, label, tone }) => (
              <div key={label} className={`dh-stat dh-stat-${tone}`}>
                <span className="dh-stat-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="dh-stat-text">
                  <b>{value}</b>
                  <span>{label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="dh-promo-band">
        <div className="dh-wrap">
          <Link to="/post-requirement" className="dh-promo" aria-label="Post a requirement and get bulk quotations">
            <div className="dh-promo-art" aria-hidden="true">
              <img src={promoArt} alt="" width={748} height={424} loading="lazy" decoding="async" />
            </div>
            <div className="dh-promo-body">
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
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
