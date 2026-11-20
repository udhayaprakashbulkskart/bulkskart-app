import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/contentImages', () => ({
  resolveCompanyBranding: () => ({ logo: '', banner: '' }),
  resolveRfqImage: () => '',
  resolveProductImage: () => '',
  generateIsolatedProductFallback: () => 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>',
  isGenericImage: () => false,
}));
vi.mock('@/lib/pixabay', () => ({ resolveProductImageBackend: async () => ({ has_image: false }) }));

import SafeImage from '@/components/common/SafeImage';

const URL = 'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&w=450';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SafeImage: the loading cover', () => {
  it('stays on while the picture is still loading', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const { container } = render(<SafeImage src={URL} alt="Pump" />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(container.querySelector('img')).toHaveClass('opacity-0');
  });

  it('does not get stuck on a picture that had already loaded (for example from the cache) before the component was ready', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(720);
    const { container } = render(<SafeImage src={URL} alt="Pump" />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
    expect(container.querySelector('img')).toHaveClass('opacity-100');
  });
});
