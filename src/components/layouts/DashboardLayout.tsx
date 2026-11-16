import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import CopyPublicProfileButton from '@/components/common/CopyPublicProfileButton';
import NotificationBell from '@/components/common/NotificationBell';
import BrandLogo from '@/components/common/BrandLogo';
import PageMeta from '@/components/common/PageMeta';
import {
  LayoutDashboard, Package, FileText, MessageSquare, Bell,
  Settings, LogOut, Menu, Globe, BarChart3, TrendingUp,
  Shield, Flag, CreditCard, Building2, UserCircle,
  Warehouse, Zap, Truck, Sparkles, Lock, Calculator,
  Search, LifeBuoy, Plus, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import '@/components/dashboard/dashboard.css';

/** Routes unpaid manufacturers may still open (subscribe / setup / inbox / browse). */
const UNPAID_SUPPLIER_ALLOWLIST = [
  '/dashboard/supplier',
  '/dashboard/supplier/subscription',
  '/dashboard/supplier/profile',
  '/dashboard/supplier/verification',
  '/dashboard/supplier/messages',
  '/dashboard/supplier/notifications',
  '/dashboard/supplier/overview',
  '/dashboard/supplier/products', // browse catalog — Add Product gated in-page
  '/dashboard/supplier/rfqs', // browse only — contacts & quotes gated in-page
  '/dashboard/manufacturer',
  '/dashboard/manufacturer/subscription',
  '/dashboard/manufacturer/profile',
  '/dashboard/manufacturer/verification',
  '/dashboard/manufacturer/messages',
  '/dashboard/manufacturer/notifications',
  '/dashboard/manufacturer/overview',
  '/dashboard/manufacturer/products',
  '/dashboard/manufacturer/rfqs',
];

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** A tool rather than a page of the dashboard: shown after a divider at the end of the menu. */
  tool?: boolean;
}

export const buyerNavItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard/buyer', icon: LayoutDashboard },
  { label: 'My Requirements', href: '/dashboard/buyer/requirements', icon: FileText },
  { label: 'Received Quotes', href: '/dashboard/buyer/quotes', icon: Package },
  { label: 'Orders', href: '/dashboard/buyer/orders', icon: Package },
  { label: 'Messages', href: '/dashboard/buyer/messages', icon: MessageSquare },
  { label: 'Notifications', href: '/dashboard/buyer/notifications', icon: Bell },
  { label: 'Saved Manufacturers', href: '/dashboard/buyer/saved-manufacturers', icon: Building2 },
  { label: 'KYC Verification', href: '/dashboard/buyer/verification', icon: Shield },
  { label: 'Disputes', href: '/dashboard/buyer/disputes', icon: Flag },
  { label: 'Profile', href: '/dashboard/buyer/profile', icon: Settings },
  { label: 'Shipping Calculator', href: '/shipping-calculator', icon: Truck, tool: true },
  { label: 'Order Loan Calculator', href: '/loan-calculator', icon: Calculator, tool: true },
];

export const supplierNavItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard/supplier', icon: LayoutDashboard },
  { label: 'AI Sales Assistant', href: '/dashboard/supplier/ai-assistant', icon: Sparkles },
  { label: 'Business Overview', href: '/dashboard/supplier/overview', icon: BarChart3 },
  { label: 'My Products', href: '/dashboard/supplier/products', icon: Package },
  { label: 'Inventory & Stock', href: '/dashboard/supplier/inventory', icon: Warehouse },
  { label: 'RFQ Leads', href: '/dashboard/supplier/rfqs', icon: FileText },
  { label: 'Quotations', href: '/dashboard/supplier/quotations', icon: TrendingUp },
  { label: 'Orders', href: '/dashboard/supplier/orders', icon: Building2 },
  { label: 'Messages', href: '/dashboard/supplier/messages', icon: MessageSquare },
  { label: 'Notifications', href: '/dashboard/supplier/notifications', icon: Bell },
  { label: 'Verification', href: '/dashboard/supplier/verification', icon: Shield },
  { label: 'Disputes', href: '/dashboard/supplier/disputes', icon: Flag },
  { label: 'Analytics', href: '/dashboard/supplier/analytics', icon: BarChart3 },
  { label: 'Subscription', href: '/dashboard/supplier/subscription', icon: CreditCard },
  { label: 'Business Profile', href: '/dashboard/supplier/profile', icon: UserCircle },
];

export const adminNavItems: NavItem[] = [
  { label: 'Control Panel', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'AI Match Analytics', href: '/dashboard/admin/ai-match-analytics', icon: Zap },
  { label: 'Reports', href: '/dashboard/admin/reports', icon: Flag },
];

/**
 * While a dashboard page is open the whole document wears the dashboard colours, so pop-ups (menus, dialogs, toasts) match.
 * Moving from one dashboard page to another unmounts and mounts the layout, so in that case the class is only taken off
 * after a short pause with no dashboard on screen; that keeps the page from flashing in the site's colours between two
 * pages. Leaving the dashboard for the rest of the site takes it off at once.
 */
let dashUsers = 0;
let dashTimer: ReturnType<typeof setTimeout> | null = null;
function retainDashTheme(): () => void {
  dashUsers += 1;
  if (dashTimer) {
    clearTimeout(dashTimer);
    dashTimer = null;
  }
  document.documentElement.classList.add('dash-active');
  return () => {
    dashUsers -= 1;
    if (dashUsers > 0) return;
    // the address has already changed when the old page is removed, so it says where the visitor is going
    if (!window.location.pathname.startsWith('/dashboard')) {
      document.documentElement.classList.remove('dash-active');
      return;
    }
    dashTimer = setTimeout(() => {
      if (dashUsers === 0) document.documentElement.classList.remove('dash-active');
      dashTimer = null;
    }, 600);
  };
}

interface NavBarProps {
  items: NavItem[];
  isActive: (href: string) => boolean;
  unpaid: boolean;
  /** A long menu sits in a row of its own under the logo, wrapping if it must, instead of beside the logo. */
  stacked: boolean;
}

/** The pill menu in the bar: every section is shown, none is hidden behind a button. */
function NavBar({ items, isActive, unpaid, stacked }: NavBarProps) {
  const pages = items.filter((item) => !item.tool);
  const tools = items.filter((item) => item.tool);
  const pill = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link key={item.href} to={item.href} className={cn('dsh-tab', active && 'is-active')} aria-current={active ? 'page' : undefined}>
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
        {item.href === '/dashboard/supplier/subscription' && unpaid && <span className="dsh-flag">Unpaid</span>}
      </Link>
    );
  };

  return (
    <nav className={cn('dsh-nav', stacked && 'is-stacked')} aria-label="Dashboard sections">
      {pages.map(pill)}
      {tools.length > 0 && <span className="dsh-sep" aria-hidden="true" />}
      {tools.map(pill)}
    </nav>
  );
}

interface MobileMenuProps {
  items: NavItem[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  roleLabel: string;
  unpaid: boolean;
  showPublicProfile: boolean;
  theme: string;
  onToggleTheme: () => void;
}

/** The same sections as a list, for a phone. */
function MobileMenu({ items, isActive, onNavigate, onSignOut, roleLabel, unpaid, showPublicProfile, theme, onToggleTheme }: MobileMenuProps) {
  const main = items.filter((item) => !item.tool);
  const tools = items.filter((item) => item.tool);
  const link = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link key={item.href} to={item.href} onClick={onNavigate} className={cn('dsh-slink', active && 'is-active')} aria-current={active ? 'page' : undefined}>
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
        {item.href === '/dashboard/supplier/subscription' && unpaid && <span className="dsh-flag">Unpaid</span>}
      </Link>
    );
  };
  return (
    <>
      <Link to="/" className="dsh-brand" onClick={onNavigate} aria-label="BulkSkart home">
        <BrandLogo size="md" variant="auto" linkTo={null} />
      </Link>
      <span className="dsh-slabel">{roleLabel}</span>
      <nav className="dsh-slist" aria-label="Dashboard sections">
        {main.map(link)}
        {tools.length > 0 && <span className="dsh-slabel">Tools</span>}
        {tools.map(link)}
      </nav>
      <div className="dsh-slist">
        {showPublicProfile && <CopyPublicProfileButton />}
        <Link to="/contact" onClick={onNavigate} className="dsh-slink">
          <LifeBuoy aria-hidden="true" />
          <span>Help Desk</span>
        </Link>
        <Link to="/" onClick={onNavigate} className="dsh-slink">
          <Globe aria-hidden="true" />
          <span>Market</span>
        </Link>
        <button type="button" onClick={onToggleTheme} className="dsh-slink">
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button type="button" onClick={onSignOut} className="dsh-slink is-danger">
          <LogOut aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** The page explains the unpaid state itself, so the notice under the bar is left out (the lock on pages stays). */
  hideUnpaidNotice?: boolean;
}

export default function DashboardLayout({ children, hideUnpaidNotice = false }: DashboardLayoutProps) {
  const { isPaidSubscriber, signOut, loading, resolvedRole, displayName, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => retainDashTheme(), []);

  const role = resolvedRole || profile?.role || null;
  // Whether a manufacturer has paid is only known once the account has finished loading: the subscription is looked up
  // after the profile. Before that every manufacturer would look unpaid, and a paying one would be sent away from a page.
  const isUnpaidManufacturer = role === 'supplier' && !loading && !isPaidSubscriber;
  const showNotice = isUnpaidManufacturer && !hideUnpaidNotice;

  // A page that fills the window (the chat) has to know how far down it starts: the bar is one, two or three rows high
  // depending on the window, and a notice can sit under it. The page reads it as --dsh-top.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const page = root?.querySelector<HTMLElement>('.dsh-content');
    if (!root || !page) return undefined;
    const measure = () => root.style.setProperty('--dsh-top', `${page.offsetTop}px`);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watcher = new ResizeObserver(measure);
    for (const above of root.querySelectorAll('.dsh-bar, .dsh-notice')) watcher.observe(above);
    return () => watcher.disconnect();
  }, [showNotice]);

  // Route users to the dashboard that matches their signup role
  useEffect(() => {
    if (loading || !role) return;
    const path = location.pathname;
    const onBuyer = path.startsWith('/dashboard/buyer');
    const onSupplier = path.startsWith('/dashboard/supplier') || path.startsWith('/dashboard/manufacturer');
    const onAdmin = path.startsWith('/dashboard/admin');

    if (role === 'supplier' && onBuyer) {
      navigate('/dashboard/supplier', { replace: true });
      return;
    }
    if (role === 'buyer' && onSupplier) {
      navigate('/dashboard/buyer', { replace: true });
      return;
    }
    if (role === 'admin' && (onBuyer || onSupplier) && !onAdmin) {
      navigate('/dashboard/admin', { replace: true });
    }
  }, [loading, role, location.pathname, navigate]);

  // Hard gate: unpaid manufacturers cannot use product/RFQ/order tools until they subscribe
  useEffect(() => {
    if (!isUnpaidManufacturer) return;
    const path = location.pathname.replace(/\/$/, '') || '/';
    const isAllowed = UNPAID_SUPPLIER_ALLOWLIST.includes(path);
    if (!isAllowed && (path.startsWith('/dashboard/supplier') || path.startsWith('/dashboard/manufacturer'))) {
      toast.message('Subscription required', {
        description: 'Activate a manufacturer plan to access this section.',
      });
      navigate('/dashboard/supplier/subscription', { replace: true });
    }
  }, [isUnpaidManufacturer, location.pathname, navigate]);

  // "/" opens the search, as the key hint in it says
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the search box takes focus when it opens, and closes when the visitor clicks elsewhere
  useEffect(() => {
    if (!searchOpen) return undefined;
    searchRef.current?.focus();
    const onDown = (event: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const navItems = role === 'admin'
    ? adminNavItems
    : role === 'supplier'
    ? supplierNavItems
    : buyerNavItems;

  // buyers and manufacturers have a long menu, which needs a row of its own; the admin's few sections fit beside the logo
  const stacked = navItems.length > 4;

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (err) {
      console.error('Sign out error:', err);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  // /dashboard/manufacturer/... is the same dashboard as /dashboard/supplier/...
  const here = location.pathname.replace(/^\/dashboard\/manufacturer/, '/dashboard/supplier');
  const isActive = (href: string) => {
    if (href === '/dashboard/buyer' || href === '/dashboard/supplier' || href === '/dashboard/admin') {
      return here === href;
    }
    return here.startsWith(href);
  };

  const roleLabel = role === 'supplier' ? 'Supplier hub' : role === 'admin' ? 'Admin' : role === 'buyer' ? 'Buyer hub' : 'Workspace';
  const roleName = role === 'supplier' ? 'Supplier' : role === 'admin' ? 'Admin' : role === 'buyer' ? 'Buyer' : 'Account';
  const initials = (displayName || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
  const profilePath = role === 'supplier' ? '/dashboard/supplier/profile' : role === 'admin' ? '/dashboard/admin' : '/dashboard/buyer/profile';
  const showPublicProfile = role === 'supplier' || role === 'buyer';
  const quickAdd = role === 'buyer'
    ? { to: '/post-requirement', label: 'Post a requirement' }
    : role === 'supplier'
    ? { to: '/dashboard/supplier/products', label: 'Add a product' }
    : null;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="dsh" ref={rootRef}>
      <PageMeta
        title="Dashboard — BulkSkart B2B Marketplace"
        description="BulkSkart secure account management and trade negotiation dashboard."
        robots="noindex, nofollow"
      />

      <header className={cn('dsh-bar', stacked && 'is-stacked')}>
        <div className="dsh-bar-in">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button type="button" className="dsh-burger" aria-label="Open sidebar menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="dsh-sheet">
              <SheetTitle className="sr-only">Dashboard menu</SheetTitle>
              <SheetDescription className="sr-only">The pages of your dashboard</SheetDescription>
              <MobileMenu
                items={navItems}
                isActive={isActive}
                onNavigate={() => setMobileOpen(false)}
                onSignOut={handleSignOut}
                roleLabel={roleLabel}
                unpaid={isUnpaidManufacturer}
                showPublicProfile={showPublicProfile}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            </SheetContent>
          </Sheet>

          <Link to="/" className="dsh-brand" aria-label="BulkSkart home">
            <BrandLogo size="md" variant="auto" linkTo={null} />
          </Link>

          <NavBar items={navItems} isActive={isActive} unpaid={isUnpaidManufacturer} stacked={stacked} />

          <div className="dsh-tools" ref={searchWrapRef}>
            <button
              type="button"
              className="dsh-ibtn"
              aria-label="Search the marketplace"
              aria-expanded={searchOpen}
              aria-controls="dsh-search"
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search aria-hidden="true" />
            </button>
            {quickAdd && (
              <Link to={quickAdd.to} className="dsh-plus" aria-label={quickAdd.label} title={quickAdd.label}>
                <Plus aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              className="dsh-ibtn dsh-ai is-hide-sm"
              aria-label="Ask AI trade help"
              title="Ask AI trade help"
              onClick={() => window.dispatchEvent(new Event('open-ai-chat'))}
            >
              <Sparkles aria-hidden="true" />
            </button>
            <NotificationBell className="dsh-ibtn" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="dsh-avatar" aria-label={`${displayName || 'Your'} account menu`}>
                  {loading ? '…' : initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="dsh-menu">
                <div className="dsh-who">
                  <b>{loading ? '…' : displayName || 'Your account'}</b>
                  <span>{roleName}</span>
                </div>
                <DropdownMenuItem asChild className="dsh-mi">
                  <Link to={profilePath}>
                    <UserCircle aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                {showPublicProfile && (
                  <div className="px-2 py-1">
                    <CopyPublicProfileButton />
                  </div>
                )}
                <DropdownMenuItem asChild className="dsh-mi">
                  <Link to="/contact">
                    <LifeBuoy aria-hidden="true" />
                    <span>Help desk</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="dsh-mi">
                  <Link to="/">
                    <Globe aria-hidden="true" />
                    <span>Open the marketplace</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="dsh-mi" onSelect={() => toggleTheme()}>
                  {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                  <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="dsh-mi is-danger" onSelect={handleSignOut}>
                  <LogOut aria-hidden="true" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {searchOpen && (
              <form
                id="dsh-search"
                className="dsh-search"
                role="search"
                onSubmit={handleSearch}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false);
                }}
              >
                <Search aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products…"
                  aria-label="Search the marketplace for products"
                />
                <kbd aria-hidden="true">Esc</kbd>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* ── UNPAID MANUFACTURER SUBSCRIPTION NOTIFICATION BANNER ── */}
      {showNotice && (
        <div className="dsh-notice">
          <div className="flex min-w-0 items-center gap-3">
            <span className="dsh-notice-ico">
              <Lock aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <b>Unpaid Manufacturer Account</b> <span className="dsh-flag">Contacts Locked</span>
              <p>Subscribe to unlock buyer contacts, RFQ quotes, product listings, and premium tools.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/pricing" className="dbtn is-ghost">
              Compare Plans
            </Link>
            <Link to="/dashboard/supplier/subscription" className="dbtn is-primary">
              <Sparkles aria-hidden="true" />
              <span>Subscribe Now</span>
            </Link>
          </div>
        </div>
      )}

      <main className="dsh-content">{children}</main>
    </div>
  );
}
