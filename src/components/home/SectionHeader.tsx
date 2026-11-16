import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional content on the right (md+) or below the heading (mobile). */
  action?: React.ReactNode;
  align?: 'left' | 'center';
  /**
   * `surface` follows the theme tokens and suits sections on the page background.
   * `dark` keeps white text for sections with a fixed dark background.
   */
  tone?: 'surface' | 'dark';
  className?: string;
}

export default function SectionHeader({
  eyebrow,
  icon,
  title,
  subtitle,
  action,
  align = 'left',
  tone = 'surface',
  className,
}: SectionHeaderProps) {
  const dark = tone === 'dark';
  const centered = align === 'center';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        centered && 'items-center text-center md:flex-col md:items-center',
        className,
      )}
    >
      <div className={cn('min-w-0', centered ? 'mx-auto max-w-2xl' : 'max-w-3xl')}>
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {icon}
            {eyebrow}
          </span>
        )}
        <h2
          className={cn(
            'mt-3 text-2xl font-black leading-tight tracking-tight md:text-3xl',
            dark ? 'text-white' : 'text-foreground',
          )}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className={cn(
              'mt-2 text-sm leading-relaxed text-pretty md:text-base',
              dark ? 'text-neutral-300' : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
