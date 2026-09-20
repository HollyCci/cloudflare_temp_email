# E2E Tests

End-to-end tests for Cloudflare Temp Email using [Playwright](https://playwright.dev/) and [Mailpit](https://mailpit.axllent.org/), fully containerized with Docker Compose.

## Prerequisites

- **Docker** and **Docker Compose**

## Quick Start

```bash
cd e2e

# Build, start all services, run tests, and exit
npm test

# Clean up containers and volumes
npm run test:down
```

`npm test` runs `docker compose up --build`, which:
1. Starts **Mailpit** (SMTP on :1025, HTTP API on :8025)
2. Builds and starts the **Worker** (wrangler dev on :8787)
3. Builds and starts the **Frontend** (vite dev on :5173)
4. Builds and runs the **E2E runner** (Playwright), which waits for services, initializes the DB, and runs all tests

The exit code reflects the test result.

## Test Structure

| Project | Directory | What it tests |
|---------|-----------|---------------|
| `api` | `tests/api/` | Worker API endpoints — health check, address CRUD, send mail via SMTP |
| `browser` | `tests/browser/` | Frontend UI — login, inbox view, reply with HTML, XSS sanitization |

## Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| Mailpit SMTP | `mailpit` | 1025 | Captures outgoing emails |
| Mailpit HTTP | `mailpit` | 8025 | API to verify captured emails |
| Worker | `worker` | 8787 | Backend API with E2E config |
| Frontend | `frontend` | 5173 | Vue frontend dev server |

## Test Results

Test results and HTML reports are exported via volumes:
- `e2e/test-results/` — test artifacts
- `e2e/playwright-report/` — HTML report

## Configuration

The E2E worker uses `fixtures/wrangler.toml.e2e` with:
- `ADMIN_USER_EMAILS = ["admin@test.example.com"]` — bootstrap admin account for browser tests (`loginAsBootstrapAdmin`)
- `DEFAULT_SEND_BALANCE = 10` — allows sending without admin approval
- SMTP pointed at Mailpit container (`mailpit:1025`)

Admin APIs are role-based (`x-user-access-token` carrying the `admin` role); there is no admin password.
`fixtures/access-token.ts` signs tokens with the fixture `JWT_SECRET`s:
- API projects attach an admin token to every `request` call via `extraHTTPHeaders` in `playwright.config.ts`.
- Browser tests import `test` from `fixtures/test.ts`, whose `request` fixture does the same.
- `ADMIN_HEADERS` / `ADMIN_HEADERS_ENV_OFF` / `SITE_ADMIN_HEADERS` in `fixtures/test-helpers.ts` target the individual worker variants.
- `scripts/docker-entrypoint.sh` mints the tokens used for database initialization with `scripts/admin-token.mjs`.

Test-only endpoints under `/__test/*` are registered in `e2e/fixtures/worker.ts` and are excluded from the production Worker.
