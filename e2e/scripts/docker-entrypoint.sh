#!/usr/bin/env bash
set -euo pipefail

echo "==> Waiting for worker at $WORKER_URL ..."
for i in $(seq 1 60); do
  if curl -sf "$WORKER_URL/health_check" > /dev/null 2>&1; then
    echo "    Worker ready after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Worker not ready after 60s"
    exit 1
  fi
  sleep 1
done

if [ -n "${WORKER_URL_SUBDOMAIN:-}" ]; then
  echo "==> Waiting for subdomain worker at $WORKER_URL_SUBDOMAIN ..."
  for i in $(seq 1 60); do
    if curl -sf "$WORKER_URL_SUBDOMAIN/health_check" > /dev/null 2>&1; then
      echo "    Subdomain worker ready after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "ERROR: Subdomain worker not ready after 60s"
      exit 1
    fi
    sleep 1
  done
fi

if [ -n "${WORKER_URL_ENV_OFF:-}" ]; then
  echo "==> Waiting for env-off worker at $WORKER_URL_ENV_OFF ..."
  for i in $(seq 1 60); do
    if curl -sf "$WORKER_URL_ENV_OFF/health_check" > /dev/null 2>&1; then
      echo "    Env-off worker ready after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "ERROR: Env-off worker not ready after 60s"
      exit 1
    fi
    sleep 1
  done
fi

if [ -n "${WORKER_GZIP_URL:-}" ]; then
  echo "==> Waiting for worker-gzip at $WORKER_GZIP_URL ..."
  for i in $(seq 1 60); do
    if curl -sf "$WORKER_GZIP_URL/health_check" > /dev/null 2>&1; then
      echo "    Worker-gzip ready after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "ERROR: Worker-gzip not ready after 60s"
      exit 1
    fi
    sleep 1
  done
fi

if [ -n "${WORKER_URL_SITE_PASSWORD:-}" ]; then
  echo "==> Waiting for site-password worker at $WORKER_URL_SITE_PASSWORD ..."
  for i in $(seq 1 60); do
    if curl --connect-timeout 5 --max-time 10 -sf -H "x-custom-auth: e2e-site-pass" "$WORKER_URL_SITE_PASSWORD/health_check" > /dev/null 2>&1; then
      echo "    Site-password worker ready after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "ERROR: Site-password worker not ready after 60s"
      exit 1
    fi
    sleep 1
  done
fi

if [ -n "${FRONTEND_URL:-}" ]; then
  echo "==> Waiting for frontend at $FRONTEND_URL ..."
  for i in $(seq 1 60); do
    if curl -skf "$FRONTEND_URL" > /dev/null 2>&1; then
      echo "    Frontend ready after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "ERROR: Frontend not ready after 60s"
      exit 1
    fi
    sleep 1
  done
fi

if [ -n "${FRONTEND_URL_ENV_OFF:-}" ]; then
  echo "==> Waiting for env-off frontend at $FRONTEND_URL_ENV_OFF ..."
  for i in $(seq 1 60); do
    if curl --connect-timeout 5 --max-time 10 -skf "$FRONTEND_URL_ENV_OFF" > /dev/null 2>&1; then
      echo "    Env-off frontend ready after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "ERROR: Env-off frontend not ready after 60s"
      exit 1
    fi
    sleep 1
  done
fi

echo "==> Waiting for smtp-proxy-tls SMTP on $SMTP_PROXY_TLS_HOST:$SMTP_PROXY_TLS_SMTP_PORT ..."
for i in $(seq 1 30); do
  if nc -z "$SMTP_PROXY_TLS_HOST" "$SMTP_PROXY_TLS_SMTP_PORT" 2>/dev/null; then
    echo "    smtp-proxy-tls SMTP ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "WARNING: smtp-proxy-tls SMTP not ready after 30s, continuing anyway"
  fi
  sleep 1
done

# Admin APIs are role-based: mint an admin access token per worker variant (secrets match
# fixtures/wrangler.toml.e2e*; see fixtures/access-token.ts).
echo "==> Minting admin access tokens"
ADMIN_TOKEN="$(node --experimental-strip-types scripts/admin-token.mjs 2>/dev/null)"
ADMIN_TOKEN_ENV_OFF="$(node --experimental-strip-types scripts/admin-token.mjs e2e-test-secret-key-env-off 2>/dev/null)"
ADMIN_TOKEN_SITE_PASSWORD="$(node --experimental-strip-types scripts/admin-token.mjs e2e-site-password-secret 2>/dev/null)"
if [ -z "$ADMIN_TOKEN" ] || [ -z "$ADMIN_TOKEN_ENV_OFF" ] || [ -z "$ADMIN_TOKEN_SITE_PASSWORD" ]; then
  echo "ERROR: failed to mint admin access tokens"
  exit 1
fi

init_database() {
  local label="$1" url="$2" token="$3"
  shift 3
  echo "==> Initializing $label database"
  curl --connect-timeout 5 --max-time 10 -sf "$@" -H "x-user-access-token: $token" -X POST "$url/admin/db_initialize" > /dev/null
  curl --connect-timeout 5 --max-time 10 -sf "$@" -H "x-user-access-token: $token" -X POST "$url/admin/db_migration" > /dev/null
  echo "    $label database initialized"
}

init_database "worker" "$WORKER_URL" "$ADMIN_TOKEN"

if [ -n "${WORKER_URL_SUBDOMAIN:-}" ]; then
  init_database "subdomain worker" "$WORKER_URL_SUBDOMAIN" "$ADMIN_TOKEN"
fi

if [ -n "${WORKER_URL_ENV_OFF:-}" ]; then
  init_database "env-off worker" "$WORKER_URL_ENV_OFF" "$ADMIN_TOKEN_ENV_OFF"
fi

if [ -n "${WORKER_GZIP_URL:-}" ]; then
  init_database "gzip worker" "$WORKER_GZIP_URL" "$ADMIN_TOKEN"
fi

if [ -n "${WORKER_URL_SITE_PASSWORD:-}" ]; then
  init_database "site-password worker" "$WORKER_URL_SITE_PASSWORD" "$ADMIN_TOKEN_SITE_PASSWORD" -H "x-custom-auth: e2e-site-pass"
fi

echo "==> Running Playwright tests"
npm run test:unit
exec npx playwright test "$@"
