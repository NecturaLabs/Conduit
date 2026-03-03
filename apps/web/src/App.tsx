import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useThemeStore } from '@/store/theme';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Auth } from '@/pages/Auth';
import { Onboarding } from '@/pages/Onboarding';
import { Activate } from '@/pages/Activate';

// Lazy-load all dashboard pages to reduce initial bundle size
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sessions = lazy(() => import('@/pages/Sessions').then(m => ({ default: m.Sessions })));
const Config = lazy(() => import('@/pages/Config').then(m => ({ default: m.Config })));
const Metrics = lazy(() => import('@/pages/Metrics').then(m => ({ default: m.Metrics })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading page">
      <div className="h-5 w-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
    </div>
  );
}

/** Strip the web app's /app basename and extract just the path+search for the router. */
function toRouterPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    // conduit:// deep links: conduit://auth/verify?token=...
    // The host becomes the first path segment in URL parsing (e.g. host="auth", pathname="/verify")
    if (parsed.protocol === 'conduit:') {
      return '/' + parsed.host + parsed.pathname + parsed.search;
    }
    return parsed.pathname.replace(/^\/app/, '') + parsed.search;
  } catch {
    return null;
  }
}

function useDeepLink() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void import('@capacitor/app').then(({ App }) => {
      // Cold launch via App Link
      void App.getLaunchUrl().then((result) => {
        const path = result?.url ? toRouterPath(result.url) : null;
        if (path) navigate(path, { replace: true });
      });
      // App already open, link tapped
      App.addListener('appUrlOpen', ({ url }) => {
        const path = toRouterPath(url);
        if (path) navigate(path, { replace: true });
      });
    });
  }, [navigate]);
}

function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;

    if (theme === 'frost' || theme === 'sakura') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }

    root.style.fontFamily = getComputedStyle(root).getPropertyValue('--font-base');
  }, [theme]);
}

export function App() {
  useApplyTheme();
  useDeepLink();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/verify" element={<Auth />} />
      <Route
        path="/activate"
        element={
          <ProtectedRoute>
            <Activate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOnboarding={false}>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Suspense fallback={<LazyFallback />}><Dashboard /></Suspense>} />
        <Route path="/sessions" element={<Suspense fallback={<LazyFallback />}><Sessions /></Suspense>} />
        <Route path="/sessions/:id" element={<Suspense fallback={<LazyFallback />}><Sessions /></Suspense>} />
        <Route path="/config" element={<Suspense fallback={<LazyFallback />}><Config /></Suspense>} />
        <Route path="/metrics" element={<Suspense fallback={<LazyFallback />}><Metrics /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<LazyFallback />}><Settings /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
