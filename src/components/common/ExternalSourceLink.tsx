import type { MouseEvent, ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

/** Opens a public source listing in a new tab. Same orange as the rest of the site. */
export function ExternalSourceLink({
  href,
  children,
  className = '',
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
      {children}
      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

const badgeClass = 'inline-flex items-center px-2 py-0.5 rounded-md bg-[#FF5A00]/15 text-[#FF5A1F] border border-[#FF5A00]/30 text-[10px] font-bold leading-none';

export function PublicAuctionBadge({ className = '' }: { className?: string }) {
  return <span className={`${badgeClass} ${className}`}>Public auction</span>;
}

export function GovernmentTenderBadge({ className = '' }: { className?: string }) {
  return <span className={`${badgeClass} ${className}`}>Government tender</span>;
}
