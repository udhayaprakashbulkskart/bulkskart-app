import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
const LiveBuyerOrderAlert = lazy(() => import('@/components/common/LiveBuyerOrderAlert'));
const AIChatAssistant = lazy(() => import('@/components/common/AIChatAssistant'));
import AutoImageSyncManager from '@/components/common/AutoImageSyncManager';
import VersionCheckSafetyNet from '@/components/common/VersionCheckSafetyNet';
import PageSkeleton from '@/components/common/PageSkeleton';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { routes } from './routes';
import { trackPageView } from '@/lib/analytics';
import NotFound from '@/pages/NotFound';

/** Fires a GA4 page_view on every React Router navigation */
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}

/** Scrolls the window to the top on every route change */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function useAfterIdle(timeout = 2500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const start = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(start, timeout);
    return () => window.clearTimeout(id);
  }, [timeout]);
  return ready;
}

/** Recovery links can land on the site root. Keep that session on the reset-password page. */
function PasswordRecoveryRedirect() {
  const { passwordRecovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!passwordRecovery) return;
    if (location.pathname === '/reset-password') return;
    navigate('/reset-password', { replace: true });
  }, [passwordRecovery, location.pathname, navigate]);

  return null;
}

const App: React.FC = () => {
  const showDeferred = useAfterIdle(4000);
  return (
    <Router>
      <ThemeProvider>
        <CurrencyProvider>
          <AuthProvider>
            <RouteTracker />
            <ScrollToTop />
            <PasswordRecoveryRedirect />
            <IntersectObserver />
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                {routes.map((route, index) => (
                  <Route
                    key={`${route.path}-${index}`}
                    path={route.path}
                    element={route.public ? route.element : <RouteGuard>{route.element}</RouteGuard>}
                  />
                ))}
                {/* SEO-friendly 404 handler without indiscriminate redirect */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            {showDeferred && (
              <Suspense fallback={null}>
                <LiveBuyerOrderAlert />
                <AIChatAssistant />
              </Suspense>
            )}
            <AutoImageSyncManager />
            <VersionCheckSafetyNet />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
