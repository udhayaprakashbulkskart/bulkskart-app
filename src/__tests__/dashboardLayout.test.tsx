import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

vi.mock('@/components/common/NotificationBell', () => ({
  default: ({ className }: { className?: string }) => (
    <button type="button" className={className} aria-label="Notifications">
      bell
    </button>
  ),
}));
vi.mock('@/components/common/CopyPublicProfileButton', () => ({ default: () => <button type="button">Copy public link</button> }));
vi.mock('@/components/common/BrandLogo', () => ({ default: () => <img alt="BulkSkart" src="/logo.png" /> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

import DashboardLayout from '@/components/layouts/DashboardLayout';

function Probe() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <DashboardLayout>
                <p>the page</p>
              </DashboardLayout>
              <Probe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function signIn(role: 'buyer' | 'supplier' | 'admin', overrides: Record<string, unknown> = {}) {
  auth.value = {
    isPaidSubscriber: true,
    signOut: vi.fn(async () => undefined),
    loading: false,
    resolvedRole: role,
    displayName: role === 'supplier' ? 'Priya Nair' : role === 'admin' ? 'Mira Kapoor' : 'Suresh Kumar',
    profile: { role },
    ...overrides,
  };
}

const where = () => screen.getByTestId('where').textContent;
const menu = () => within(screen.getByRole('navigation', { name: 'Dashboard sections' }));

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.message.mockClear();
  document.documentElement.classList.remove('dash-active');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Dashboard shell: the look', () => {
  it('puts the dashboard colours on the whole page while it is open, so pop-ups match', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(document.documentElement).toHaveClass('dash-active');
  });

  // the address bar already shows where the visitor is going when the old page is removed; the tests set it the same way
  const goTo = (path: string) => window.history.pushState({}, '', path);
  afterEach(() => goTo('/'));

  it('takes them off at once when the visitor leaves the dashboard for the rest of the site', () => {
    signIn('buyer');
    const { unmount } = renderAt('/dashboard/buyer');
    goTo('/products');
    unmount();
    expect(document.documentElement).not.toHaveClass('dash-active');
  });

  it('takes them off a moment after the last dashboard page is closed, while the address is still a dashboard one', () => {
    vi.useFakeTimers();
    signIn('buyer');
    const { unmount } = renderAt('/dashboard/buyer');
    goTo('/dashboard/buyer/orders');
    unmount();
    expect(document.documentElement).toHaveClass('dash-active');
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(document.documentElement).not.toHaveClass('dash-active');
  });

  it('keeps them on when one dashboard page is replaced by another, so nothing flashes in between', () => {
    vi.useFakeTimers();
    signIn('buyer');
    const first = renderAt('/dashboard/buyer');
    goTo('/dashboard/buyer/orders');
    first.unmount();
    renderAt('/dashboard/buyer/orders');
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(document.documentElement).toHaveClass('dash-active');
  });
});

describe('Dashboard shell: the top bar', () => {
  it('greets the person by first name and says what the role is for', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    expect(screen.getByText('Hi, Priya! Welcome back.')).toBeInTheDocument();
    // the greeting is not a page title, so the page keeps its own single h1
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText('Manage products, leads and quotations')).toBeInTheDocument();
  });

  it('has a different line for a buyer and for an admin', () => {
    signIn('buyer');
    const buyer = renderAt('/dashboard/buyer');
    expect(screen.getByText('Manage your bulk requirements and received quotes')).toBeInTheDocument();
    buyer.unmount();
    signIn('admin');
    renderAt('/dashboard/admin');
    expect(screen.getByText('Monitor users, verifications and disputes')).toBeInTheDocument();
  });

  it('shows the person\'s name, initials and role in the corner, leading to their profile', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    const chip = screen.getByRole('link', { name: 'Priya Nair profile' });
    expect(chip).toHaveAttribute('href', '/dashboard/supplier/profile');
    expect(chip).toHaveTextContent('PN');
    expect(chip).toHaveTextContent('Supplier');
  });

  it('does not greet by name while the account is still loading', () => {
    signIn('buyer', { loading: true, displayName: '' });
    renderAt('/dashboard/buyer');
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('searches the marketplace from the search box', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const box = screen.getByRole('searchbox', { name: 'Search the marketplace for products' });
    fireEvent.change(box, { target: { value: 'HDPE pipe' } });
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    expect(where()).toBe('/products?q=HDPE%20pipe');
  });

  it('does nothing when the search box is empty', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const box = screen.getByRole('searchbox', { name: 'Search the marketplace for products' });
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    expect(where()).toBe('/dashboard/buyer');
  });

  it('jumps to the search box on "/", unless the person is already typing somewhere', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const box = screen.getByRole('searchbox', { name: 'Search the marketplace for products' });
    // jsdom has no layout, so every element looks hidden to the "is it visible" check; make this one count as visible
    Object.defineProperty(box, 'offsetParent', { get: () => document.body });
    fireEvent.keyDown(window, { key: '/' });
    expect(box).toHaveFocus();
    box.blur();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(box).not.toHaveFocus();
    other.remove();
  });

  it('has the bell, the help desk and the marketplace in the corner', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Help desk' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Open the marketplace' })).toHaveAttribute('href', '/');
  });
});

describe('Dashboard shell: the sidebar', () => {
  it('lists every section of a buyer\'s dashboard, and marks the one that is open', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer/orders');
    const labels = menu()
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels.slice(0, 10)).toEqual([
      'Overview',
      'My Requirements',
      'Received Quotes',
      'Orders',
      'Messages',
      'Notifications',
      'Saved Manufacturers',
      'KYC Verification',
      'Disputes',
      'Profile',
    ]);
    expect(menu().getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('keeps the buyer\'s calculators in a Tools list that opens and closes', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const toggle = menu().getByRole('button', { name: 'Tools' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(menu().getByRole('link', { name: 'Shipping Calculator' })).toHaveAttribute('href', '/shipping-calculator');
    expect(menu().getByRole('link', { name: 'Order Loan Calculator' })).toHaveAttribute('href', '/loan-calculator');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(menu().queryByRole('link', { name: 'Shipping Calculator' })).not.toBeInTheDocument();
  });

  it('lists every section of a supplier\'s dashboard and has no Tools list', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    const labels = menu()
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual([
      'Overview',
      'AI Sales Assistant',
      'Business Overview',
      'My Products',
      'Inventory & Stock',
      'RFQ Leads',
      'Quotations',
      'Orders',
      'Messages',
      'Notifications',
      'Verification',
      'Disputes',
      'Analytics',
      'Subscription',
      'Business Profile',
    ]);
    expect(menu().queryByRole('button', { name: 'Tools' })).not.toBeInTheDocument();
  });

  it('marks only Overview on the overview page, not every page under it', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    expect(menu().getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'My Products' })).not.toHaveAttribute('aria-current');
  });

  it('has two sections for an admin', () => {
    signIn('admin');
    renderAt('/dashboard/admin');
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Control Panel', 'AI Match Analytics']);
  });

  it('names the hub on a gold plaque', () => {
    signIn('buyer');
    const buyer = renderAt('/dashboard/buyer');
    expect(screen.getByText('Buyer hub')).toBeInTheDocument();
    buyer.unmount();
    signIn('supplier');
    renderAt('/dashboard/supplier');
    expect(screen.getByText('Supplier hub')).toBeInTheDocument();
  });

  it('has the help desk, the marketplace and sign out at the bottom', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const side = within(screen.getByRole('complementary', { name: 'Dashboard menu' }));
    expect(side.getByRole('link', { name: 'Help Desk' })).toHaveAttribute('href', '/contact');
    expect(side.getByRole('link', { name: 'Market' })).toHaveAttribute('href', '/');
    expect(side.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('signs out and goes to the home page', async () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    });
    expect(auth.value.signOut).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith('Signed out successfully');
    expect(where()).toBe('/');
  });

  it('opens the same menu on a phone from the menu button', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.getAllByRole('complementary', { name: 'Dashboard menu' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    // an open drawer hides the page behind it from screen readers, so the page's own sidebar is looked for with `hidden`
    expect(screen.getAllByRole('complementary', { name: 'Dashboard menu', hidden: true })).toHaveLength(2);
  });
});

describe('Dashboard shell: the clock', () => {
  it('shows the time and date and says the browser is online', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const clock = document.querySelector('.dsh-clock') as HTMLElement;
    expect(clock).toHaveTextContent(/Local time \d{2}:\d{2}/);
    expect(clock).toHaveTextContent('Online');
    expect(clock).not.toHaveClass('is-offline');
  });

  it('says offline when the browser loses its connection, and online again when it is back', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const clock = document.querySelector('.dsh-clock') as HTMLElement;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(clock).toHaveClass('is-offline');
    expect(clock).toHaveTextContent('Offline');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(clock).not.toHaveClass('is-offline');
  });

  it('moves the seconds on', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15, 16, 20, 5));
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const seconds = () => document.querySelector('.dsh-clock-time small')?.textContent;
    expect(seconds()).toBe('05');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(seconds()).toBe('08');
  });
});

describe('Dashboard shell: the rules that were already there', () => {
  it('sends a supplier who opens a buyer page to the supplier dashboard', () => {
    signIn('supplier');
    renderAt('/dashboard/buyer/orders');
    expect(where()).toBe('/dashboard/supplier');
  });

  it('sends a buyer who opens a supplier page to the buyer dashboard', () => {
    signIn('buyer');
    renderAt('/dashboard/supplier/products');
    expect(where()).toBe('/dashboard/buyer');
  });

  it('sends an admin away from the buyer and supplier pages, but not from the admin ones', () => {
    signIn('admin');
    const first = renderAt('/dashboard/buyer');
    expect(where()).toBe('/dashboard/admin');
    first.unmount();
    renderAt('/dashboard/admin/ai-match-analytics');
    expect(where()).toBe('/dashboard/admin/ai-match-analytics');
  });

  it('shows the unpaid banner and flags Subscription for a manufacturer who has not subscribed', () => {
    signIn('supplier', { isPaidSubscriber: false });
    renderAt('/dashboard/supplier/subscription');
    expect(screen.getByText('Unpaid Manufacturer Account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subscribe Now' })).toHaveAttribute('href', '/dashboard/supplier/subscription');
    expect(menu().getByRole('link', { name: /Subscription/ })).toHaveTextContent('Unpaid');
  });

  it('keeps an unpaid manufacturer on the pages they may open', () => {
    signIn('supplier', { isPaidSubscriber: false });
    renderAt('/dashboard/supplier/products');
    expect(where()).toBe('/dashboard/supplier/products');
  });

  it('sends an unpaid manufacturer who opens a locked page to Subscription, and says why', () => {
    signIn('supplier', { isPaidSubscriber: false });
    renderAt('/dashboard/supplier/inventory');
    expect(where()).toBe('/dashboard/supplier/subscription');
    expect(toastMock.message).toHaveBeenCalledWith('Subscription required', expect.anything());
  });

  it('shows no unpaid banner to a paying manufacturer or a buyer', () => {
    signIn('supplier');
    const paid = renderAt('/dashboard/supplier');
    expect(screen.queryByText('Unpaid Manufacturer Account')).not.toBeInTheDocument();
    paid.unmount();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.queryByText('Unpaid Manufacturer Account')).not.toBeInTheDocument();
  });

  it('shows the page it was given', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.getByText('the page')).toBeInTheDocument();
  });
});
