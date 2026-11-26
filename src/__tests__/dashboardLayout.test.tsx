import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

const themeState = vi.hoisted(() => ({ theme: 'dark', toggleTheme: vi.fn() }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => themeState }));

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

function treeAt(path: string, props: { hideUnpaidNotice?: boolean } = {}) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <DashboardLayout {...props}>
                <p>the page</p>
              </DashboardLayout>
              <Probe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderAt(path: string, props: { hideUnpaidNotice?: boolean } = {}) {
  return render(treeAt(path, props));
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
  themeState.theme = 'dark';
  themeState.toggleTheme.mockClear();
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

describe('Dashboard shell: the sidebar', () => {
  it('has the logo, which leads to the home page', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const logos = screen.getAllByRole('link', { name: 'BulkSkart home' });
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) expect(logo).toHaveAttribute('href', '/');
  });

  it('lists every section of a buyer, the calculators last, and marks the one that is open', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer/orders');
    expect(labelsOf(menu().getAllByRole('link'))).toEqual([
      'Overview',
      'My Requirements',
      'Received Quotes',
      'Orders',
      'Factory Visits',
      'Messages',
      'Notifications',
      'Saved Manufacturers',
      'KYC Verification',
      'Business Loan',
      'Disputes',
      'Profile',
      'Shipping Calculator',
      'Order Loan Calculator',
    ]);
    expect(menu().getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(menu().getByRole('link', { name: 'Shipping Calculator' })).toHaveAttribute('href', '/shipping-calculator');
    expect(menu().getByRole('link', { name: 'Order Loan Calculator' })).toHaveAttribute('href', '/loan-calculator');
  });

  it('lists every section of a supplier, and marks only Overview on the overview page', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    expect(labelsOf(menu().getAllByRole('link'))).toEqual([
      'Overview',
      'AI Sales Assistant',
      'Business Overview',
      'My Products',
      'Inventory & Stock',
      'RFQ Leads',
      'Quotations',
      'Orders',
      'Wallet',
      'Payouts',
      'Business Credit',
      'Business Loan',
      'Factory Visits',
      'Messages',
      'Notifications',
      'Verification',
      'Supplier Map',
      'Disputes',
      'Analytics',
      'Subscription',
      'Business Profile',
    ]);
    expect(menu().getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'My Products' })).not.toHaveAttribute('aria-current');
  });

  it('gives every section its own icon', () => {
    for (const role of ['buyer', 'supplier', 'admin'] as const) {
      signIn(role, role === 'admin' ? { profile: { role, is_super_admin: true } } : {});
      const view = renderAt(`/dashboard/${role}`);
      for (const link of menu().getAllByRole('link')) expect(link.querySelector('svg'), link.textContent ?? '').not.toBeNull();
      view.unmount();
    }
  });

  it('groups the supplier sections under headings, in the same order', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' });
    const order = [...nav.children].map((child) => child.textContent);
    expect(order.indexOf('Catalogue & sales')).toBe(order.indexOf('My Products') - 1);
    expect(order.indexOf('Money')).toBe(order.indexOf('Wallet') - 1);
    expect(order.indexOf('Inbox')).toBe(order.indexOf('Factory Visits') - 1);
    expect(order.indexOf('Trust & growth')).toBe(order.indexOf('Verification') - 1);
    expect(order.indexOf('Account')).toBe(order.indexOf('Subscription') - 1);
  });

  it('has the admin sections, and Super Admin only for a super admin', () => {
    signIn('admin');
    const admin = renderAt('/dashboard/admin');
    expect(labelsOf(menu().getAllByRole('link'))).toEqual(['Control Panel', 'AI Match Analytics', 'Verifications', 'Discovery', 'Reports', 'Public Requirements', 'Payments', 'Loan KYC', 'Business Credit', 'Password Resets']);
    admin.unmount();
    signIn('admin', { profile: { role: 'admin', is_super_admin: true } });
    renderAt('/dashboard/admin/super');
    expect(menu().getByRole('link', { name: 'Super Admin' })).toHaveAttribute('aria-current', 'page');
  });

  it('is a sidebar beside the page: no section is in the header, and nothing is hidden behind a More button', () => {
    for (const role of ['buyer', 'supplier', 'admin'] as const) {
      signIn(role);
      const view = renderAt(`/dashboard/${role}`);
      const nav = screen.getByRole('navigation', { name: 'Dashboard sections' });
      const side = nav.closest('aside');
      expect(side).toHaveClass('dsh-side');
      // the page and its header sit next to the sidebar, not inside it
      const main = document.querySelector('.dsh-main');
      expect(main?.parentElement).toBe(side?.parentElement);
      expect(main?.querySelector('.dsh-content')).toHaveTextContent('the page');
      const header = within(document.querySelector('.dsh-bar') as HTMLElement);
      expect(header.queryByRole('navigation')).not.toBeInTheDocument();
      expect(header.queryByRole('link', { name: 'Overview' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /More/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('opens a section from the sidebar', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(menu().getByRole('link', { name: 'Saved Manufacturers' }));
    expect(where()).toBe('/dashboard/buyer/saved-manufacturers');
    expect(menu().getByRole('link', { name: 'Saved Manufacturers' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks a section deep in the list, like Disputes, when it is open', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer/disputes');
    expect(menu().getByRole('link', { name: 'Disputes' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });

  it('has the AI trade help, the help desk and the marketplace under the list', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const side = within(document.querySelector('.dsh-side') as HTMLElement);
    expect(side.getByRole('link', { name: 'Help Desk' })).toHaveAttribute('href', '/contact');
    expect(side.getByRole('link', { name: 'Marketplace' })).toHaveAttribute('href', '/');
    const opened = vi.fn();
    window.addEventListener('open-ai-chat', opened);
    fireEvent.click(side.getByRole('button', { name: 'AI Trade Help' }));
    window.removeEventListener('open-ai-chat', opened);
    expect(opened).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard shell: a sidebar longer than the window', () => {
  // jsdom has no layout, so the sizes are given here: a 400 px window onto a 1000 px list, every section 40 px high
  const size = { scroll: 1000, client: 400 };
  const top = new WeakMap<Element, number>();
  const isList = (el: Element) => el.classList.contains('dsb-list');
  let spies: Array<{ mockRestore: () => void }> = [];
  const intoView = vi.fn();

  beforeEach(() => {
    size.scroll = 1000;
    size.client = 400;
    intoView.mockClear();
    spies = [
      vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
        return isList(this) ? size.scroll : 0;
      }),
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
        return isList(this) ? size.client : 0;
      }),
      vi.spyOn(Element.prototype, 'scrollTop', 'get').mockImplementation(function (this: Element) {
        return top.get(this) ?? 0;
      }),
      vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(function (this: Element, value: number) {
        top.set(this, value);
      }),
      vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
        const list = this.closest('.dsb-list');
        const links = list ? [...list.querySelectorAll('.dsb-link')] : [];
        return Math.max(0, links.indexOf(this)) * 40;
      }),
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('dsb-link') ? 40 : 0;
      }),
    ];
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = intoView;
  });
  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });

  const list = () => screen.getByRole('navigation', { name: 'Dashboard sections' });

  it('scrolls on its own to bring the open section into the middle when it is out of sight', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier/profile');
    // Business Profile is the 21st section: 800 − (400 − 40) / 2
    expect(list().scrollTop).toBe(620);
    expect(intoView).not.toHaveBeenCalled();
  });

  it('stays where it is when the open section is already in sight', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier/products');
    expect(list().scrollTop).toBe(0);
  });

  it('asks the drawer to show the open section when the list itself does not scroll', () => {
    size.scroll = 400;
    signIn('supplier');
    renderAt('/dashboard/supplier/profile');
    expect(intoView).toHaveBeenCalledWith({ block: 'nearest' });
  });
});

describe('Dashboard shell: the header', () => {
  it('holds only the search, add, theme, notifications and the account', () => {
    signIn('supplier');
    renderAt('/dashboard/supplier');
    const header = within(document.querySelector('.dsh-bar') as HTMLElement);
    expect(header.getByRole('searchbox', { name: 'Search the marketplace for products' })).toBeInTheDocument();
    expect(header.getByRole('link', { name: 'Add a product' })).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Priya Nair account menu' })).toBeInTheDocument();
    expect(header.queryByRole('button', { name: /AI trade help/i })).not.toBeInTheDocument();
  });

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

  it('switches between the light and the dark look of the site', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    const dark = renderAt('/dashboard/buyer');
    // the site is dark, so the button offers the other one
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(themeState.toggleTheme).toHaveBeenCalledTimes(1);
    dark.unmount();
    themeState.theme = 'light';
    renderAt('/dashboard/buyer');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch to light mode' })).not.toBeInTheDocument();
  });

  it('has the bell', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  const searchForm = () => document.getElementById('dsh-search');

  it('searches the marketplace from the search box', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.type(screen.getByRole('searchbox', { name: 'Search the marketplace for products' }), 'HDPE pipe{Enter}');
    expect(where()).toBe('/products?q=HDPE%20pipe');
  });

  it('on a phone opens the search from its button, takes focus, and closes it after searching', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const button = screen.getByRole('button', { name: 'Search the marketplace' });
    expect(searchForm()).not.toHaveClass('is-open');
    await user.click(button);
    expect(searchForm()).toHaveClass('is-open');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const box = screen.getByRole('searchbox', { name: 'Search the marketplace for products' });
    expect(box).toHaveFocus();
    await user.type(box, 'HDPE pipe{Enter}');
    expect(where()).toBe('/products?q=HDPE%20pipe');
    expect(searchForm()).not.toHaveClass('is-open');
  });

  it('does nothing when the search box is empty', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Search the marketplace' }));
    await user.type(screen.getByRole('searchbox'), '   {Enter}');
    expect(where()).toBe('/dashboard/buyer');
    expect(searchForm()).toHaveClass('is-open');
  });

  it('closes the search on Escape', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Search the marketplace' }));
    await user.keyboard('{Escape}');
    expect(searchForm()).not.toHaveClass('is-open');
    expect(screen.getByRole('button', { name: 'Search the marketplace' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('searchbox')).not.toHaveFocus();
  });

  it('goes to the search on "/", unless the person is already typing somewhere', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(searchForm()).not.toHaveClass('is-open');
    expect(other).toHaveFocus();
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

describe('Dashboard shell: the sidebar on a phone (behind the hamburger)', () => {
  it('opens every section as a list, with the calculators, AI help, help desk and sign out', async () => {
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
      'Factory Visits',
      'Messages',
      'Notifications',
      'Saved Manufacturers',
      'KYC Verification',
      'Business Loan',
      'Disputes',
      'Profile',
      'Shipping Calculator',
      'Order Loan Calculator',
    ]);
    expect(list.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(sheet.getByText('Buyer hub')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Help Desk' })).toHaveAttribute('href', '/contact');
    expect(sheet.getByRole('link', { name: 'Marketplace' })).toHaveAttribute('href', '/');
    expect(sheet.getByRole('button', { name: 'AI Trade Help' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Copy public link' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('has the same light / dark switch', async () => {
    const user = userEvent.setup();
    signIn('buyer');
    renderAt('/dashboard/buyer');
    await user.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Light mode' }));
    expect(themeState.toggleTheme).toHaveBeenCalledTimes(1);
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

describe('Dashboard shell: a manufacturer whose account is still loading', () => {
  it('is not taken for an unpaid one: no notice, no flag, and no being sent away from a page', () => {
    // the subscription is looked up after the profile, so for a moment every manufacturer looks unpaid
    signIn('supplier', { loading: true, isPaidSubscriber: false });
    renderAt('/dashboard/supplier/inventory');
    expect(where()).toBe('/dashboard/supplier/inventory');
    expect(toastMock.message).not.toHaveBeenCalled();
    expect(screen.queryByText('Unpaid Manufacturer Account')).not.toBeInTheDocument();
    expect(menu().getByRole('link', { name: /Subscription/ })).not.toHaveTextContent('Unpaid');
  });

  it('stays on the page it asked for once the account has loaded and shows that it has paid', () => {
    signIn('supplier', { loading: true, isPaidSubscriber: false });
    const view = renderAt('/dashboard/supplier/orders');
    signIn('supplier', { loading: false, isPaidSubscriber: true });
    view.rerender(treeAt('/dashboard/supplier/orders'));
    expect(where()).toBe('/dashboard/supplier/orders');
    expect(toastMock.message).not.toHaveBeenCalled();
    expect(screen.queryByText('Unpaid Manufacturer Account')).not.toBeInTheDocument();
  });

  it('is kept to the pages it may open once the account has loaded and it has not paid', () => {
    signIn('supplier', { loading: true, isPaidSubscriber: false });
    const view = renderAt('/dashboard/supplier/orders');
    expect(where()).toBe('/dashboard/supplier/orders');
    signIn('supplier', { loading: false, isPaidSubscriber: false });
    view.rerender(treeAt('/dashboard/supplier/orders'));
    expect(where()).toBe('/dashboard/supplier/subscription');
    expect(toastMock.message).toHaveBeenCalledWith('Subscription required', expect.anything());
    expect(screen.getByText('Unpaid Manufacturer Account')).toBeInTheDocument();
  });

  it('can leave out the notice under the header for a page that explains the unpaid state itself, and keeps the rest', () => {
    signIn('supplier', { isPaidSubscriber: false });
    renderAt('/dashboard/supplier', { hideUnpaidNotice: true });
    expect(screen.queryByText('Unpaid Manufacturer Account')).not.toBeInTheDocument();
    expect(menu().getByRole('link', { name: /Subscription/ })).toHaveTextContent('Unpaid');
  });
});

describe('Dashboard shell: the manufacturer addresses', () => {
  it('mark the same sections as the supplier addresses', () => {
    signIn('supplier');
    const overview = renderAt('/dashboard/manufacturer');
    expect(menu().getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    overview.unmount();
    const products = renderAt('/dashboard/manufacturer/products');
    expect(menu().getByRole('link', { name: 'My Products' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    products.unmount();
    renderAt('/dashboard/manufacturer/quotations');
    expect(menu().getByRole('link', { name: 'Quotations' })).toHaveAttribute('aria-current', 'page');
  });

  it('mark a section deep in the list, like Inventory & Stock, in the sidebar', () => {
    signIn('supplier');
    renderAt('/dashboard/manufacturer/inventory');
    expect(menu().getByRole('link', { name: 'Inventory & Stock' })).toHaveAttribute('aria-current', 'page');
    expect(menu().getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('keep an unpaid manufacturer to the pages it may open, like the supplier addresses', () => {
    signIn('supplier', { isPaidSubscriber: false });
    const allowed = renderAt('/dashboard/manufacturer/products');
    expect(where()).toBe('/dashboard/manufacturer/products');
    allowed.unmount();
    renderAt('/dashboard/manufacturer/inventory');
    expect(where()).toBe('/dashboard/supplier/subscription');
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
    expect(screen.getByText('Contacts Locked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subscribe Now' })).toHaveAttribute('href', '/dashboard/supplier/subscription');
    expect(screen.getByRole('link', { name: 'Compare Plans' })).toHaveAttribute('href', '/pricing');
    const subscription = menu().getByRole('link', { name: /Subscription/ });
    expect(subscription).toHaveTextContent('Unpaid');
    expect(subscription).toHaveAttribute('aria-current', 'page');
    // only Subscription carries the flag
    expect(menu().getByRole('link', { name: 'Overview' })).not.toHaveTextContent('Unpaid');
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
    expect(menu().getByRole('link', { name: /Subscription/ })).not.toHaveTextContent('Unpaid');
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

describe('Dashboard shell: how far down the page starts', () => {
  type Watcher = { callback: () => void; watched: Element[]; disconnect: ReturnType<typeof vi.fn> };
  const watchers: Watcher[] = [];
  let top = 0;
  let offsetTop: { mockRestore: () => void };

  beforeEach(() => {
    watchers.length = 0;
    top = 137;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        watcher: Watcher;
        constructor(callback: () => void) {
          this.watcher = { callback, watched: [], disconnect: vi.fn() };
          watchers.push(this.watcher);
        }
        observe(element: Element) {
          this.watcher.watched.push(element);
        }
        unobserve() {}
        disconnect() {
          this.watcher.disconnect();
        }
      },
    );
    offsetTop = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(() => top);
  });
  afterEach(() => {
    offsetTop.mockRestore();
    vi.unstubAllGlobals();
  });

  const root = () => document.querySelector('.dsh') as HTMLElement;
  const downBy = () => root().style.getPropertyValue('--dsh-top');

  it('tells the page how far down it starts, and again when the header changes height', () => {
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(downBy()).toBe('137px');
    top = 173; // the header got taller
    act(() => watchers.forEach((watcher) => watcher.callback()));
    expect(downBy()).toBe('173px');
  });

  it('watches the header and a notice under it, and stops when the page is closed', () => {
    signIn('supplier', { isPaidSubscriber: false });
    const view = renderAt('/dashboard/supplier/products');
    const watched = watchers.flatMap((watcher) => watcher.watched);
    expect(watched).toContain(document.querySelector('.dsh-bar'));
    expect(watched).toContain(document.querySelector('.dsh-notice'));
    view.unmount();
    expect(watchers.length).toBeGreaterThan(0);
    for (const watcher of watchers) expect(watcher.disconnect).toHaveBeenCalled();
  });

  it('measures again when a notice appears under the header', () => {
    signIn('supplier', { loading: true, isPaidSubscriber: false });
    const view = renderAt('/dashboard/supplier/products');
    expect(document.querySelector('.dsh-notice')).toBeNull();
    expect(downBy()).toBe('137px');
    top = 205; // the notice pushes the page down
    signIn('supplier', { loading: false, isPaidSubscriber: false });
    view.rerender(treeAt('/dashboard/supplier/products'));
    expect(document.querySelector('.dsh-notice')).not.toBeNull();
    expect(downBy()).toBe('205px');
  });

  it('still measures once where there is no way to watch for changes', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    signIn('buyer');
    renderAt('/dashboard/buyer');
    expect(downBy()).toBe('137px');
  });
});
