/**
 * MobileBottomNav
 *
 * Prompt requirement:
 * Mobile responsive bottom navigation:
 * Home | Requirements | Products | Messages | Profile
 * Add AI Sales Assistant access from Home and Notifications
 */
import React from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { Home, FileText, Package, MessageSquare, User, Gavel, FileCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function MobileBottomNav() {
  const { user, profile } = useAuth();
  const location = useLocation();

  const isSupplier = (profile?.role as string) === 'supplier' || (profile?.role as string) === 'manufacturer';

  // Specific paths where mobile bottom nav should not collide with fixed checkout/chat keyboards
  const isExcluded = location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/negotiation/') ||
    location.pathname.startsWith('/admin');

  if (isExcluded) return null;

  const messagesLink = user
    ? isSupplier
      ? '/dashboard/supplier/messages'
      : '/dashboard/buyer/messages'
    : '/auth';

  const profileLink = user
    ? isSupplier
      ? '/dashboard/supplier'
      : '/dashboard/buyer'
    : '/auth';

  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Marketplace', path: '/products', icon: Package },
    { label: 'Auctions', path: '/auctions', icon: Gavel },
    { label: 'My Quotes', path: '/my-quotations', icon: FileCheck },
    { label: 'Profile', path: profileLink, icon: User },
  ];

  return (
    <>
      {/* Spacer so bottom page content is never obscured by fixed bottom bar */}
      <div className="h-20 md:hidden w-full shrink-0 pointer-events-none" aria-hidden="true" />

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.8)] pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center px-0.5 sm:px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive: active }) =>
                  cn(
                    'flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-colors group relative touch-manipulation min-h-[48px]',
                    active || isActive
                      ? 'text-[#FF5A00] font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      'w-4.5 h-4.5 min-[360px]:w-5 min-[360px]:h-5 transition-transform group-active:scale-90',
                      isActive ? 'text-[#FF5A00]' : 'text-muted-foreground'
                    )}
                  />
                  {item.label === 'Home' && isSupplier && (
                    <span
                      title="AI Sales Assistant Active"
                      className="absolute -top-1.5 -right-2 w-2 h-2 rounded-full bg-[#C94400] ring-2 ring-background animate-pulse"
                    />
                  )}
                </div>
                <span className="text-[9px] min-[360px]:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
