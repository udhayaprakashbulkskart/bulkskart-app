/**
 * Dashboards and account pages need a signed-in user. A visitor who opens one (for example from a shared link) is sent
 * to sign up, and back to the same page once signed up or logged in:
 *   manufacturer pages → the manufacturer sign-up; admin pages → log in; everything else → the sign-up page.
 * The sign-up pages have a "Sign in" link for people who already have an account.
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

/** Account pages outside /dashboard (shortcuts into the dashboards). */
const ACCOUNT_PATHS = new Set([
  '/business-setup', '/onboarding', '/payment-success', '/profile', '/settings/delete-account', '/ai-sales-assistant', '/my-products',
  '/quotations', '/orders', '/orders/:orderId', '/orders/:orderId/pay', '/buyer/requirements', '/messages', '/chat', '/notifications', '/wallet',
]);
const MANUFACTURER_PATHS = new Set(['/ai-sales-assistant', '/my-products', '/quotations', '/wallet', '/business-setup', '/onboarding']);

/** Does this route (as written in routes.tsx) need an account? */
export function needsAccount(routePath: string): boolean {
  return routePath === '/dashboard' || routePath.startsWith('/dashboard/') || ACCOUNT_PATHS.has(routePath);
}

/** Where a signed-out visitor goes for a page, keeping the page to come back to. */
export function entryFor(pathname: string, search = ''): string {
  const back = encodeURIComponent(`${pathname}${search}`);
  if (/^\/dashboard\/admin(\/|$)/.test(pathname)) return `/login?redirect=${back}`;
  if (/^\/dashboard\/(supplier|manufacturer)(\/|$)/.test(pathname) || MANUFACTURER_PATHS.has(pathname)) return `/signup/manufacturer?redirect=${back}`;
  return `/signup?redirect=${back}`;
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const signedOut = !loading && !user;

  useEffect(() => {
    if (signedOut) toast.message('Please sign up or log in to continue', { id: 'require-auth' });
  }, [signedOut]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FF5A00] border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to={entryFor(location.pathname, location.search)} replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
