import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, FileText, Users } from 'lucide-react';
import { MOBILE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import './mobile-home.css';

/** A solid house with a door, drawn in the colour of the text (orange when the page is active). */
function HomeFilled(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M20 4.5c.6 0 1.2.2 1.7.6l13 10.4c.8.6 1.3 1.6 1.3 2.6V33a3 3 0 0 1-3 3h-7v-9a4 4 0 0 0-8 0v9H8a3 3 0 0 1-3-3V18.1c0-1 .5-2 1.3-2.6l13-10.4c.5-.4 1.1-.6 1.7-.6Z"
      />
    </svg>
  );
}

const ITEMS = [
  { label: 'Home', href: '/', icon: HomeFilled },
  { label: 'Categories', href: '/categories', icon: LayoutGrid },
  { label: 'Post RFQ', href: '/post-requirement', icon: Plus, center: true },
  { label: 'RFQs', href: '/requirements', icon: FileText },
  { label: 'Suppliers', href: '/manufacturers', icon: Users },
];

/** The five-button bar fixed to the bottom of the phone screen (home page only). */
export default function MobileHomeNav() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { pathname } = useLocation();
  if (!isMobile) return null;

  return (
    <>
      <nav className="mh-nav" aria-label="Main navigation">
        {ITEMS.map(({ label, href, icon: Icon, center }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          if (center) {
            return (
              <Link key={label} to={href} className="mh-post">
                <span className="mh-plus">
                  <Icon aria-hidden="true" />
                </span>
                {label}
              </Link>
            );
          }
          return (
            <Link key={label} to={href} className={active ? 'is-active' : undefined} aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      {/* Keeps the bottom of the page, and the footer, from hiding behind the bar. */}
      <div className="mh-nav-space" aria-hidden="true" />
    </>
  );
}
