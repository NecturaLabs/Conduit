import { type ReactNode, useEffect, useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@/store/auth';
import { resolveBaseUrl, tryRefresh } from '@/lib/api';
import type { ApiSuccess, UserProfile } from '@conduit/shared';

interface ProtectedRouteProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

/**
 * Validates the session on mount and whenever the app/tab becomes visible again.
 *
 * Optimistic strategy:
 *   - If persisted auth state says we're authenticated, render children
 *     immediately while validating in the background.
 *   - If not authenticated, attempt a one-time bootstrap probe of /auth/me to
 *     handle the OAuth callback case: the server sets httpOnly cookies and
 *     redirects to /app/dashboard, but the SPA store starts with isAuthenticated=false.
 *     If /auth/me succeeds (valid cookie session), we bootstrap the store and
 *     proceed. If it fails, we redirect to /auth as normal.
 *   - If validation fails definitively (refresh expired/revoked), log out and
 *     redirect to /auth.
 *   - If validation encounters transient errors (network, 5xx), stay
 *     authenticated and rely on per-request refresh in api.ts.
 *
 * Re-validation triggers:
 *   - Mount (first load / navigation).
 *   - Document visibilitychange → visible (web tab regains focus).
 *   - Capacitor App 'appStateChange' active=true (Android foreground resume).
 *
 * This ensures that if the server revokes a session (DB wipe, explicit logout
 * from another device, token expiry) the Android app detects it as soon as the
 * user opens the app rather than staying stuck on a stale authenticated view
 * showing empty/default data.
 */
export function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const clearUser = useAuthStore((s) => s.clearUser);
  const setUser = useAuthStore((s) => s.setUser);
  const setOnboarded = useAuthStore((s) => s.setOnboarded);

  // Track in-flight validation to avoid concurrent probes.
  const validatingRef = useRef(false);
  // Whether the initial bootstrap probe (for unauthenticated state) is in progress.
  const [bootstrapping, setBootstrapping] = useState(!isAuthenticated);

  const validate = useCallback(async () => {
    // Skip if not authenticated (nothing to validate) or already in-flight.
    if (!useAuthStore.getState().isAuthenticated) return;
    if (validatingRef.current) return;
    validatingRef.current = true;

    try {
      // Step 1: probe the session with the existing access token.
      let meRes: Response;
      try {
        meRes = await fetch(`${resolveBaseUrl()}/auth/me`, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
      } catch {
        // Network error — don't log out; per-request logic handles retries.
        return;
      }

      if (meRes.ok) {
        // Access token is still valid — hydrate profile.
        try {
          const body = (await meRes.json()) as ApiSuccess<{ user: UserProfile }>;
          if (body?.data?.user) {
            setUser(body.data.user);
          }
        } catch { /* ignore parse errors */ }
        return;
      }

      if (meRes.status !== 401) {
        // Server error (5xx) or unexpected status — don't log out.
        return;
      }

      // Step 2: access token is gone/expired — attempt refresh.
      const result = await tryRefresh();

      if (result === 'expired') {
        // Refresh token is invalid or revoked — definitively log out.
        clearUser();
        return;
      }

      if (result === 'refreshed') {
        // Re-fetch profile with the new access token.
        try {
          const me2 = await fetch(`${resolveBaseUrl()}/auth/me`, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          });
          if (me2.ok) {
            const body2 = (await me2.json()) as ApiSuccess<{ user: UserProfile }>;
            if (body2?.data?.user) setUser(body2.data.user);
          } else if (me2.status === 401) {
            // New token also rejected — give up and log out.
            clearUser();
          }
        } catch { /* ignore */ }
      }

      // result === 'error' (transient) — stay authenticated.
    } finally {
      validatingRef.current = false;
    }
  }, [clearUser, setUser]);

  /**
   * Bootstrap probe — runs once when isAuthenticated is false on mount.
   * Handles the OAuth callback case where cookies are set server-side but
   * the SPA store hasn't been updated yet (no JS ran during the redirect).
   */
  useEffect(() => {
    if (isAuthenticated) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch(`${resolveBaseUrl()}/auth/me`, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (cancelled) return;
        if (meRes.ok) {
          const body = (await meRes.json()) as ApiSuccess<{ user: UserProfile & { onboardingComplete?: boolean } }>;
          if (body?.data?.user) {
            setUser(body.data.user);
            if (typeof (body.data.user as UserProfile & { onboardingComplete?: boolean }).onboardingComplete === 'boolean') {
              setOnboarded((body.data.user as UserProfile & { onboardingComplete?: boolean }).onboardingComplete!);
            }
          }
        }
      } catch { /* network error — fall through to redirect */ }
      finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  // Run validation on mount (only when already authenticated).
  useEffect(() => {
    void validate();
  }, [validate]);

  // Re-validate when the web tab regains visibility (covers browser + WebView).
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void validate();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [validate]);

  // Re-validate when the Android app comes back to foreground via Capacitor.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanupFn: (() => void) | undefined;

    void import('@capacitor/app').then(({ App }) => {
      let handle: { remove: () => Promise<void> } | undefined;
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void validate();
      }).then((h) => { handle = h; });

      cleanupFn = () => {
        void handle?.remove();
      };
    });

    return () => cleanupFn?.();
  }, [validate]);

  // While the bootstrap probe is in flight, render nothing (avoid flash-redirect to /auth).
  if (bootstrapping) return null;

  // Optimistic: if persisted state says authenticated, render immediately.
  // Background validation will log out if the session is truly gone.
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (requireOnboarding && !isOnboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
