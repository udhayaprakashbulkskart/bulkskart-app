import React from 'react';
import { Box, Database, Factory, Gavel, Globe, ShieldCheck, Truck, Zap } from 'lucide-react';

/** What the home page search box can look for. */
export type HomeSearchType = 'products' | 'manufacturers' | 'rfqs';

/** Where each pair of leaves sits along a laurel branch. */
const LAUREL_LEAVES: Array<[number, number]> = [[12, 32], [9.1, 27.4], [7.2, 22.3], [6.2, 17.1], [6.2, 11.7], [7, 6.4]];

/** One gold laurel branch; the right one is the same drawing mirrored. */
export function Laurel({ flip = false, className, idPrefix = 'laurel' }: { flip?: boolean; className?: string; idPrefix?: string }) {
  const id = `${idPrefix}-${flip ? 'r' : 'l'}`;
  return (
    <svg className={className} viewBox="0 0 22 38" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#e8902a" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`} stroke="none">
        <path d="M16 36 C 6 28, 4 14, 8 3" fill="none" stroke={`url(#${id})`} strokeWidth="1.1" />
        {LAUREL_LEAVES.map(([x, y], i) => (
          <React.Fragment key={i}>
            <ellipse cx={x - 2.6} cy={y} rx="2.1" ry="3.9" transform={`rotate(-38 ${x - 2.6} ${y})`} />
            <ellipse cx={x + 2.6} cy={y - 0.8} rx="2.1" ry="3.9" transform={`rotate(38 ${x + 2.6} ${y - 0.8})`} />
          </React.Fragment>
        ))}
      </g>
    </svg>
  );
}

/** The green tick in a dark circle used in the promo banner. */
export function CheckBadge() {
  return (
    <svg viewBox="0 0 27 27" aria-hidden="true">
      <circle cx="13.5" cy="13.5" r="13" fill="#3a3a3f" />
      <path d="M7 14l4.4 4.4L20 9" fill="none" stroke="#8be028" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The four dots of the "More" square: two outlined, two filled. */
export function MoreIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="9" height="9" rx="3" stroke="#fff" strokeWidth="2.4" />
      <rect x="23" y="8" width="9" height="9" rx="3" stroke="#fff" strokeWidth="2.4" />
      <rect x="8" y="23" width="9" height="9" rx="3" fill="#8b5cf6" />
      <rect x="23" y="23" width="9" height="9" rx="3" fill="#8b5cf6" />
    </svg>
  );
}

/** The four selling points under the headline. The first one points at the free-delivery section. */
export const FEATURES = [
  { icon: Truck, top: 'Free Delivery', bottom: 'on All Orders', href: '#order-benefits' },
  { icon: ShieldCheck, top: 'Verified', bottom: 'Suppliers' },
  { icon: Database, top: 'Bulk', bottom: 'Pricing' },
  { icon: Zap, top: 'Fast', bottom: 'Quotations' },
];

/** The four figures in the search panel, as printed in the design. */
export const STATS = [
  { icon: Factory, value: '5000+', label: 'Verified Manufacturers', tone: 'purple' },
  { icon: Box, value: '1M+', label: 'Bulk Products', tone: 'brown' },
  { icon: Globe, value: '120+', label: 'Trade Countries', tone: 'blue' },
  { icon: Gavel, value: '10,000+', label: 'Live RFQs & Auctions', tone: 'green' },
];

/** The three lines in the promo banner. */
export const PROMO_POINTS = ['Post Requirement (RFQ)', 'Receive Multiple Quotes', 'Compare & Choose Best Offer'];
