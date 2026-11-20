import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

import SuppliersShowcase, { type CountryChip, type ShowcaseSupplier } from '@/components/home/suppliers/SuppliersShowcase';
import { Flag, hasFlag } from '@/components/home/suppliers/flags';
import { activeDot, dotTarget, nearestCard, nextScrollStep } from '@/components/home/suppliers/scroll';

const rich: ShowcaseSupplier = {
  id: 'co-1',
  name: 'Osaka MicroCircuit Co., Ltd.',
  slug: 'osaka-microcircuit',
  country: 'Japan',
  flag: '🇯🇵',
  img: 'https://images.unsplash.com/photo-1?auto=format',
  tags: ['PCB Assembly', 'Electronics', 'OEM / ODM'],
  yearsInBusiness: 15,
  totalProducts: 1200,
  exportsGlobally: true,
};
const plain: ShowcaseSupplier = {
  id: 'ref-2',
  name: 'Shakti Electricals',
  country: 'India',
  flag: '🇮🇳',
  img: 'https://images.unsplash.com/photo-2?auto=format',
  tags: ['Switchgear'],
};

const chips: CountryChip[] = [
  { key: 'India', label: 'India', flag: '🇮🇳' },
  { key: 'China', label: 'China', flag: '🇨🇳' },
  { key: 'USA', label: 'USA', flag: '🇺🇸' },
  { key: 'Germany', label: 'Germany', flag: '🇩🇪' },
];
const moreChips: CountryChip[] = [
  { key: 'UAE', label: 'UAE', flag: '🇦🇪' },
  { key: 'Japan', label: 'Japan', flag: '🇯🇵' },
];

function setup(overrides: Partial<React.ComponentProps<typeof SuppliersShowcase<ShowcaseSupplier>>> = {}) {
  const props = {
    suppliers: [rich, plain],
    selectedCountry: 'all',
    onCountryChange: vi.fn(),
    chips,
    moreChips,
    secondsLeft: 30,
    isRefreshing: false,
    onRefresh: vi.fn(),
    error: null,
    onRetry: vi.fn(),
    onOpenSupplier: vi.fn(),
    renderLogo: (s: ShowcaseSupplier) => <span data-testid="logo">{s.name.slice(0, 2).toUpperCase()}</span>,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <SuppliersShowcase {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => {
  toastMock.success.mockClear();
  localStorage.clear();
});

describe('Verified Suppliers: heading, figures and filters', () => {
  it('shows the title, the line under it and the live update pill', () => {
    setup();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Verified Suppliers');
    expect(screen.getByText('Trusted Manufacturers & Exporters Worldwide')).toBeInTheDocument();
    expect(screen.getByText('Live Update: 30s')).toBeInTheDocument();
    // the countdown is not read out every second; screen readers get one steady line instead
    expect(screen.getByText('Live update: the suppliers change every 30 seconds')).toHaveClass('sr-only');
  });

  it('refreshes the suppliers when the pill\'s button is pressed', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Show the next verified suppliers now/ }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the four figures as printed in the design', () => {
    setup();
    const figures = within(screen.getByRole('list', { name: 'Verified suppliers at a glance' }));
    for (const text of ['10,000+', 'Verified Suppliers', '120+', 'Countries', '50+', 'Industries', '100%', 'Verified Profiles']) {
      expect(figures.getByText(text)).toBeInTheDocument();
    }
  });

  it('has All Global, four countries and a More menu, and tells the page which one was picked', () => {
    const props = setup();
    const group = within(screen.getByRole('group', { name: 'Filter suppliers by country' }));
    expect(group.getByRole('button', { name: 'All Global' })).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['India', 'China', 'USA', 'Germany']) expect(group.getByRole('button', { name: label })).toBeInTheDocument();
    expect(group.getByRole('button', { name: 'More countries' })).toHaveTextContent('More');
    fireEvent.click(group.getByRole('button', { name: 'China' }));
    expect(props.onCountryChange).toHaveBeenCalledWith('China');
  });

  it('marks the chosen country, and shows a country from the More menu on the More button', () => {
    setup({ selectedCountry: 'Japan' });
    const group = within(screen.getByRole('group', { name: 'Filter suppliers by country' }));
    expect(group.getByRole('button', { name: 'All Global' })).toHaveAttribute('aria-pressed', 'false');
    expect(group.getByRole('button', { name: 'More countries' })).toHaveTextContent('Japan');
  });
});

describe('Verified Suppliers: cards', () => {
  it('shows a card with the badge, name, country, tags, facts and both buttons', () => {
    const props = setup();
    const card = within(screen.getAllByRole('article')[0]);
    expect(card.getByText('Verified Manufacturer')).toBeInTheDocument();
    expect(card.getByRole('heading', { level: 3 })).toHaveTextContent('Osaka MicroCircuit Co., Ltd.');
    expect(card.getByText('Japan')).toBeInTheDocument();
    for (const tag of ['PCB Assembly', 'Electronics', 'OEM / ODM']) expect(card.getByText(tag)).toBeInTheDocument();
    for (const text of ['15+', 'Years', '1,200+', 'Products', 'Global', 'Export']) expect(card.getByText(text)).toBeInTheDocument();
    fireEvent.click(card.getByRole('button', { name: /View Products/ }));
    expect(props.onOpenSupplier).toHaveBeenCalledWith(rich);
    expect(card.getByRole('link', { name: /Send Inquiry/ })).toHaveAttribute('href', '/post-requirement?supplier=co-1');
  });

  it('opens the supplier from its name and its picture too', () => {
    const props = setup();
    const card = within(screen.getAllByRole('article')[0]);
    fireEvent.click(card.getByRole('button', { name: 'Osaka MicroCircuit Co., Ltd.' }));
    fireEvent.click(card.getByRole('button', { name: 'View Osaka MicroCircuit Co., Ltd.' }));
    expect(props.onOpenSupplier).toHaveBeenCalledTimes(2);
  });

  it('shows only the facts a supplier has, and keeps every card the same height', () => {
    setup();
    const card = screen.getAllByRole('article')[1];
    expect(card.querySelector('.vs-facts')).toHaveClass('is-empty');
    expect(card.querySelector('.vs-rule')).toHaveClass('is-empty');
    expect(card.querySelector('.vs-facts')?.children).toHaveLength(0);
    expect(card.querySelector('.vs-tags')).not.toHaveClass('is-empty');
  });

  it('saves a supplier with the heart, in the same place the manufacturers page keeps its favourites', () => {
    setup();
    const heart = within(screen.getAllByRole('article')[0]).getByRole('button', { name: /Add Osaka MicroCircuit Co., Ltd. to favourites/ });
    fireEvent.click(heart);
    expect(JSON.parse(localStorage.getItem('bulkskart_fav_mfg') || '[]')).toEqual(['co-1']);
    expect(toastMock.success).toHaveBeenCalledWith('Added to Favourites');
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(heart);
    expect(JSON.parse(localStorage.getItem('bulkskart_fav_mfg') || '[]')).toEqual([]);
    expect(toastMock.success).toHaveBeenLastCalledWith('Removed from Favourites');
  });

  it('starts with the suppliers already saved', () => {
    localStorage.setItem('bulkskart_fav_mfg', JSON.stringify(['co-1']));
    setup();
    expect(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /Remove Osaka MicroCircuit Co., Ltd. from favourites/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('numbers the cards for screen readers and links to the full list below', () => {
    setup();
    expect(screen.getAllByRole('article')[1]).toHaveAttribute('aria-label', '2 of 2: Shakti Electricals');
    expect(screen.getByRole('region', { name: 'Verified suppliers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View All Verified Suppliers/ })).toHaveAttribute('href', '/manufacturers');
  });

  it('says so when there are no suppliers, and offers the global list', () => {
    const props = setup({ suppliers: [] });
    expect(screen.getByText('No verified suppliers found for this region.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show All Global Suppliers' }));
    expect(props.onCountryChange).toHaveBeenCalledWith('all');
  });

  it('shows the retry bar when loading failed', () => {
    const props = setup({ error: 'Unable to load verified suppliers.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load verified suppliers.');
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('flags', () => {
  it('draws a flag for the countries in the design, under the names the data uses', () => {
    for (const country of ['India', 'China', 'USA', 'Germany', 'Japan', 'UAE', 'South Korea', 'Canada', 'Switzerland', 'Italy', 'Sweden', 'Turkey', 'Vietnam', 'United States', 'United Arab Emirates']) {
      expect(hasFlag(country)).toBe(true);
    }
    const { container } = render(<Flag country="United States" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-flag', 'USA');
  });

  it('falls back to the emoji for a country it does not draw', () => {
    const { container } = render(<Flag country="Narnia" fallback="🌐" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container).toHaveTextContent('🌐');
  });
});

describe('automatic scrolling rules', () => {
  it('moves one card at a time to the right', () => {
    expect(nextScrollStep({ scrollLeft: 0, max: 1000, step: 300, dir: 1 })).toEqual({ target: 300, dir: 1 });
    expect(nextScrollStep({ scrollLeft: 300, max: 1000, step: 300, dir: 1 })).toEqual({ target: 600, dir: 1 });
  });

  it('stops at the end instead of running past it', () => {
    expect(nextScrollStep({ scrollLeft: 900, max: 1000, step: 300, dir: 1 })).toEqual({ target: 1000, dir: 1 });
  });

  it('turns round at the right end and heads back left', () => {
    expect(nextScrollStep({ scrollLeft: 1000, max: 1000, step: 300, dir: 1 })).toEqual({ target: 700, dir: -1 });
    expect(nextScrollStep({ scrollLeft: 700, max: 1000, step: 300, dir: -1 })).toEqual({ target: 400, dir: -1 });
  });

  it('turns round at the left end and heads right again', () => {
    expect(nextScrollStep({ scrollLeft: 0, max: 1000, step: 300, dir: -1 })).toEqual({ target: 300, dir: 1 });
    expect(nextScrollStep({ scrollLeft: 100, max: 1000, step: 300, dir: -1 })).toEqual({ target: 0, dir: -1 });
  });

  it('travels right, then left, then right again over a whole cycle', () => {
    let state = { scrollLeft: 0, dir: 1 as 1 | -1 };
    const visited: number[] = [];
    for (let i = 0; i < 12; i++) {
      const move = nextScrollStep({ ...state, max: 1200, step: 400 });
      expect(move).not.toBeNull();
      state = { scrollLeft: move!.target, dir: move!.dir };
      visited.push(state.scrollLeft);
    }
    expect(visited).toEqual([400, 800, 1200, 800, 400, 0, 400, 800, 1200, 800, 400, 0]);
  });

  it('does nothing when every card already fits', () => {
    expect(nextScrollStep({ scrollLeft: 0, max: 0, step: 300, dir: 1 })).toBeNull();
    expect(nextScrollStep({ scrollLeft: 0, max: 4, step: 300, dir: 1 })).toBeNull();
  });

  it('lights the dot that matches the position and scrolls to a dot when it is clicked', () => {
    expect(activeDot(0, 900, 4)).toBe(0);
    expect(activeDot(450, 900, 4)).toBe(2);
    expect(activeDot(900, 900, 4)).toBe(3);
    expect(activeDot(10, 0, 4)).toBe(0);
    expect(dotTarget(0, 900, 4)).toBe(0);
    expect(dotTarget(3, 900, 4)).toBe(900);
    expect(dotTarget(9, 900, 4)).toBe(900);
  });

  it('finds the card nearest the left edge', () => {
    expect(nearestCard([0, 300, 600, 900], 0)).toBe(0);
    expect(nearestCard([0, 300, 600, 900], 280)).toBe(1);
    expect(nearestCard([0, 300, 600, 900], 880)).toBe(3);
  });
});
