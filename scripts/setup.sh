#!/usr/bin/env bash
set -euo pipefail

# ── Conduit Self-Hosted Setup ─────────────────────────────────
# Generates TLS certificates and the data directory.
# Idempotent: will not overwrite existing certs.
#
# Secrets live in .env — run ./scripts/generate-secrets.sh to generate them.
# URLs and other settings are configured in docker-compose.yml.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Dependency Checks ────────────────────────────────────────
command -v openssl >/dev/null 2>&1 || error "openssl is required but not installed."
command -v docker  >/dev/null 2>&1 || error "docker is required but not installed."
(command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1) \
    || error "docker-compose (or 'docker compose') is required but not installed."

# ── Generate TLS Certificate ─────────────────────────────────
if [ -f certs/server.crt ] && [ -f certs/server.key ]; then
    warn "TLS certificates already exist in certs/ — skipping generation."
else
    info "Generating ECDSA P-256 self-signed TLS certificate..."
    mkdir -p certs

    openssl ecparam -genkey -name prime256v1 -out certs/server.key 2>/dev/null

    openssl req -new -x509 \
        -key certs/server.key \
        -out certs/server.crt \
        -days 365 \
        -subj "/CN=conduit" \
        -addext "subjectAltName=DNS:localhost,DNS:conduit.local,IP:127.0.0.1" \
        2>/dev/null

    chmod 600 certs/server.key
    info "TLS certificate generated (valid 365 days)."
fi

# ── Data Directory ────────────────────────────────────────────
mkdir -p data
info "Data directory ready."

# ── Done ──────────────────────────────────────────────────────
echo ""
info "Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Run ./scripts/generate-secrets.sh to fill in your secrets"
echo "    2. Start the stack:"
echo ""
echo "       docker compose up -d"
echo ""
