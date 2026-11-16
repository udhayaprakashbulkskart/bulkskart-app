import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const labelsOf = (items: HTMLElement[]) => items.map((item) => item.textContent);

describe('Dashboard shell: the top bar', () => {
  it('has the logo, which leads to the home page', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.getByRole('link', { name: 'BulkSkart home' })).toHaveAttribute('href', '/');
  });

  it('shows the five main sections of a buyer as pills, and marks the one that is open', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer/orders');
    expect(labelsOf(menu().getAllByRole('link'))).toEqual(['Overview', 'My Requirements', 'Received Quotes', 'Orders', 'Messages']);
    expect(menu().getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('shows the five main sections of a supplier, and marks only Overview on the overview page', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    expect(labelsOf(menu().getAllByRole('link'))).toEqual(['Overview', 'My Products', 'RFQ Leads', 'Quotations', 'Orders']);
    expect(menu().getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'My Products' })).not.toHaveAttribute('aria-current');
  });

  it('has two sections and no More menu for an admin', () => {
    signIn('admin');
    renderAt('/dashboard/admin');
    expect(labelsOf(menu().getAllByRole('link'))).toEqual(['Control Panel', 'AI Match Analytics']);
    expect(menu().queryByRole('button', { name: /More/ })).not.toBeInTheDocument();
  });

  it('keeps every other section of a buyer under More, with the calculators under Tools', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(menu().getByRole('button', { name: /More/ }));
    // the bar's 4th and 5th sections are listed first: on a narrow bar they move in here
    expect(labelsOf(screen.getAllByRole('menuitem'))).toEqual([
      'Orders',
      'Messages',
      'Notifications',
      'Saved Manufacturers',
      'KYC Verification',
      'Disputes',
      'Profile',
      'Shipping Calculator',
      'Order Loan Calculator',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Shipping Calculator' })).toHaveAttribute('href', '/shipping-calculator');
    expect(screen.getByRole('menuitem', { name: 'Order Loan Calculator' })).toHaveAttribute('href', '/loan-calculator');
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('keeps every other section of a supplier under More and has no Tools list', async () => {
    const user = userEvent.setup();
    signIn('supplier');
    renderAt('/dashboard/supplier');
    await user.click(menu().getByRole('button', { name: /More/ }));
    expect(labelsOf(screen.getAllByRole('menuitem'))).toEqual([
      'Quotations',
      'Orders',
      'AI Sales Assistant',
      'Business Overview',
      'Inventory & Stock',
      'Messages',
      'Notifications',
      'Verification',
      'Disputes',
      'Analytics',
      'Subscription',
      'Business Profile',
    ]);
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
  });

  it('lights More and marks the section that is open inside it', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer/disputes');
    const more = menu().getByRole('button', { name: /More/ });
    expect(more).toHaveClass('is-active');
    await user.click(more);
    expect(screen.getByRole('menuitem', { name: 'Disputes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });

  it('opens a section from the More menu', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(menu().getByRole('button', { name: /More/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Saved Manufacturers' }));
    expect(where()).toBe('/dashboard/buyer/saved-manufacturers');
  });
});

describe('Dashboard shell: the round buttons', () => {
  it('has a plus that posts a requirement for a buyer and adds a product for a supplier, and none for an admin', () => {
    signIn('buyer');
    const buyer = renderAt('/dashboard/buyer');
    expect(screen.getByRole('link', { name: 'Post a requirement' })).toHaveAttribute('href', '/post-requirement');
    buyer.unmount();
    signIn('supplier');
    const supplier = renderAt('/dashboard/supplier');
    expect(screen.getByRole('link', { name: 'Add a product' })).toHaveAttribute('href', '/dashboard/supplier/products');
    supplier.unmount();
    signIn('admin');
    renderAt('/dashboard/admin');
    expect(screen.queryByRole('link', { name: /Post a requirement|Add a product/ })).not.toBeInTheDocument();
  });

  it('opens the AI trade help chat', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const opened = vi.fn();
    window.addEventListener('open-ai-chat', opened);
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI trade help' }));
    window.removeEventListener('open-ai-chat', opened);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('has the bell', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('opens the search from its button, takes focus, and searches the marketplace', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search the marketplace' }));
    const box = screen.getByRole('searchbox', { name: 'Search the marketplace for products' });
    expect(box).toHaveFocus();
    await user.type(box, 'HDPE pipe{Enter}');
    expect(where()).toBe('/products?q=HDPE%20pipe');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('does nothing when the search box is empty', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Search the marketplace' }));
    await user.type(screen.getByRole('searchbox'), '   {Enter}');
    expect(where()).toBe('/dashboard/buyer');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('closes the search on Escape', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Search the marketplace' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('opens the search on "/", unless the person is already typing somewhere', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    other.remove();
    fireEvent.keyDown(window, { key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search the marketplace for products' })).toHaveFocus();
  });
});

describe('Dashboard shell: the account menu', () => {
  it('shows the initials on the account button and the name and role in its menu', async () => {
    const user = userEvent.setup();
    signIn('supplier');
    renderAt('/dashboard/supplier');
    const avatar = screen.getByRole('button', { name: 'Priya Nair account menu' });
    expect(avatar).toHaveTextContent('PN');
    await user.click(avatar);
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.getByText('Supplier')).toBeInTheDocument();
  });

  it('leads to the profile, the help desk and the marketplace', async () => {
    const user = userEvent.setup();
    signIn('supplier');
    renderAt('/dashboard/supplier');
    await user.click(screen.getByRole('button', { name: 'Priya Nair account menu' }));
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/dashboard/supplier/profile');
    expect(screen.getByRole('menuitem', { name: 'Help desk' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('menuitem', { name: 'Open the marketplace' })).toHaveAttribute('href', '/');
  });

  it('offers the public link to a buyer and a supplier but not to an admin', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    const buyer = renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Suresh Kumar account menu' }));
    expect(screen.getByRole('button', { name: 'Copy public link' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    buyer.unmount();
    signIn('admin');
    renderAt('/dashboard/admin');
    await user.click(screen.getByRole('button', { name: 'Mira Kapoor account menu' }));
    expect(screen.queryByRole('button', { name: 'Copy public link' })).not.toBeInTheDocument();
  });

  it('signs out and goes to the home page', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Suresh Kumar account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(auth.value.signOut).toHaveBeenCalledTimes(1);
    // signing out takes a moment (it is asked of the server first), so the rest is waited for
    await waitFor(() => expect(where()).toBe('/'));
    expect(toastMock.success).toHaveBeenCalledWith('Signed out successfully');
  });

  it('says so when signing out fails', async () => {
    const user = userEvent.setup();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signIn('buyer', { signOut: vi.fn(async () => Promise.reject(new Error('offline'))) });
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Suresh Kumar account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Failed to sign out. Please try again.'));
    expect(where()).toBe('/dashboard/buyer');
    quiet.mockRestore();
  });

  it('does not show a name while the account is still loading', () => {
    signIn('buyer', { loading: true, displayName: '' });
    renderAt('/dashboard/buyer');
    expect(screen.getByRole('button', { name: 'Your account menu' })).toHaveTextContent('…');
  });
});

describe('Dashboard shell: the menu on a phone', () => {
  it('opens every section as a list, with the calculators, help desk and sign out', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    const sheet = within(screen.getByRole('dialog'));
    const list = within(sheet.getByRole('navigation', { name: 'Dashboard sections' }));
    expect(labelsOf(list.getAllByRole('link'))).toEqual([
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
      'Shipping Calculator',
      'Order Loan Calculator',
    ]);
    expect(list.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(sheet.getByText('Buyer hub')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Help Desk' })).toHaveAttribute('href', '/contact');
    expect(sheet.getByRole('link', { name: 'Market' })).toHaveAttribute('href', '/');
    expect(sheet.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('names the hub for a supplier and flags Subscription when unpaid', async () => {
    const user = userEvent.setup();
    signIn('supplier', { isPaidSubscriber: false });
    renderAt('/dashboard/supplier/subscription');
    await user.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    const sheet = within(screen.getByRole('dialog'));
    expect(sheet.getByText('Supplier hub')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: /Subscription/ })).toHaveTextContent('Unpaid');
  });

  it('closes after a section is chosen', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Orders' }));
    expect(where()).toBe('/dashboard/buyer/orders');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('signs out from the list', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign Out' }));
    expect(auth.value.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(where()).toBe('/'));
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

  it('shows the unpaid banner and flags Subscription for a manufacturer who has not subscribed', async () => {
    const user = userEvent.setup();
    signIn('supplier', { isPaidSubscriber: false });
    renderAt('/dashboard/supplier/subscription');
    expect(screen.getByText('Unpaid Manufacturer Account')).toBeInTheDocument();
    expect(screen.getByText('Contacts Locked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subscribe Now' })).toHaveAttribute('href', '/dashboard/supplier/subscription');
    expect(screen.getByRole('link', { name: 'Compare Plans' })).toHaveAttribute('href', '/pricing');
    const more = menu().getByRole('button', { name: /More/ });
    expect(more.querySelector('.dsh-dot')).not.toBeNull();
    await user.click(more);
    expect(screen.getByRole('menuitem', { name: /Subscription/ })).toHaveTextContent('Unpaid');
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
    expect(menu().getByRole('button', { name: /More/ }).querySelector('.dsh-dot')).toBeNull();
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
