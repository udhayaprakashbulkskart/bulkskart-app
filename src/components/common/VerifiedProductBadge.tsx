import { CheckCircle } from 'lucide-react';
import { isVerifiedProduct } from '@/lib/verifiedProduct';
import './verified-product-badge.css';

/**
 * Green check + "Verified product" — shown only when the product carries the verified-product tag.
 */
export default function VerifiedProductBadge({
  product,
  className = '',
  size = 'md',
  onPhoto = false,
}: {
  product: { tags?: string[] | null } | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
  onPhoto?: boolean;
}) {
  if (!isVerifiedProduct(product)) return null;
  const sizing = size === 'sm'
    ? 'gap-0.5 px-1.5 py-0.5 text-[10px]'
    : 'gap-1 px-2.5 py-1 text-[11px]';
  const icon = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';
  return (
    <span
      className={`verified-product-badge${onPhoto ? ' verified-product-badge--on-photo' : ''} inline-flex shrink-0 items-center rounded-full border font-bold leading-none ${sizing} ${className}`}
      title="Verified product"
    >
      <CheckCircle className={icon} aria-hidden="true" />
      Verified product
    </span>
  );
}
