import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
  Search, CircleHelp, Store, ChevronDown, Wrench, LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  /** Shown in the amber "Tools" list instead of the main list. */
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

const pad = (n: number) => String(n).padStart(2, '0');

/** The LCD clock: the visitor's own time and date, and whether the browser is online. */
function DashClock() {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/,/g, '').toUpperCase();
  return (
    <div className={cn('dsh-clock', !online && 'is-offline')}>
      <span className="sr-only">
        {`Local time ${pad(now.getHours())}:${pad(now.getMinutes())}, ${date}, ${online ? 'online' : 'offline'}`}
      </span>
      <div className="dsh-clock-time" aria-hidden="true">
        <b>{pad(now.getHours())}</b>
        <i>:</i>
        <b>{pad(now.getMinutes())}</b>
        <small>{pad(now.getSeconds())}</small>
      </div>
      <div className="dsh-clock-meta" aria-hidden="true">
        <span>{date}</span>
        <span>{online ? 'Online' : 'Offline'}</span>
      </div>
    </div>
  );
}

interface SidebarProps {
  items: NavItem[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  roleLabel: string;
  unpaid: boolean;
  inSheet?: boolean;
  showPublicProfile?: boolean;
}

function Sidebar({ items, isActive, onNavigate, onSignOut, roleLabel, unpaid, inSheet = false, showPublicProfile = false }: SidebarProps) {
  const [toolsOpen, setToolsOpen] = useState(true);
  const main = items.filter((item) => !item.tool);
  const tools = items.filter((item) => item.tool);
  return (
    <aside className={cn('dsh-side', inSheet && 'is-sheet')} aria-label="Dashboard menu">
      <Link to="/" className="dsh-brand" onClick={onNavigate} aria-label="BulkSkart home">
        <BrandLogo size="md" variant="dark" linkTo={null} />
      </Link>

      <span className="dsh-plaque">{roleLabel}</span>

      <nav className="dsh-navbox" aria-label="Dashboard sections">
        {main.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={cn('dsh-link', active && 'is-active')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
              {item.href === '/dashboard/supplier/subscription' && unpaid && <span className="dsh-flag">Unpaid</span>}
            </Link>
          );
        })}

        {tools.length > 0 && (
          <>
            <button type="button" className="dsh-link" aria-expanded={toolsOpen} aria-controls="dsh-tools" onClick={() => setToolsOpen((open) => !open)}>
              <Wrench aria-hidden="true" />
              <span>Tools</span>
              <ChevronDown className="dsh-caret" aria-hidden="true" />
            </button>
            {toolsOpen && (
              <div className="dsh-term" id="dsh-tools">
                {tools.map((item) => (
                  <Link key={item.href} to={item.href} onClick={onNavigate} className={cn(isActive(item.href) && 'is-active')}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      <DashClock />

      <div className="dsh-foot">
        {inSheet && showPublicProfile && <CopyPublicProfileButton />}
        <Link to="/contact" onClick={onNavigate} className="dsh-link">
          <LifeBuoy aria-hidden="true" />
          <span>Help Desk</span>
        </Link>
        <div className="dsh-foot-row">
          <Link to="/" onClick={onNavigate} className="dsh-link">
            <Globe aria-hidden="true" />
            <span>Market</span>
          </Link>
          <button type="button" onClick={onSignOut} className="dsh-link is-danger">
            <LogOut aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

const SUBTITLES: Record<string, string> = {
  buyer: 'Manage your bulk requirements and received quotes',
  supplier: 'Manage products, leads and quotations',
  admin: 'Monitor users, verifications and disputes',
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isPaidSubscriber, signOut, loading, resolvedRole, displayName, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => retainDashTheme(), []);

  const role = resolvedRole || profile?.role || null;
  const isUnpaidManufacturer = role === 'supplier' && !isPaidSubscriber;

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

  // "/" jumps to the search box, as the key hint in it says
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      const box = searchRef.current;
      if (!box || box.offsetParent === null) return;
      event.preventDefault();
      box.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navItems = role === 'admin'
    ? adminNavItems
    : role === 'supplier'
    ? supplierNavItems
    : buyerNavItems;

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

  const isActive = (href: string) => {
    if (href === '/dashboard/buyer' || href === '/dashboard/supplier' || href === '/dashboard/admin') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const roleLabel = role === 'supplier' ? 'Supplier hub' : role === 'admin' ? 'Admin' : role === 'buyer' ? 'Buyer hub' : 'Workspace';
  const roleName = role === 'supplier' ? 'Supplier' : role === 'admin' ? 'Admin' : role === 'buyer' ? 'Buyer' : 'Account';
  const firstName = (displayName || '').trim().split(/\s+/)[0] || 'there';
  const initials = (displayName || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
  const profilePath = role === 'supplier' ? '/dashboard/supplier/profile' : role === 'admin' ? '/dashboard/admin' : '/dashboard/buyer/profile';
  const showPublicProfile = role === 'supplier' || role === 'buyer';

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  const sidebarProps = {
    items: navItems,
    isActive,
    onSignOut: handleSignOut,
    roleLabel,
    unpaid: isUnpaidManufacturer,
    showPublicProfile,
  };

  return (
    <div className="dsh">
      <PageMeta
        title="Dashboard — BulkSkart B2B Marketplace"
        description="BulkSkart secure account management and trade negotiation dashboard."
        robots="noindex, nofollow"
      />

      <Sidebar {...sidebarProps} onNavigate={() => undefined} />

      <div className="dsh-main">
        <header className="dsh-bar">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button type="button" className="dsh-burger" aria-label="Open sidebar menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(292px,88vw)] border-0 bg-transparent p-2 shadow-none">
              <Sidebar {...sidebarProps} onNavigate={() => setMobileOpen(false)} inSheet />
            </SheetContent>
          </Sheet>

          <div className="dsh-hello">
            <p className="dsh-hello-title">{loading ? 'Welcome back' : `Hi, ${firstName}! Welcome back.`}</p>
            <p>{SUBTITLES[role ?? ''] ?? 'Manage your account and trade activity'}</p>
          </div>

          <form className="dsh-search" role="search" onSubmit={handleSearch}>
            <Search aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products…"
              aria-label="Search the marketplace for products"
            />
            <kbd className="dsh-kbd" aria-hidden="true">/</kbd>
          </form>

          {showPublicProfile && (
            <div className="dsh-pub">
              <CopyPublicProfileButton />
            </div>
          )}

          <div className="dsh-icons">
            <NotificationBell className="dsh-ibtn" />
            <Link to="/contact" className="dsh-ibtn is-hide-sm" aria-label="Help desk" title="Help desk">
              <CircleHelp aria-hidden="true" />
            </Link>
            <Link to="/" className="dsh-ibtn is-hide-sm" aria-label="Open the marketplace" title="Open the marketplace">
              <Store aria-hidden="true" />
            </Link>
          </div>

          <Link to={profilePath} className="dsh-user" aria-label={`${displayName || 'Your'} profile`}>
            <span className="dsh-avatar" aria-hidden="true">{initials}</span>
            <div>
              <b>{loading ? '…' : displayName}</b>
              <small>{roleName}</small>
            </div>
          </Link>
        </header>

        {/* ── UNPAID MANUFACTURER SUBSCRIPTION NOTIFICATION BANNER ── */}
        {isUnpaidManufacturer && (
          <div className="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/10 border-2 border-amber-500/30 rounded-2xl px-3 md:px-5 py-2 shrink-0 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-extrabold text-foreground">
                    Unpaid Manufacturer Account
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 uppercase tracking-wider">
                    Contacts Locked
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate sm:whitespace-normal hidden sm:block">
                  Subscribe to unlock buyer contacts, RFQ quotes, product listings, and premium tools.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              <Link to="/pricing" className="hidden sm:block">
                <Button variant="outline" size="sm" className="h-8 text-xs border-amber-500/30 hover:bg-amber-500/10">
                  Compare Plans
                </Button>
              </Link>
              <Link to="/dashboard/supplier/subscription">
                <Button size="sm" className="h-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Subscribe Now</span>
                </Button>
              </Link>
            </div>
          </div>
        )}

        <main className="dsh-content">{children}</main>
      </div>
    </div>
  );
}
