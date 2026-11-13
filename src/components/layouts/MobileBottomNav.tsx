/**
 * MobileBottomNav
 *
 * Native-app bottom navigation for marketplace discovery:
 * Home | Products | RFQs | Messages | Account
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, FileText, Package, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function MobileBottomNav() {
  const { user, profile } = useAuth();
  const location = useLocation();

  const isSupplier = (profile?.role as string) === 'supplier' || (profile?.role as string) === 'manufacturer';

  const path = location.pathname;
  const isExcluded =
    path.startsWith('/auth') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/signup') ||
    path.startsWith('/business-setup') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/checkout') ||
    path.includes('/negotiation');

  if (isExcluded) return null;

  const messagesLink = user
    ? isSupplier
      ? '/dashboard/supplier/messages'
      : '/dashboard/buyer/messages'
    : '/auth';

  const profileLink = user
    ? isSupplier
      ? '/dashboard/supplier'
      : profile?.role === 'admin'
        ? '/dashboard/admin'
        : '/dashboard/buyer'
    : '/auth';

  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'RFQs', path: '/requirements', icon: FileText },
    { label: 'Messages', path: messagesLink, icon: MessageSquare },
    { label: 'Account', path: profileLink, icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border bg-background/90 backdrop-blur-xl shadow-[0_-12px_40px_-24px_rgba(255,90,0,0.55)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.label === 'Home'
              ? location.pathname === '/'
              : item.label === 'Messages'
                ? location.pathname.includes('/messages') || location.pathname === '/chat'
                : item.label === 'RFQs'
                  ? /^\/(requirements|requirement|rfqs)(\/|$)/.test(location.pathname)
                  : item.label === 'Account'
                    ? (location.pathname.startsWith('/dashboard') && !location.pathname.includes('/messages'))
                      || location.pathname.startsWith('/profile')
                      || location.pathname.startsWith('/settings')
                    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive: active }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-colors group relative touch-manipulation min-h-[48px]',
                  active || isActive
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <div className="relative">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition-transform group-active:scale-95',
                    isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                {item.label === 'Home' && isSupplier && (
                  <span
                    title="AI Sales Assistant Active"
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"
                  />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-full">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
