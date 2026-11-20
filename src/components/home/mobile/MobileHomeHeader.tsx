import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Globe, ChevronDown, Check, Plug, FlaskConical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationBell from '@/components/common/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useCountry } from '@/contexts/CurrencyContext';
import { BULKSKART_LOGO_DARK } from '@/constants/branding';
import { MoreIcon } from '../shared/parts';
import machineryIcon from '@/assets/mobile-home/cat-machinery.webp';
import packagingIcon from '@/assets/mobile-home/cat-packaging.webp';
import textileIcon from '@/assets/mobile-home/cat-textile.webp';
import './mobile-home.css';

interface MobileHomeHeaderProps {
  /** Where the round account button goes (the buyer or supplier dashboard). */
  dashboardHref: string;
  /** Opens the same slide-in menu the old mobile header opened. */
  onMenu: () => void;
}

const CHIPS: Array<{ label: string; href: string; width: number; image?: string; icon?: React.ReactNode }> = [
  { label: 'Machinery', href: '/products?q=machinery', width: 128, image: machineryIcon },
  { label: 'Packaging', href: '/products?q=packaging', width: 122, image: packagingIcon },
  { label: 'Electrical', href: '/products?q=electrical', width: 120, icon: <Plug /> },
  { label: 'Textile', href: '/products?q=textile', width: 121, image: textileIcon },
  { label: 'Chemicals', href: '/products?q=chemicals', width: 121, icon: <FlaskConical /> },
  { label: 'More', href: '/products', width: 85, icon: <MoreIcon /> },
];

export default function MobileHomeHeader({ dashboardHref, onMenu }: MobileHomeHeaderProps) {
  const { user, profile, displayName } = useAuth();
  const { countryConfig, setCountry, availableCountries, autoDetectedSource } = useCountry();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  const initial = (displayName || profile?.full_name || user?.email || 'U')[0]?.toUpperCase() ?? 'U';

  return (
    <div className="mh-header">
      <div className="mh-row">
        <Link to="/" className="mh-logo" aria-label="BulkSkart Homepage">
          <img src={BULKSKART_LOGO_DARK} alt="BulkSkart - Global B2B Marketplace" />
        </Link>

        <div className="mh-right">
          {/* The site has no language switch; this is its region menu (country, currency and tax). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="mh-lang" aria-label="Select region, currency and language">
                <Globe strokeWidth={1.6} aria-hidden="true" />
                <span>{(countryConfig.primaryLang || 'en').toUpperCase()}</span>
                <ChevronDown className="mh-lang-chev" strokeWidth={2.2} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover border-border max-h-80 overflow-y-auto">
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Region, Currency & Tax</span>
                  {autoDetectedSource === 'login' ? (
                    <span className="text-[10px] text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10">Login Synced</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Auto-detected</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Current: {countryConfig.name} ({countryConfig.taxLabel})
                </p>
              </div>
              {availableCountries.map((c) => (
                <DropdownMenuItem
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  className={`text-xs gap-2.5 py-2 cursor-pointer ${c.code === countryConfig.code ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                >
                  <span className="text-base">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="font-mono text-xs">{c.symbol} {c.currency}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span>{c.taxLabel}</span>
                      <span>·</span>
                      <span>Fee: {(c.feePercent * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  {c.code === countryConfig.code && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user && profile ? (
            <>
              <NotificationBell variant="mobileHome" />
              <Link to={dashboardHref} className="mh-avatar" aria-label="My account">
                {initial}
              </Link>
            </>
          ) : (
            <Link to="/auth" className="mh-signin">
              Sign In
            </Link>
          )}

          <button type="button" className="mh-burger" onClick={onMenu} aria-label="Open navigation menu">
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <form className="mh-search" onSubmit={submitSearch} role="search">
        <Search aria-hidden="true" strokeWidth={1.8} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products, suppliers, categories..."
          aria-label="Search products, suppliers, categories"
        />
        <button type="submit" aria-label="Search">
          Search
        </button>
      </form>

      <nav className="mh-chips" aria-label="Product categories">
        {CHIPS.map((chip) => (
          <Link key={chip.label} to={chip.href} className="mh-chip" style={{ width: `calc(${chip.width} * var(--mh-u))` }}>
            <span className="mh-chip-icon">
              {chip.image ? <img src={chip.image} alt="" /> : chip.icon}
            </span>
            {chip.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
