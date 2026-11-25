import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = { user: null as null | { id: string }, loading: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: { message: vi.fn() } }));

import RequireAuth, { entryFor, needsAccount } from '@/components/common/RequireAuth';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routePaths = [...readFileSync(join(process.cwd(), 'src/routes.tsx'), 'utf8').matchAll(/path: '([^']+)'/g)].map((m) => m[1]);

function Where() {
  const l = useLocation();
  return <p data-testid="at">{`${l.pathname}${l.search}`}</p>;
}
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/dashboard/*" element={<RequireAuth><p>secret dashboard</p></RequireAuth>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('dashboards need an account', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; });

  it('every dashboard route and account shortcut is protected; public pages are not', () => {
    const dashboards = routePaths.filter((p) => p.startsWith('/dashboard'));
    expect(dashboards.length).toBeGreaterThan(50);
    for (const p of dashboards) expect(needsAccount(p)).toBe(true);
    for (const p of ['/orders', '/messages', '/wallet', '/settings/delete-account']) expect(needsAccount(p)).toBe(true);
    for (const p of ['/', '/products', '/post-requirement', '/directory', '/loan-calculator', '/signup', '/login']) expect(needsAccount(p)).toBe(false);
  });

  it('sends a signed-out visitor to sign up and back to the same page afterwards', () => {
    renderAt('/dashboard/supplier/credit');
    expect(screen.queryByText('secret dashboard')).toBeNull();
    expect(screen.getByTestId('at').textContent).toBe('/signup/manufacturer?redirect=%2Fdashboard%2Fsupplier%2Fcredit');
  });

  it('buyer and other pages go to the sign-up page; admin pages to log in', () => {
    expect(entryFor('/dashboard/buyer/profile')).toBe('/signup?redirect=%2Fdashboard%2Fbuyer%2Fprofile');
    expect(entryFor('/dashboard/loans', '?for=credit')).toBe('/signup?redirect=%2Fdashboard%2Floans%3Ffor%3Dcredit');
    expect(entryFor('/dashboard/admin/credit')).toBe('/login?redirect=%2Fdashboard%2Fadmin%2Fcredit');
  });

  it('waits while the session loads, and shows the page to a signed-in user', () => {
    auth.loading = true;
    const { unmount } = renderAt('/dashboard/buyer');
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('secret dashboard')).toBeNull();
    unmount();
    auth.loading = false;
    auth.user = { id: 'u1' };
    renderAt('/dashboard/buyer');
    expect(screen.getByText('secret dashboard')).toBeTruthy();
  });
});
