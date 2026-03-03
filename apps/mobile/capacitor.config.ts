import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.conduit.app',
  appName: 'Conduit',
  // Points at the built web app output. `npx cap sync` copies apps/web/dist here.
  webDir: '../../apps/web/dist',

  // SECURITY NOTE: CapacitorCookies.enabled bridges httpOnly cookies through the
  // native WebView layer so the server's httpOnly JWT cookies work correctly.
  // This makes cookies accessible at the native plugin layer (Swift/Kotlin) but
  // NOT from JavaScript — the httpOnly flag is still enforced against web content.
  // Since this app is sideloaded and we control all native code, this is acceptable.
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0a0a0f',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0a0a0f',
    },
  },

  android: {
    // The web app is served at /app/ (React Router basename=/app)
    appendUserAgent: 'ConduitApp/1.0',
  },

  server: {
    androidScheme: 'https',
  },

  // SECURITY: Disable Capacitor's internal logging in all builds to prevent
  // session data (tokens, user info) from leaking to device logs.
  // For debug builds, temporarily set to 'debug' locally — never commit that change.
  loggingBehavior: 'none',
};

export default config;
