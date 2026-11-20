import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DesktopHomeHero from '@/components/home/desktop/DesktopHomeHero';
import HeroSection3D from '@/components/home/HeroSection3D';
import indexHtml from '../../index.html?raw';

const mocks = vi.hoisted(() => ({ phone: false }));

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

beforeEach(() => {
  mocks.phone = false;
  window.matchMedia = ((query: string) => ({
    matches: mocks.phone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
});

const popular = [
  { name: 'Textile', query: 'cotton fabric yarn' }, { name: 'Steel', query: 'steel pipe rebar sheet' },
  { name: 'Chemical', query: 'polymers dyes industrial' }, { name: 'Plastic', query: 'granules polymer hdpe' },
  { name: 'Machinery', query: 'generator motor equipment' }, { name: 'Agriculture', query: 'spices grains coffee' },
  { name: 'Packaging', query: 'corrugated boxes cartons' }, { name: 'Electrical', query: 'cables transformers switchgear' },
];

describe('desktop home (wide screens)', () => {
  const setup = () => {
    const props = {
      searchQuery: '', onSearchQueryChange: vi.fn(), selectedType: 'products' as const, onSelectedTypeChange: vi.fn(),
      onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()), popular, onQuickTag: vi.fn(),
    };
    render(<MemoryRouter><DesktopHomeHero {...props} /></MemoryRouter>);
    return props;
  };

  it('has one h1 with the headline and the design\'s sentence', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Buy in Bulk.Grow Bigger.');
    expect(screen.getByText('Global B2B Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Connect with verified manufacturers, suppliers and bulk buyers worldwide.')).toBeInTheDocument();
  });

  it('links the six category squares to the same searches as the phone', () => {
    setup();
    const hrefs = within(screen.getByRole('navigation', { name: 'Product categories' }))
      .getAllByRole('link')
      .map((a) => `${a.textContent}=${a.getAttribute('href')}`);
    expect(hrefs).toEqual([
      'Machinery=/products?q=machinery',
      'Packaging=/products?q=packaging',
      'Electrical=/products?q=electrical',
      'Textile=/products?q=textile',
      'Chemicals=/products?q=chemicals',
      'More=/products',
    ]);
  });

  it('shows the four selling points and keeps "Free Delivery" pointing at the order benefits section', () => {
    setup();
    for (const text of ['Free Delivery', 'on All Orders', 'Verified', 'Suppliers', 'Bulk', 'Pricing', 'Fast', 'Quotations']) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('link', { name: /Free Delivery/ })).toHaveAttribute('href', '#order-benefits');
  });

  it('keeps the two calls to action and their links', () => {
    setup();
    expect(screen.getByRole('link', { name: /Explore Marketplace/ })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: /Post a Requirement/ })).toHaveAttribute('href', '/post-requirement');
  });

  it('keeps the search choices and hands changes to the page', () => {
    const props = setup();
    const panel = screen.getByRole('search');
    const select = within(panel).getByRole('combobox');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Products', 'Manufacturers', 'Live RFQs']);
    fireEvent.change(select, { target: { value: 'rfqs' } });
    expect(props.onSelectedTypeChange).toHaveBeenCalledWith('rfqs');
    fireEvent.change(within(panel).getByRole('textbox'), { target: { value: 'coil' } });
    expect(props.onSearchQueryChange).toHaveBeenCalledWith('coil');
    fireEvent.submit(panel);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows all eight popular searches and runs the one that is clicked', () => {
    const props = setup();
    for (const { name } of popular) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Steel' }));
    expect(props.onQuickTag).toHaveBeenCalledWith('steel pipe rebar sheet');
  });

  it('shows the four figures as printed in the design', () => {
    setup();
    const stats = within(document.querySelector('.dh-stats') as HTMLElement);
    for (const text of ['5000+', 'Verified Manufacturers', '1M+', 'Bulk Products', '120+', 'Trade Countries', '10,000+', 'Live RFQs & Auctions']) {
      expect(stats.getByText(text)).toBeInTheDocument();
    }
  });

  it('has the promo banner linking to the RFQ form, with its three points', () => {
    setup();
    const promo = screen.getByRole('link', { name: /Post a requirement and get bulk quotations/ });
    expect(promo).toHaveAttribute('href', '/post-requirement');
    for (const text of ['Post Requirement (RFQ)', 'Receive Multiple Quotes', 'Compare & Choose Best Offer']) {
      expect(within(promo).getByText(text)).toBeInTheDocument();
    }
  });

  it('draws the dots under the hero as decoration only', () => {
    setup();
    expect(document.querySelector('.dh-dots')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('home hero picks the layout by screen width', () => {
  const renderHero = () =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<><HeroSection3D /><Where /></>} />
        </Routes>
      </MemoryRouter>,
    );

  it('draws the wide-screen layout on a wide screen and the phone layout on a phone, never both', () => {
    renderHero();
    expect(document.querySelector('.dh-hero')).not.toBeNull();
    expect(document.querySelector('.mh-hero')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('draws only the phone layout under 768px', () => {
    mocks.phone = true;
    renderHero();
    expect(document.querySelector('.mh-hero')).not.toBeNull();
    expect(document.querySelector('.dh-hero')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('searches products, manufacturers and live RFQs like the old hero did', () => {
    renderHero();
    const panel = screen.getByRole('search');
    const box = within(panel).getByRole('textbox');
    const select = within(panel).getByRole('combobox');

    fireEvent.submit(panel);
    expect(screen.getByTestId('where')).toHaveTextContent('/products');

    fireEvent.change(box, { target: { value: 'pumps' } });
    fireEvent.change(select, { target: { value: 'manufacturers' } });
    fireEvent.submit(panel);
    expect(screen.getByTestId('where')).toHaveTextContent('/manufacturers?q=pumps');

    fireEvent.change(box, { target: { value: 'coil' } });
    fireEvent.change(select, { target: { value: 'rfqs' } });
    fireEvent.submit(panel);
    expect(screen.getByTestId('where')).toHaveTextContent('/auctions/reverse?search=coil');

    fireEvent.change(select, { target: { value: 'products' } });
    fireEvent.change(box, { target: { value: 'steel pipes' } });
    fireEvent.submit(panel);
    expect(screen.getByTestId('where')).toHaveTextContent('/products?q=steel%20pipes');
  });

  it('opens a popular search as a products search', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: 'Steel' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/products?q=steel%20pipe%20rebar%20sheet');
  });
});

describe('hero picture preload for wide screens (index.html)', () => {
  it('starts loading the wide-screen hero picture early, and only for the home page', () => {
    const tag = indexHtml.match(/<link id="dh-hero-preload"[^>]*>/)?.[0] ?? '';
    // Vite rewrites this path to the fingerprinted file the hero imports, so it must be the same source file.
    expect(tag).toContain('href="/src/assets/desktop-home/hero-art-2x.webp"');
    expect(tag).toContain('rel="preload"');
    expect(tag).toContain('as="image"');
    // inert until the small script switches it on
    expect(tag).toContain('media="not all"');
    expect(indexHtml).toContain("window.location.pathname === '/'");
    expect(indexHtml).toContain("phone ? 'mh-hero-preload' : 'dh-hero-preload'");
  });
});
