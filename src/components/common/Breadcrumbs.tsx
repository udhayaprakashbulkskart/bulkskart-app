import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** "onDark" keeps the trail readable on a dark banner in both light and dark themes. */
  tone?: 'default' | 'onDark';
}

export default function Breadcrumbs({ items, className = '', tone = 'default' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;
  const dark = tone === 'onDark';
  const hoverText = dark ? 'hover:text-white' : 'hover:text-foreground';

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs ${dark ? 'text-white/70' : 'text-muted-foreground'} ${className}`}>
      <ol className="flex items-center flex-wrap gap-1.5 min-w-0" itemScope itemType="https://schema.org/BreadcrumbList">
        {/* Root item */}
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center gap-1.5 shrink-0"
        >
          <Link
            to="/"
            itemProp="item"
            className={`flex items-center gap-1 ${hoverText} transition-colors py-0.5`}
            title="BulkSkart Home"
          >
            <Home className={`w-3.5 h-3.5 ${dark ? 'text-white/70' : 'text-muted-foreground/80'} hover:text-primary transition-colors shrink-0`} />
            <span itemProp="name" className="sr-only sm:not-sr-only sm:inline font-medium">Home</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const position = idx + 2;

          return (
            <li
              key={`${item.name}-${idx}`}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              className="flex items-center gap-1.5 min-w-0"
            >
              <ChevronRight className={`w-3 h-3 ${dark ? 'text-white/40' : 'text-muted-foreground/40'} shrink-0`} aria-hidden="true" />
              {isLast || !item.href ? (
                <span
                  itemProp="name"
                  aria-current="page"
                  className={`font-semibold ${dark ? 'text-white' : 'text-foreground'} truncate max-w-[160px] sm:max-w-[280px] md:max-w-none`}
                  title={item.name}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.href}
                  itemProp="item"
                  className={`${hoverText} transition-colors truncate max-w-[120px] sm:max-w-[200px] md:max-w-none`}
                  title={item.name}
                >
                  <span itemProp="name">{item.name}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(position)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
