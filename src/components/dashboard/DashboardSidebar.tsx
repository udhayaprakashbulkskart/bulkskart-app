import type React from 'react';
import { Fragment, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '@/components/common/BrandLogo';
import { cn } from '@/lib/utils';

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** A tool rather than a page of the dashboard: listed last, under "Tools". */
  tool?: boolean;
}

export interface DashboardSidebarProps {
  items: SidebarNavItem[];
  isActive: (href: string) => boolean;
  /** "Supplier hub", "Buyer hub", "Admin" … shown under the logo. */
  roleLabel: string;
  /** Group headings: the heading is shown above the item with that address. */
  headings?: Record<string, string>;
  /** The item that carries an "Unpaid" flag (a manufacturer's Subscription), if any. */
  flaggedHref?: string | null;
  /** Called when a link is chosen (the phone drawer closes). */
  onNavigate?: () => void;
  /** Links and buttons pinned under the list (help, marketplace, sign out …). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The dashboard menu as a vertical list: the logo, every section of the account with its icon, the open one in
 * BulkSkart orange, and a footer. The list scrolls on its own, so a long menu never pushes the page. The same component
 * is the fixed sidebar on a laptop or desktop and the drawer behind the hamburger on a phone or tablet.
 */
export default function DashboardSidebar({
  items,
  isActive,
  roleLabel,
  headings = {},
  flaggedHref = null,
  onNavigate,
  footer,
  className,
}: DashboardSidebarProps) {
  const listRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const pages = items.filter((item) => !item.tool);
  const tools = items.filter((item) => item.tool);

  // keep the open section in sight when the list is longer than the window
  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('.dsb-link.is-active');
    if (!list || !active) return;
    // in the phone drawer the whole drawer scrolls, not the list
    if (list.scrollHeight <= list.clientHeight) {
      active.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - (list.clientHeight - active.offsetHeight) / 2);
    }
  }, [pathname]);

  const link = (item: SidebarNavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={onNavigate}
        className={cn('dsb-link', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
        title={item.label}
      >
        <Icon aria-hidden="true" />
        <span className="dsb-label">{item.label}</span>
        {item.href === flaggedHref && <span className="dsh-flag">Unpaid</span>}
      </Link>
    );
  };

  return (
    <div className={cn('dsb', className)}>
      <div className="dsb-head">
        <Link to="/" className="dsh-brand" onClick={onNavigate} aria-label="BulkSkart home">
          <BrandLogo size="md" variant="auto" linkTo={null} />
        </Link>
        <span className="dsb-role">{roleLabel}</span>
      </div>
      <nav ref={listRef} className="dsb-list" aria-label="Dashboard sections">
        {pages.map((item) => (
          <Fragment key={item.href}>
            {headings[item.href] && <span className="dsb-heading">{headings[item.href]}</span>}
            {link(item)}
          </Fragment>
        ))}
        {tools.length > 0 && <span className="dsb-heading">Tools</span>}
        {tools.map(link)}
      </nav>
      {footer && <div className="dsb-foot">{footer}</div>}
    </div>
  );
}
