import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isVerifiedProduct, visibleProductTags, VERIFIED_PRODUCT_TAG } from '@/lib/verifiedProduct';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('verified product badge', () => {
  it('is true only when the product carries the verified-product tag', () => {
    expect(isVerifiedProduct({ tags: [VERIFIED_PRODUCT_TAG] })).toBe(true);
    expect(isVerifiedProduct({ tags: ['Verified-Product'] })).toBe(true);
    expect(isVerifiedProduct({ tags: ['commercial-kitchen'] })).toBe(false);
    expect(isVerifiedProduct({ tags: null })).toBe(false);
    expect(isVerifiedProduct(null)).toBe(false);
  });

  it('hides the verified tag from ordinary tag chips', () => {
    expect(visibleProductTags(['verified-product', 'gas-range'])).toEqual(['gas-range']);
  });

  it('the product detail, directory, storefront and home cards render the badge', () => {
    expect(src('src/pages/ProductDetailPage.tsx')).toContain('VerifiedProductBadge');
    expect(src('src/pages/ProductsPage.tsx')).toContain('VerifiedProductBadge');
    expect(src('src/pages/CompanyProfilePage.tsx')).toContain('VerifiedProductBadge');
    expect(src('src/components/home/FeaturedProductsSection.tsx')).toContain('product.isVerifiedProduct');
    expect(src('src/components/common/VerifiedProductBadge.tsx')).toContain('Verified product');
  });
});
