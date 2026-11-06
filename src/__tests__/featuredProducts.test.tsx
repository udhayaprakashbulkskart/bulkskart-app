import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const api = vi.hoisted(() => ({ getMarketplaceProducts: vi.fn(), getCategories: vi.fn() }));
vi.mock('@/lib/api', () => api);

const currency = vi.hoisted(() => ({
  formatPrice: (n: number) => `$${n}`,
  countryConfig: { code: 'US', currency: 'USD' },
  currencyInfo: { currency: 'USD', rate: 83.5 },
  setCountry: () => undefined,
}));
vi.mock('@/contexts/CurrencyContext', () => ({ useCurrency: () => currency }));

// the quote form is its own feature: here it only has to open with the right product
vi.mock('@/components/home/QuickQuoteModal', () => ({
  default: ({ product, open }: { product: { name: string } | null; open: boolean }) =>
    open ? <div role="dialog" aria-label="Quick quote">{product?.name}</div> : null,
}));
// the real picture component talks to the database; a plain picture is enough here
vi.mock('@/components/common/SafeImage', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

import FeaturedProductsSection from '@/components/home/FeaturedProductsSection';
import ProductsShowcase, { type ShowcaseCategory, type ShowcaseProduct } from '@/components/home/products/ProductsShowcase';
import { describeMoq } from '@/components/home/products/format';

describe('Featured Products: minimum order and price unit', () => {
  it('writes the quantity and the unit in words, from the product\'s own MOQ text', () => {
    expect(describeMoq('MOQ: 10 Pcs')).toEqual({ qty: '10', unit: 'Pieces', priceUnit: 'Piece', text: '10 Pieces' });
    expect(describeMoq('MOQ: 5,000 Pcs').text).toBe('5,000 Pieces');
    expect(describeMoq('MOQ: 500 meters')).toMatchObject({ unit: 'Meters', priceUnit: 'Meter', text: '500 Meters' });
    expect(describeMoq('MOQ: 20 MT')).toMatchObject({ unit: 'MT', priceUnit: 'MT', text: '20 MT' });
    expect(describeMoq('MOQ: 200 Sets').priceUnit).toBe('Set');
    expect(describeMoq('MOQ: 1 Container')).toMatchObject({ unit: 'Container', text: '1 Container' });
  });

  it('uses the singular for a quantity of one and keeps the plural for the price unit\'s sake', () => {
    expect(describeMoq('MOQ: 1 Unit')).toMatchObject({ unit: 'Unit', priceUnit: 'Unit', text: '1 Unit' });
    expect(describeMoq('MOQ: 2 Units')).toMatchObject({ unit: 'Units', priceUnit: 'Unit', text: '2 Units' });
    expect(describeMoq('MOQ: 1 Pcs')).toMatchObject({ unit: 'Piece', text: '1 Piece' });
  });

  it('keeps a unit it does not know, and does not invent a quantity when there is none', () => {
    expect(describeMoq('MOQ: 40 Drums')).toMatchObject({ unit: 'Drums', priceUnit: 'Drums', text: '40 Drums' });
    expect(describeMoq('MOQ: On request')).toEqual({ qty: '', unit: 'Units', priceUnit: 'Unit', text: 'On request' });
    expect(describeMoq('').text).toBe('On request');
    expect(describeMoq(undefined).qty).toBe('');
  });
});

const range: ShowcaseProduct = {
  id: 'p-1',
  name: 'Commercial Gas Range (2 Burner) – SS 304',
  href: '/products/commercial-gas-range',
  img: 'https://images.unsplash.com/photo-1?auto=format',
  categoryName: 'Machinery',
  price: '₹13,77,750',
  priceTitle: '₹13,77,750 - ₹14,10,000',
  priceUnit: 'Piece',
  moq: describeMoq('MOQ: 10 Pcs'),
  supplier: 'Shenzhen MicroTech Manufacturer',
  verified: true,
  country: 'China',
  flag: '🇨🇳',
};
const cable: ShowcaseProduct = {
  id: 'p-2',
  name: 'HV Copper XLPE Power Cable 11kV Armoured',
  href: '/products/hv-copper-cable',
  img: 'https://images.unsplash.com/photo-2?auto=format',
  price: '₹710',
  priceUnit: 'Meter',
  moq: describeMoq('MOQ: 10 Pcs'),
  supplier: 'Mekong Delta Commodities',
  verified: false,
  country: 'Vietnam',
  flag: '🇻🇳',
};
const categories: ShowcaseCategory[] = [
  { id: 'all', label: 'All Products' },
  { id: 'machinery', label: 'Machinery' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'apparel', label: 'Apparel' },
  { id: 'home-garden', label: 'Home & Garden' },
];

function setup(overrides: Partial<React.ComponentProps<typeof ProductsShowcase<ShowcaseProduct>>> = {}) {
  const props = {
    products: [range, cable],
    status: 'ready' as const,
    error: null,
    onRetry: vi.fn(),
    onClearFilters: vi.fn(),
    categories,
    selectedCategory: 'all',
    onCategoryChange: vi.fn(),
    toolbar: <input aria-label="Search products" />,
    favourites: new Set<string>(),
    onToggleFavourite: vi.fn(),
    onBuy: vi.fn(),
    isRotating: false,
    batchKey: 0,
    shown: 2,
    total: 5355,
    hasMore: true,
    loadingMore: false,
    onLoadMore: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <ProductsShowcase {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.info.mockClear();
  api.getMarketplaceProducts.mockReset();
  api.getCategories.mockReset();
  localStorage.clear();
});

describe('Featured Products: heading, points and filters', () => {
  it('shows the title and the line under it as printed in the design', () => {
    setup();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Verified Bulk Products');
    const line = screen.getByText('100% Verified Manufacturers').closest('p') as HTMLElement;
    expect(line).toHaveTextContent('100% Verified Manufacturers•Wholesale Only•Min. Order 10 Pieces•Free Delivery');
  });

  it('shows the four points in the strip', () => {
    setup();
    const points = within(screen.getByRole('list', { name: 'Bulk buying at a glance' }));
    for (const text of ['Verified', 'Manufacturers', 'Bulk', 'Pricing', 'MOQ', 'Min. 10 Pieces', 'Free', 'Delivery']) {
      expect(points.getByText(text)).toBeInTheDocument();
    }
  });

  it('has a chip for every category, marks the chosen one and reports a pick', () => {
    const props = setup({ selectedCategory: 'machinery' });
    const group = within(screen.getByRole('group', { name: 'Filter products by category' }));
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(['All Products', 'Machinery', 'Electronics', 'Apparel', 'Home & Garden']);
    expect(group.getByRole('button', { name: 'Machinery' })).toHaveAttribute('aria-pressed', 'true');
    expect(group.getByRole('button', { name: 'All Products' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(group.getByRole('button', { name: 'Electronics' }));
    expect(props.onCategoryChange).toHaveBeenCalledWith('electronics');
  });

  it('puts the search and filter controls the page gives it under the chips', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Search products' })).toBeInTheDocument();
  });
});

describe('Featured Products: cards', () => {
  it('shows a card with the badge, name, price, minimum order, free delivery, supplier and country', () => {
    setup();
    const card = within(screen.getAllByRole('article')[0]);
    expect(card.getByText('Verified Product')).toBeInTheDocument();
    expect(card.getByRole('heading', { level: 3 })).toHaveTextContent('Commercial Gas Range (2 Burner) – SS 304');
    expect(card.getByText('₹13,77,750')).toBeInTheDocument();
    expect(card.getByText('/ Piece')).toBeInTheDocument();
    expect(card.getByText(/Minimum Order:/)).toHaveTextContent('Minimum Order: 10 Pieces');
    expect(card.getByText('Free Delivery')).toBeInTheDocument();
    expect(card.getByText('Shenzhen MicroTech Manufacturer')).toBeInTheDocument();
    expect(card.getByText('China')).toBeInTheDocument();
    expect(card.getByRole('button', { name: /Buy in Bulk \(Min\. 10 Pieces\)/ })).toBeInTheDocument();
  });

  it('shows the full price range as a tooltip when the product has one', () => {
    setup();
    expect(screen.getByText('₹13,77,750').closest('p')).toHaveAttribute('title', '₹13,77,750 - ₹14,10,000');
  });

  it('leads to the product from the picture and from the name', () => {
    setup();
    const card = within(screen.getAllByRole('article')[0]);
    expect(card.getByRole('link', { name: 'Commercial Gas Range (2 Burner) – SS 304' })).toHaveAttribute('href', '/products/commercial-gas-range');
    expect(card.getByRole('link', { name: 'View Commercial Gas Range (2 Burner) – SS 304' })).toHaveAttribute('href', '/products/commercial-gas-range');
  });

  it('shows the verified badge and seal only for a verified supplier', () => {
    setup();
    const [verified, plain] = screen.getAllByRole('article');
    expect(within(verified).getByText('Verified Product')).toBeInTheDocument();
    expect(verified.querySelector('.pv-seal')).not.toBeNull();
    expect(within(plain).queryByText('Verified Product')).not.toBeInTheDocument();
    expect(plain.querySelector('.pv-seal')).toBeNull();
  });

  it('opens the quote form from Buy in Bulk', () => {
    const props = setup();
    fireEvent.click(within(screen.getAllByRole('article')[1]).getByRole('button', { name: /Buy in Bulk/ }));
    expect(props.onBuy).toHaveBeenCalledWith(cable);
  });

  it('says only "Buy in Bulk" when the product has no minimum quantity to quote', () => {
    setup({ products: [{ ...range, moq: describeMoq('MOQ: On request') }] });
    expect(screen.getByRole('button', { name: 'Buy in Bulk' })).toBeInTheDocument();
    expect(screen.getByText(/Minimum Order:/)).toHaveTextContent('Minimum Order: On request');
  });

  it('saves and removes a product from the wishlist with the heart', () => {
    const props = setup({ favourites: new Set(['p-2']) });
    const [first, second] = screen.getAllByRole('article');
    const heartOff = within(first).getByRole('button', { name: /Save .* to your wishlist/ });
    const heartOn = within(second).getByRole('button', { name: /Remove .* from your wishlist/ });
    expect(heartOff).toHaveAttribute('aria-pressed', 'false');
    expect(heartOn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(heartOff);
    expect(props.onToggleFavourite).toHaveBeenCalledWith(range);
  });
});

describe('Featured Products: loading, empty and error states, and the end of the list', () => {
  it('shows placeholder cards while the first products load', () => {
    setup({ products: [], status: 'loading' });
    const grid = document.querySelector('.pv-grid') as HTMLElement;
    expect(grid).toHaveAttribute('aria-busy', 'true');
    expect(grid.querySelectorAll('.pv-card.is-skeleton')).toHaveLength(4);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('shows the error with a retry button', () => {
    const props = setup({ products: [], status: 'error', error: 'Unable to load products. Please check connection and try again.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load products. Please check connection and try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry Loading Catalog' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('says so when no product matches, and clears the filters', () => {
    const props = setup({ products: [], status: 'empty' });
    expect(screen.getByRole('heading', { name: 'No products match your criteria' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('counts what is shown, loads more, and links to every product', () => {
    const props = setup();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Showing 2 of 5,355+ wholesale products')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Load More Products/ }));
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /View All Products/ })).toHaveAttribute('href', '/products');
  });

  it('disables the button while more products are loading', () => {
    setup({ loadingMore: true });
    expect(screen.getByRole('button', { name: /Loading Catalog Products/ })).toBeDisabled();
  });

  it('shows the end of the catalog instead of the button when there is no more', () => {
    setup({ hasMore: false });
    expect(screen.queryByRole('button', { name: /Load More Products/ })).not.toBeInTheDocument();
    expect(screen.getByText(/You've reached the end of the filtered catalog/)).toBeInTheDocument();
  });

  it('dims the cards while a new batch is on its way in', () => {
    setup({ isRotating: true });
    expect(document.querySelector('.pv-grid')).toHaveClass('is-rotating');
  });
});

/** One product as the database sends it. */
const dbProduct = {
  id: 'db-1',
  name: 'Hydraulic Press 200T',
  slug: 'hydraulic-press-200t',
  images: ['https://images.unsplash.com/photo-9?auto=format'],
  specifications: 'Heavy duty',
  tags: [],
  moq: 10,
  moq_unit: 'Pcs',
  price_min: 12.5,
  price_max: 12.5,
  company_id: 'co-9',
  created_at: '2026-01-01T00:00:00Z',
  categories: { slug: 'machinery-industrial', name: 'Machinery' },
  companies: { id: 'co-9', company_name: 'Acme Works', country: 'China', verification_status: 'verified', rating_avg: 4.8, review_count: 12, owner_id: 'u-9' },
};

function renderSection() {
  return render(
    <MemoryRouter>
      <FeaturedProductsSection />
    </MemoryRouter>,
  );
}

describe('Featured Products: the section with its products and filters', () => {
  beforeEach(() => {
    api.getCategories.mockResolvedValue([{ id: 'cat-mach', slug: 'machinery-industrial', name: 'Machinery' }]);
    api.getMarketplaceProducts.mockResolvedValue({ products: [], totalCount: 0, hasMore: true });
  });

  it('shows the new design with a full first screen of cards before anything has loaded', () => {
    renderSection();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Verified Bulk Products');
    const chips = within(screen.getByRole('group', { name: 'Filter products by category' })).getAllByRole('button');
    expect(chips.slice(0, 5).map((b) => b.textContent)).toEqual(['All Products', 'Machinery', 'Electronics', 'Apparel', 'Home & Garden']);
    expect(chips).toHaveLength(14);
    expect(screen.getAllByRole('article')).toHaveLength(20);
  });

  it('asks for the right category and writes a card from the product\'s own data', async () => {
    api.getMarketplaceProducts.mockResolvedValue({ products: [dbProduct], totalCount: 1, hasMore: false });
    renderSection();
    await waitFor(() => expect(api.getCategories).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Machinery' }));
    await waitFor(() => expect(api.getMarketplaceProducts).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-mach' })));
    const card = await waitFor(() => {
      const found = screen.getAllByRole('article')[0];
      expect(within(found).getByRole('heading', { level: 3 })).toHaveTextContent('Hydraulic Press 200T');
      return within(found);
    });
    expect(card.getByText('$12.5')).toBeInTheDocument();
    expect(card.getByText('/ Piece')).toBeInTheDocument();
    expect(card.getByText(/Minimum Order:/)).toHaveTextContent('Minimum Order: 10 Pieces');
    expect(card.getByText('Acme Works')).toBeInTheDocument();
    expect(card.getByText('China')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Hydraulic Press 200T' })).toHaveAttribute('href', '/products/hydraulic-press-200t');
  });

  it('opens the quote form for the product on its card', async () => {
    api.getMarketplaceProducts.mockResolvedValue({ products: [dbProduct], totalCount: 1, hasMore: false });
    renderSection();
    await waitFor(() => expect(api.getCategories).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Machinery' }));
    await waitFor(() => expect(within(screen.getAllByRole('article')[0]).getByRole('heading', { level: 3 })).toHaveTextContent('Hydraulic Press 200T'));
    expect(screen.queryByRole('dialog', { name: 'Quick quote' })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /Buy in Bulk/ }));
    expect(screen.getByRole('dialog', { name: 'Quick quote' })).toHaveTextContent('Hydraulic Press 200T');
  });

  it('keeps the wishlist in the same place as before', () => {
    renderSection();
    const first = screen.getAllByRole('article')[0];
    const name = within(first).getByRole('heading', { level: 3 }).textContent as string;
    fireEvent.click(within(first).getByRole('button', { name: /to your wishlist/ }));
    expect(toastMock.success).toHaveBeenCalledWith(`Saved "${name}" to Wishlist`);
    expect(JSON.parse(localStorage.getItem('bulkskart_product_wishlist') as string)).toHaveLength(1);
    expect(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /from your wishlist/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('searches after the visitor stops typing, and can clear the search', async () => {
    renderSection();
    const box = screen.getByRole('textbox', { name: 'Search products' });
    fireEvent.change(box, { target: { value: 'bearing' } });
    await waitFor(() => expect(api.getMarketplaceProducts).toHaveBeenCalledWith(expect.objectContaining({ search: 'bearing' })), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(box).toHaveValue('');
  });

  it('loads the next page from the button', async () => {
    api.getMarketplaceProducts.mockResolvedValue({ products: [dbProduct], totalCount: 40, hasMore: true });
    renderSection();
    const more = await screen.findByRole('button', { name: /Load More Products/ });
    fireEvent.click(more);
    await waitFor(() => expect(api.getMarketplaceProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });

  it('opens the filters drawer', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(await screen.findByText('Marketplace Filters')).toBeInTheDocument();
  });
});
