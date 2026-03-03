/**
 * useNativeApp — Android native integrations via Capacitor.
 *
 * Handles:
 * - Status bar color sync with the active theme
 * - Splash screen hide after mount
 * - Android hardware back button (closes sidebar / navigates back)
 * - SSE pause on app background, resume on foreground
 * - SSE reconnect on network restore
 *
 * Guards every Capacitor call with `Capacitor.isNativePlatform()` so this
 * hook is safe to mount in the web app — all calls are no-ops in a browser.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import type { ThemeName } from '@/store/theme';

// Theme → status bar background color mapping (matches CSS --color-base values)
const THEME_STATUS_BAR_COLOR: Record<ThemeName, string> = {
  midnight: '#080c14',
  phosphor: '#010a01',
  frost:    '#f1f5fb',
  aurora:   '#08060f',
  ember:    '#0c0602',
  ocean:    '#030a14',
  rose:     '#0c0406',
  cobalt:   '#04060e',
  sakura:   '#fdf4f6',
  copper:   '#0a0704',
  slate:    '#0e1012',
  neon:     '#050410',
};

// Light themes need dark status bar icons (dark text on light background)
const LIGHT_THEMES = new Set<ThemeName>(['frost', 'sakura']);

interface UseNativeAppOptions {
  theme: ThemeName;
  /** Called when SSE should reconnect (e.g. network restored / foregrounded) */
  onReconnect: () => void;
  /** Called when SSE should pause (app backgrounded) */
  onPause: () => void;
}

export function useNativeApp({ theme, onReconnect, onPause }: UseNativeAppOptions) {
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();
  // Track whether we paused SSE so we only reconnect if we actually paused
  const wasPaused = useRef(false);

  // ── Splash screen ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    // Dynamic import avoids bundling Capacitor plugins in SSR / web builds
    void import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      void SplashScreen.hide({ fadeOutDuration: 300 });
    });
  }, [isNative]);

  // ── Status bar ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      const bgColor = THEME_STATUS_BAR_COLOR[theme] ?? '#0a0a0f';
      const style = LIGHT_THEMES.has(theme) ? Style.Light : Style.Dark;
      void StatusBar.setBackgroundColor({ color: bgColor });
      void StatusBar.setStyle({ style });
    });
  }, [isNative, theme]);

  // ── Android back button ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    let cleanup: (() => void) | undefined;
    void import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          navigate(-1);
        } else {
          // Exit the app if at root
          void App.exitApp();
        }
      });
      cleanup = () => { void handle.then(h => h.remove()); };
    });
    return () => cleanup?.();
  }, [isNative, navigate]);

  // ── App state (foreground / background) → SSE lifecycle ────────────────────
  useEffect(() => {
    if (!isNative) return;
    let cleanup: (() => void) | undefined;
    void import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          if (wasPaused.current) {
            wasPaused.current = false;
            onReconnect();
          }
        } else {
          wasPaused.current = true;
          onPause();
        }
      });
      cleanup = () => { void handle.then(h => h.remove()); };
    });
    return () => cleanup?.();
  }, [isNative, onReconnect, onPause]);

  // ── Network restore → SSE reconnect ────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    let cleanup: (() => void) | undefined;
    void import('@capacitor/network').then(({ Network }) => {
      const handle = Network.addListener('networkStatusChange', ({ connected }) => {
        if (connected) {
          onReconnect();
        }
      });
      cleanup = () => { void handle.then(h => h.remove()); };
    });
    return () => cleanup?.();
  }, [isNative, onReconnect]);
}
