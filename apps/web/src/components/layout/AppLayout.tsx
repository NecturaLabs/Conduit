import { useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { useGlobalSSE } from '@/hooks/useGlobalSSE';
import { useNativeApp } from '@/hooks/useNativeApp';
import { useAccessibilityStore } from '@/store/accessibility';
import { useThemeStore } from '@/store/theme';

/** Pages that need full-bleed layout (no padding, fill entire main area). */
const FULL_BLEED_PATHS = ['/sessions'];

/** Human-readable page name for screen reader announcements. */
function pageName(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function AppLayout() {
  const { reconnect, pause } = useGlobalSSE();
  const { theme } = useThemeStore();
  const { pathname } = useLocation();

  const stableReconnect = useCallback(() => reconnect(), [reconnect]);
  const stablePause = useCallback(() => pause(), [pause]);

  useNativeApp({ theme, onReconnect: stableReconnect, onPause: stablePause });
  const isFullBleed = FULL_BLEED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  const announceRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Sync accessibility preferences to <html> data attributes
  const { reduceMotion, enhancedFocus, largerTargets } = useAccessibilityStore();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reduceMotion = String(reduceMotion);
    root.dataset.enhancedFocus = String(enhancedFocus);
    root.dataset.largerTargets = String(largerTargets);
  }, [reduceMotion, enhancedFocus, largerTargets]);

  // Announce route changes to screen readers (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (announceRef.current) {
      announceRef.current.textContent = `${pageName(pathname)} page`;
    }
  }, [pathname]);

  return (
    <div className="h-dvh flex flex-col bg-[var(--color-base)]" style={{ overflow: 'clip', width: '100%' }}>
      {/* Route-change announcer for screen readers */}
      <div
        ref={announceRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-[var(--color-base)] focus:font-semibold focus:outline-none"
      >
        Skip to main content
      </a>
      <TopBar />
      <Sidebar />
      <main
        id="main-content"
        className={
          isFullBleed
            ? 'lg:ml-60 flex-1 min-h-0 overflow-hidden'
            : 'lg:ml-60 flex-1 min-h-0 lg:pb-6'
        }
        style={isFullBleed ? undefined : {
          overflowX: 'clip',
          overflowY: 'auto',
          paddingBottom: 'calc(6rem + var(--sab, 0px))',
        }}
      >
        {isFullBleed ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
