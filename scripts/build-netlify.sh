#!/usr/bin/env bash
set -euo pipefail

echo "Building landing page..."
cd apps/landing && bun run build && cd ../..

echo "Building dashboard..."
cd apps/web && bun run build && cd ../..

echo "Merging outputs..."
# Next.js static export goes to apps/landing/out/
# Vite build goes to apps/web/dist/
# Copy Vite dist into landing out/app/
mkdir -p apps/landing/out/app
cp -r apps/web/dist/* apps/landing/out/app/

# Inject Android App Links fingerprint into the published assetlinks.json.
# Set ASSETLINKS_FINGERPRINT in your CI environment (Netlify env vars or
# GitHub Actions variables) to your APK signing certificate's SHA-256 fingerprint.
# Format: colon-separated hex pairs, e.g. AB:CD:EF:...
if [ -n "${ASSETLINKS_FINGERPRINT:-}" ]; then
  # Validate format: 32 hex pairs separated by colons (SHA-256 = 256 bits = 32 bytes)
  if ! echo "$ASSETLINKS_FINGERPRINT" | grep -qE '^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$'; then
    echo "ERROR: ASSETLINKS_FINGERPRINT has invalid format (expected 32 colon-separated hex pairs)" >&2
    exit 1
  fi
  ASSETLINKS_FILE="apps/landing/out/.well-known/assetlinks.json"
  if [ -f "$ASSETLINKS_FILE" ]; then
    sed -i "s|YOUR_SHA256_CERT_FINGERPRINT_HERE|${ASSETLINKS_FINGERPRINT}|g" "$ASSETLINKS_FILE"
    echo "Injected ASSETLINKS_FINGERPRINT into $ASSETLINKS_FILE"
  fi
fi

# Write a _redirects file so Netlify rewrites /app/* to the Vite SPA index.
# This runs before the 404.html catch-all and returns a 200 status.
echo "/app/*  /app/index.html  200" > apps/landing/out/_redirects

# Derive the API origin (scheme + host, no path) from VITE_API_URL so it can
# be added to connect-src. Falls back to empty string if not set (dev builds).
API_ORIGIN=""
if [ -n "${VITE_API_URL:-}" ]; then
  # Strip path — keep scheme://host[:port] only
  API_ORIGIN=$(echo "$VITE_API_URL" | sed 's|^\(https\?://[^/]*\).*|\1|')
fi

# Write a _headers file for security headers (works with API deploys too).
# netlify.toml [[headers]] only applies when Netlify builds the site itself;
# for CI-driven deploys via the Netlify API this _headers file is required.
cat > apps/landing/out/_headers << HEADERS
/app/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${API_ORIGIN} https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${API_ORIGIN} https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';

/app/assets/*
  Cache-Control: public, max-age=31536000, immutable

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
HEADERS

echo "Build complete! Publish directory: apps/landing/out"
