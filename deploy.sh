#!/usr/bin/env bash
set -euo pipefail

# Deploy Open Sunsama to a VPS
# Run this script on your Hostinger VPS after cloning the repo.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Open Sunsama deploy"

# 1. Ensure .env exists
if [[ ! -f .env ]]; then
  echo "! No .env file found. Copying from .env.production.example"
  cp .env.production.example .env
  echo "! Please edit .env with your domain and secrets, then re-run this script."
  exit 1
fi

# 2. Source env for quick validation
set -a
# shellcheck source=/dev/null
source .env
set +a

if [[ -z "${DOMAIN:-}" || "$DOMAIN" == "schedule.yourdomain.com" ]]; then
  echo "! DOMAIN is not set in .env. Please set it to your real domain."
  exit 1
fi

if [[ -z "${JWT_SECRET:-}" || "$JWT_SECRET" == "CHANGE_ME_JWT_SECRET_MIN_32_CHARS" ]]; then
  echo "! JWT_SECRET is not set. Generate one with: openssl rand -base64 32"
  exit 1
fi

# 3. Pull latest changes (optional — uncomment if you want auto-pull)
# git pull origin main

# 4. Build and start base infrastructure (postgres first)
echo "==> Starting Postgres..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d postgres

# 5. Run DB migrations
echo "==> Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm --build migrate

# 6. Build and start the app containers
echo "==> Building and starting app containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 7. Wait for health check
echo "==> Waiting for API health..."
for i in {1..30}; do
  if curl -sf "https://${DOMAIN}/health" > /dev/null 2>&1 || curl -sf "http://localhost:3001/health" > /dev/null 2>&1; then
    echo "==> API is healthy"
    break
  fi
  sleep 2
done

echo "==> Deploy complete"
echo "    Web app:  https://${DOMAIN}"
echo "    API:      https://${DOMAIN}/api"
echo ""
echo "    First time? Create an account at https://${DOMAIN}/signup"
