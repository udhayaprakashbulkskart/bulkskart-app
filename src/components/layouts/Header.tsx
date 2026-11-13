import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrency, useCountry } from '@/contexts/CurrencyContext';
import { usePrefetch } from '@/hooks/usePrefetch';
import NotificationBell from '@/components/common/NotificationBell';
import CopyPublicProfileButton from '@/components/common/CopyPublicProfileButton';
import { toast } from 'sonner';
import {
  Menu, Bell, ChevronDown, LogOut, User, LayoutDashboard,
  Globe, ChevronRight, Search, Moon, Sun, DollarSign, Zap, Check,
  Settings, Shirt, Package, Beaker, AlertCircle, Sparkles, LogIn, UserPlus
} from 'lucide-react';

// Mobile category chips shown below the search row
const MOBILE_CATS = [
  { label: 'Machinery',   icon: Settings,  href: '/products?q=machinery' },
  { label: 'Packaging',   icon: Package,   href: '/products?q=packaging' },
  { label: 'Electrical',  icon: Zap,       href: '/products?q=electrical' },
  { label: 'Textile',     icon: Shirt,     href: '/products?q=textile' },
  { label: 'Chemicals',   icon: Beaker,    href: '/products?q=chemicals' },
];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

const navLinks = [
  { label: 'Products', href: '/products' },
  { label: 'Live Auctions', href: '/auctions' },
  { label: 'Reverse RFQs', href: '/requirements' },
  { label: 'AI Import & Export Assistant', href: '/trade-assistant' },
  { label: 'My Quotations', href: '/my-quotations' },
  { label: 'Suppliers', href: '/manufacturers' },
  { label: 'Post RFQ', href: '/post-requirement' },
  { label: 'Trade Assurance', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
];

import BrandLogo from '@/components/common/BrandLogo';

function LogoMark({ className }: { className?: string }) {
  return <BrandLogo size="responsive" linkTo={null} className={className} />;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'د.إ',
  JPY: '¥', CNY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$',
};

export default function Header() {
  const { user, profile, signOut, loading, resolvedRole, displayName, dashboardPath } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    countryConfig,
    setCountry,
    availableCountries,
    autoDetectedSource,
    currencyInfo,
  } = useCountry();
  const { getPrefetchHandlers } = usePrefetch();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  const getNotifLink = () => {
    if (!user) return '/auth';
    if (resolvedRole === 'supplier' || profile?.role === 'supplier') return '/dashboard/supplier/notifications';
    if (resolvedRole === 'buyer' || profile?.role === 'buyer') return '/dashboard/buyer/notifications';
    return dashboardPath !== '/auth' ? `${dashboardPath}/notifications` : '/auth';
  };

  // Show "View Plans" only after user scrolls past hero (~420px) and only in dark mode
  const [pastHero, setPastHero] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 420);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Only visible: dark mode AND scrolled past hero AND on homepage
  const showViewPlans = theme === 'dark' && pastHero && location.pathname === '/';

  const handleSignOut = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      setUserMenuOpen(false);
      setMobileOpen(false);
      await signOut();
      toast.success('Signed out successfully');
      if (location.pathname !== '/') {
        navigate('/');
      }
    } catch (err) {
      console.error('Sign out error:', err);
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };
  const getDashboardLink = () => {
    if (!user) return '/auth';
    if (loading) return dashboardPath !== '/auth' ? dashboardPath : '/auth';
    if (dashboardPath && dashboardPath !== '/auth') return dashboardPath;
    if (!profile && !resolvedRole) return '/auth';
    if (resolvedRole === 'admin' || profile?.role === 'admin') return '/dashboard/admin';
    if (resolvedRole === 'supplier' || profile?.role === 'supplier') return '/dashboard/supplier';
    return '/dashboard/buyer';
  };
  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="bs-header z-40 w-full border-b border-border/80 bg-background/80 shadow-[0_10px_40px_-28px_hsl(21_100%_40%/0.8)] backdrop-blur-xl transition-colors">
      {/* ── Main row ── */}
      <div className="max-w-[1400px] mx-auto px-2.5 sm:px-4 lg:px-6 min-h-[56px] py-2 flex items-center gap-1 sm:gap-2 lg:gap-4 justify-between lg:justify-start">

        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0 group py-1 min-w-0" aria-label="BulkSkart Homepage">
          <LogoMark />
        </Link>

        {/* Search bar — desktop */}
        <form onSubmit={handleSearch} className="hidden lg:flex flex-1 min-w-[140px] max-w-[420px] xl:max-w-[500px] items-center bg-muted/80 border border-border rounded-xl h-10 px-3 gap-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/25 transition-all">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products, suppliers, categories…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          <Button type="submit" size="sm" className="h-7 px-3 text-[12px] bg-primary text-white rounded-md shrink-0">
            Search
          </Button>
        </form>

        {/* ── Mobile: icon row (right side of logo) ── */}
        <div className="lg:hidden flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <CopyPublicProfileButton compact />
          <NotificationBell />
          {user && profile ? (
            <Link to={getDashboardLink()} className="w-7 h-7 rounded-full bg-[#FF5A00] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(displayName || profile?.full_name || 'U')[0]?.toUpperCase() ?? 'U'}
            </Link>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="h-7 px-2 min-[360px]:px-2.5 text-[10.5px] min-[360px]:text-[11px] font-bold bg-[#FF5A00] hover:bg-[#e04e00] text-white rounded shadow-[0_2px_0_#922f00] whitespace-nowrap">Sign In</Button>
            </Link>
          )}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground h-8 w-8 shrink-0" aria-label="Open navigation menu">
                <Menu className="w-4.5 h-4.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(300px,85vw)] max-w-[calc(100%-2rem)] bg-background border-border p-0 z-50 overflow-hidden flex flex-col">
              <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                  <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center min-w-0" aria-label="BulkSkart Homepage">
                    <LogoMark />
                  </Link>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-3 py-3 border-b border-border w-full box-border shrink-0">
                  <div className="flex flex-1 min-w-0 items-center bg-muted border border-border rounded-lg h-9 px-2.5 gap-2 focus-within:border-primary/60">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search products, suppliers…"
                      className="flex-1 min-w-0 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
                    />
                  </div>
                  <Button type="submit" size="sm" aria-label="Search products and suppliers" className="h-9 px-3 bg-primary text-white shrink-0">
                    <Search className="w-4 h-4" />
                  </Button>
                </form>
                <div className="flex flex-col gap-2 px-4 py-3 border-b border-border">
                  {/* Country, Currency & Tax Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" aria-label="Select Region and Currency" className="h-9 w-full gap-2 text-xs font-semibold justify-between">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="text-base">{countryConfig.flag}</span>
                          <span className="truncate">{countryConfig.name}</span>
                          <span className="text-muted-foreground font-mono">({countryConfig.currency})</span>
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold shrink-0">
                          {countryConfig.taxLabel}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 bg-popover border-border max-h-72 overflow-y-auto">
                      <div className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground border-b border-border flex items-center justify-between">
                        <span>Select Region & Currency</span>
                        {autoDetectedSource === 'login' && (
                          <span className="text-[10px] text-primary">Login Synced</span>
                        )}
                      </div>
                      {availableCountries.map(c => (
                        <DropdownMenuItem key={c.code} onClick={() => setCountry(c.code)}
                          className={`text-xs gap-2 py-2 cursor-pointer ${c.code === countryConfig.code ? 'bg-primary/10 text-primary font-bold' : ''}`}>
                          <span className="text-base">{c.flag}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="truncate">{c.name}</span>
                              <span className="text-[11px] font-mono font-bold">{c.symbol} {c.currency}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span>Tax: {c.taxLabel}</span> · <span>Fee: {(c.feePercent * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                          {c.code === countryConfig.code && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={toggleTheme} className="h-8 w-full gap-1.5 text-xs font-semibold justify-center">
                      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 shrink-0" /> : <Moon className="w-3.5 h-3.5 shrink-0" />}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </Button>
                  </div>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {navLinks.map(link => {
                    const isAiAssistant = link.href === '/trade-assistant';
                    return (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setMobileOpen(false)}
                        {...getPrefetchHandlers(link.href)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-12 ${
                          isActive(link.href)
                            ? 'bg-primary/10 text-primary font-bold'
                            : isAiAssistant
                            ? 'text-[#FF5A00] bg-[#FF5A00]/10 hover:bg-[#FF5A00]/20 font-semibold'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {isAiAssistant && <Sparkles className="w-4 h-4 text-[#FF5A00] shrink-0" />}
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                  {user && (
                    <>
                      <div className="h-px bg-border my-2" />
                      <div className="px-3 py-2 bg-muted/40 rounded-lg mb-1 border border-border">
                        <p className="text-xs font-semibold text-foreground truncate">{displayName || profile?.full_name || 'My Account'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary uppercase">
                          {resolvedRole === 'supplier' || profile?.role === 'supplier' ? 'Supplier' : resolvedRole === 'admin' ? 'Admin' : 'Buyer'}
                        </span>
                      </div>
                      <Link to={getDashboardLink()} onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-muted min-h-12">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link to={(resolvedRole === 'supplier' || profile?.role === 'supplier') ? '/dashboard/supplier/profile' : '/dashboard/buyer/profile'} onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-muted min-h-12">
                        <User className="w-4 h-4" /> Profile & Settings
                      </Link>
                      <div className="px-1 py-1">
                        <CopyPublicProfileButton />
                      </div>
                      <Link to="/settings/delete-account" onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 min-h-12">
                        <AlertCircle className="w-4 h-4" /> Delete Account
                      </Link>
                    </>
                  )}
                </nav>
                <div className="p-4 border-t border-border bg-card/60 space-y-3">
                  {user ? (
                    <Button onClick={() => { handleSignOut(); setMobileOpen(false); }} variant="outline"
                      className="w-full justify-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 font-bold min-h-12 rounded-xl">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                        Account Access
                      </div>
                      
                      {/* Sign In for existing users */}
                      <Link to="/login" onClick={() => setMobileOpen(false)} className="block w-full">
                        <Button
                          variant="secondary"
                          className="w-full bg-muted/80 hover:bg-muted border border-border text-foreground hover:text-foreground font-bold h-12 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99]"
                        >
                          <LogIn className="w-4 h-4 text-[#FF5A00] shrink-0" />
                          <span>Sign In</span>
                          <span className="text-[11px] font-normal text-muted-foreground ml-auto hidden min-[360px]:inline">Existing user</span>
                        </Button>
                      </Link>

                      {/* Create Free Account for new users */}
                      <Link to="/register" onClick={() => setMobileOpen(false)} className="block w-full">
                        <Button
                          className="w-full bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold h-12 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_2px_0_#922f00] transition-all active:scale-[0.99]"
                        >
                          <UserPlus className="w-4 h-4 text-white shrink-0" />
                          <span>Create Free Account</span>
                        </Button>
                      </Link>

                      <p className="text-[11px] text-center text-muted-foreground/90 font-medium pt-0.5">
                        No payment required to create an account
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Desktop: right side controls ── */}
        <div className="hidden lg:flex items-center gap-1 ml-auto">
          {showViewPlans && (
            <Link to="/pricing">
              <Button
                size="sm"
                className="h-8 px-3 text-[12px] font-bold bg-primary text-white hover:bg-primary/90 gap-1.5 rounded shadow-[0_2px_0_hsl(20_100%_30%)] animate-in fade-in slide-in-from-top-1 duration-300"
              >
                <Zap className="w-3 h-3" /> View Plans
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 text-muted-foreground hover:text-foreground" aria-label="Toggle dark mode">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {/* Country, Currency & Tax Selector (Desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Select Country and Currency" className="h-9 px-2 gap-1.5 text-[13px] text-muted-foreground hover:text-foreground font-semibold">
                <span className="text-base leading-none">{countryConfig.flag}</span>
                <span className="font-bold text-foreground">{countryConfig.code}</span>
                <span className="hidden xl:inline text-xs font-mono text-muted-foreground">({countryConfig.symbol})</span>
                <span className="hidden xl:inline text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                  {countryConfig.taxLabel}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover border-border max-h-80 overflow-y-auto">
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Region, Currency & Tax</span>
                  {autoDetectedSource === 'login' ? (
                    <span className="text-[10px] text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10">
                      Login Synced
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Auto-detected</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Current: {countryConfig.name} ({countryConfig.taxLabel})
                </p>
              </div>
              {availableCountries.map(c => (
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

          <CopyPublicProfileButton />
          <NotificationBell />
          {user ? (
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="My Account Menu" className="h-9 px-2 gap-2 text-[13px] font-medium text-foreground hover:bg-muted">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                    {(displayName || profile?.full_name || user.email || 'U')[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <span className="max-w-[80px] truncate">{(displayName || profile?.full_name || 'Account').split(' ')[0]}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                <div className="px-2 py-1.5 border-b border-border">
                  <p className="text-xs font-semibold text-foreground truncate">{displayName || profile?.full_name || 'My Account'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary uppercase">
                    {resolvedRole === 'supplier' || profile?.role === 'supplier' ? 'Supplier' : resolvedRole === 'admin' ? 'Admin' : 'Buyer'}
                  </span>
                </div>
                <DropdownMenuItem asChild>
                  <Link to={getDashboardLink()} className="flex items-center gap-2 cursor-pointer">
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={(resolvedRole === 'supplier' || profile?.role === 'supplier') ? '/dashboard/supplier/profile' : '/dashboard/buyer/profile'} className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" /> Profile & Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/delete-account" className="flex items-center gap-2 text-destructive cursor-pointer">
                    <AlertCircle className="w-4 h-4" /> Delete Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleSignOut();
                  }}
                  disabled={isSigningOut}
                  className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer font-medium hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/login" className="shrink-0">
                <Button size="sm" variant="ghost" className="text-[13px] font-bold text-foreground hover:text-primary hover:bg-muted h-8 px-3 rounded whitespace-nowrap">Sign In</Button>
              </Link>
              <Link to="/register" className="shrink-0">
                <Button size="sm" className="bg-[#FF5A00] text-white hover:bg-[#e04e00] h-8 px-3 text-[13px] font-bold rounded shadow-[0_2px_0_#922f00] whitespace-nowrap">Create Free Account</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile: full-width search bar row ── */}
      <div className="lg:hidden px-2.5 sm:px-4 pt-1 pb-1.5 w-full min-w-0 box-border">
        <form onSubmit={handleSearch} className="flex items-center rounded-xl border border-border bg-muted overflow-hidden h-9 w-full min-w-0 shadow-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground ml-2.5 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products, suppliers, categories..."
            className="flex-1 min-w-0 px-2 py-1.5 text-[12px] outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
          />
          <button type="submit" aria-label="Search" className="bg-[#FF5A00] hover:bg-[#e04e00] px-3 min-[360px]:px-3.5 h-full text-white text-[11px] font-bold shrink-0 transition-colors">
            Search
          </button>
        </form>
      </div>

      {/* ── Mobile: category chips with smooth touch swipe ── */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-2.5 sm:px-4 pb-2 w-full min-w-0 scrollbar-none overscroll-x-contain touch-pan-x">
        {MOBILE_CATS.map(({ label, icon: Icon, href }) => (
          <Link key={label} to={href}
            className="flex items-center gap-1 shrink-0 px-2.5 py-1 bg-muted border border-border rounded-full text-[10px] font-medium text-foreground whitespace-nowrap hover:border-primary/50 hover:text-primary transition-colors">
            <Icon className="w-2.5 h-2.5 shrink-0" />
            {label}
          </Link>
        ))}
        <Link to="/products"
          className="flex items-center gap-1 shrink-0 px-2.5 py-1 bg-muted border border-border rounded-full text-[10px] font-medium text-foreground whitespace-nowrap hover:border-primary/50 hover:text-primary transition-colors">
          <span className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
            {[...Array(4)].map((_, i) => <span key={i} className="block w-0.5 h-0.5 rounded-sm bg-current" />)}
          </span>
          More
        </Link>
      </div>

      {/* ── Desktop Category Nav ── */}
      <nav className="hidden lg:block border-t border-border">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center overflow-x-auto scrollbar-none whitespace-nowrap py-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}
                {...getPrefetchHandlers(link.href)}
                className={`whitespace-nowrap px-2.5 xl:px-3.5 py-2.5 text-[12px] xl:text-[13px] font-medium transition-colors hover:text-primary border-b-2 ${
                  isActive(link.href) ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                }`}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}

