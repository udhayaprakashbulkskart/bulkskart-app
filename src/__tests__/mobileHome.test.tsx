import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, profile: null as null | { full_name: string }, displayName: '' },
  phone: true,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/contexts/CurrencyContext', () => ({
  useCountry: () => ({
    countryConfig: { code: 'IN', name: 'India', primaryLang: 'en', taxLabel: '18% GST' },
    setCountry: vi.fn(),
    availableCountries: [],
    autoDetectedSource: 'auto',
  }),
}));
vi.mock('@/components/common/NotificationBell', () => ({
  default: () => <button type="button" className="mh-bell" aria-label="Notifications (30 unread)" />,
}));

import MobileHomeHeader from '@/components/home/mobile/MobileHomeHeader';
import MobileHomeHero from '@/components/home/mobile/MobileHomeHero';
import MobileHomeNav from '@/components/home/mobile/MobileHomeNav';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

beforeEach(() => {
  mocks.auth = { user: null, profile: null, displayName: '' };
  mocks.phone = true;
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

describe('mobile home header', () => {
  const renderHeader = (onMenu = vi.fn()) =>
    render(
      <MemoryRouter>
        <MobileHomeHeader dashboardHref="/dashboard/buyer" onMenu={onMenu} />
        <Where />
      </MemoryRouter>,
    );

  it('shows Sign In, not the bell and avatar, to a visitor', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/auth');
    expect(screen.queryByLabelText(/Notifications/)).toBeNull();
  });

  it('shows the bell and the initial of a signed-in user, linking to their dashboard', () => {
    mocks.auth = { user: { id: 'u1', email: 'suresh@example.com' }, profile: { full_name: 'Suresh' }, displayName: 'Suresh' };
    renderHeader();
    expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument();
    const avatar = screen.getByRole('link', { name: 'My account' });
    expect(avatar).toHaveTextContent('S');
    expect(avatar).toHaveAttribute('href', '/dashboard/buyer');
  });

  it('opens the slide-in menu from the hamburger', () => {
    const onMenu = vi.fn();
    renderHeader(onMenu);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('searches products from the search bar, and ignores an empty search', () => {
    renderHeader();
    const form = screen.getByRole('search');
    fireEvent.submit(form);
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    fireEvent.change(within(form).getByRole('textbox'), { target: { value: 'steel pipes' } });
    fireEvent.submit(form);
    expect(screen.getByTestId('where')).toHaveTextContent('/products?q=steel%20pipes');
  });

  it('links the six category squares to the same searches as before', () => {
    renderHeader();
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
});

describe('mobile home hero, search panel, stats and promo', () => {
  const popular = [
    { name: 'Textile', query: 'cotton fabric yarn' }, { name: 'Steel', query: 'steel pipe rebar sheet' },
    { name: 'Chemical', query: 'polymers dyes industrial' }, { name: 'Plastic', query: 'granules polymer hdpe' },
    { name: 'Machinery', query: 'generator motor equipment' }, { name: 'Agriculture', query: 'spices grains coffee' },
    { name: 'Packaging', query: 'corrugated boxes cartons' }, { name: 'Electrical', query: 'cables transformers switchgear' },
  ];
  const setup = () => {
    const props = {
      searchQuery: '', onSearchQueryChange: vi.fn(), selectedType: 'products' as const, onSelectedTypeChange: vi.fn(),
      onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()), popular, onQuickTag: vi.fn(),
    };
    render(<MemoryRouter><MobileHomeHero {...props} /></MemoryRouter>);
    return props;
  };

  it('has one h1 with the headline and the design\'s sentence', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Buy in Bulk.Grow Bigger.');
    expect(screen.getByText('Connect with verified manufacturers, suppliers and bulk buyers worldwide.')).toBeInTheDocument();
  });

  it('keeps the two calls to action and their links', () => {
    setup();
    expect(screen.getByRole('link', { name: /Explore Marketplace/ })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: /Post a Requirement/ })).toHaveAttribute('href', '/post-requirement');
  });

  it('still points "Free Delivery" at the order benefits section', () => {
    setup();
    expect(screen.getByRole('link', { name: /Free Delivery/ })).toHaveAttribute('href', '#order-benefits');
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

  it('shows all eight popular searches and runs the one that is tapped', () => {
    const props = setup();
    for (const { name } of popular) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Steel' }));
    expect(props.onQuickTag).toHaveBeenCalledWith('steel pipe rebar sheet');
  });

  it('shows the four figures and the promo banner linking to the RFQ form', () => {
    setup();
    const stats = within(document.querySelector('.mh-stats') as HTMLElement);
    for (const text of ['5000+', 'Verified Manufacturers', '1M+', 'Bulk Products', '120+', 'Trade Countries', '10,000+', 'Live RFQs & Auctions']) {
      expect(stats.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Post a requirement and get bulk quotations/ })).toHaveAttribute('href', '/post-requirement');
  });

  it('draws the dots under the hero as decoration only (there is one hero slide)', () => {
    setup();
    expect(document.querySelector('.mh-dots')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('mobile home bottom bar', () => {
  const renderNav = () => render(<MemoryRouter initialEntries={['/']}><MobileHomeNav /></MemoryRouter>);

  it('has the five buttons, in order, going to existing pages', () => {
    renderNav();
    const links = within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link');
    expect(links.map((a) => `${a.textContent}=${a.getAttribute('href')}`)).toEqual([
      'Home=/', 'Categories=/categories', 'Post RFQ=/post-requirement', 'RFQs=/requirements', 'Suppliers=/manufacturers',
    ]);
  });

  it('marks the current page', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Suppliers' })).not.toHaveAttribute('aria-current');
  });

  it('is not drawn on a wide screen', () => {
    mocks.phone = false;
    renderNav();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
  });
});

describe('routing helper', () => {
  it('renders inside a router (sanity check for the helpers above)', () => {
    render(<MemoryRouter><Routes><Route path="/" element={<Where />} /></Routes></MemoryRouter>);
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });
});
