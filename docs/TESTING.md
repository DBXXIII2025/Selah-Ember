# Automated Testing

Phase 17 starts with a read-only Playwright smoke suite. It is designed for local development and must not be pointed at production.

## Setup

Install project dependencies and the Chromium browser used by the suite:

```bash
npm install
npx playwright install chromium
```

Create `.env.local` from `.env.example`. Use a local or development Supabase project, not production credentials. Public discovery and community pages perform real read-only queries, so `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be valid. The application currently also requires `SUPABASE_SERVICE_ROLE_KEY` for server-only application paths; keep it out of source control and browser code.

## Run

Run the smoke suite with its automatically managed local Next.js server:

```bash
npm run test:e2e
```

Run the automated accessibility suite separately:

```bash
npm run test:a11y
```

The server defaults to `http://127.0.0.1:3100`. Override its port with `PLAYWRIGHT_PORT`. To test an already running non-production deployment instead, set `PLAYWRIGHT_BASE_URL`; Playwright will not start another server.

The managed server allows up to five minutes to start because this repository may run from a slower Windows workspace drive.

For local interactive debugging:

```bash
npm run test:e2e:ui
```

## Current Coverage

- Public home, community discovery, group discovery, and open community feed rendering.
- Sign-in and sign-up rendering.
- Signed-out redirects for representative protected and platform routes.
- Absence of platform navigation for signed-out visitors.
- `robots.txt`, `sitemap.xml`, and branded 404 responses.

The axe accessibility suite covers `/`, `/community`, `/discover`, `/discover/groups`, `/signin`, `/signup`, and the signed-out `/dashboard` guard after it redirects to sign in. It checks detectable WCAG 2.0 and 2.1 Level A and AA violations in Chromium. The `color-contrast` rule is explicitly excluded because current image-backed pages produce unreliable automated results and existing controls have known contrast debt; contrast remains a required manual check until a dedicated design remediation pass is complete.

All current tests are read-only. They do not submit forms, create accounts, authenticate test users, upload media, or mutate application data.

## Intentionally Deferred

- Authenticated user and platform-engineer journeys.
- Group discussions, messages, prayer requests, events, RSVPs, notifications, and media mutations.
- Database and RLS policy tests.
- Cross-browser projects beyond Chromium.
- Visual regression tests.

Add those only after isolated test accounts, deterministic fixtures, and a disposable test database are available.

## Continuous Integration

GitHub Actions runs `.github/workflows/ci.yml` on pull requests and pushes to `main`. The CI job intentionally uses only repository code and public environment behavior; it must not be configured with production credentials, production data, schema changes, RLS changes, or feature setup.

The workflow defines non-secret localhost Supabase placeholder values because the application requires those environment variables to exist at build and runtime. The smoke suite relies on public-page fallbacks when that local placeholder Supabase endpoint is unavailable.

The pipeline runs:

```bash
npm ci
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The current workflow runs only the smoke suite. When accessibility checks are promoted into CI, add the following step after Chromium is installed and after the smoke suite:

```bash
npm run test:a11y
```

The accessibility suite uses the same local server, placeholder environment values, reports, and artifact directories as the smoke suite. It does not require GitHub secrets or production credentials.

The smoke tests start the local Next.js server through Playwright unless `PLAYWRIGHT_BASE_URL` is set. CI should leave `PLAYWRIGHT_BASE_URL` unset so the run validates the checked-out application in isolation.

## GitHub Secrets

No GitHub secrets are required for the current CI workflow. Do not add production Supabase credentials to CI. The placeholder Supabase values in `.github/workflows/ci.yml` are not credentials and must stay pointed at localhost.

If future authenticated or database-backed tests need secrets, use a disposable test Supabase project only. Keep those values scoped to GitHub Actions secrets, document them here before use, and keep all test data isolated from production.

## Playwright Reports

Playwright writes its HTML report to `playwright-report/` and per-test artifacts to `test-results/`. The repository ignores both directories.

CI uploads both directories as artifacts after every Playwright run, including failed runs. Failure screenshots are saved under `test-results/`, and traces are captured on the first retry. Download the `playwright-report` artifact from the GitHub Actions run summary to inspect the HTML report locally.

For local report review after running either Playwright suite:

```bash
npx playwright show-report
```

## Manual QA

The smoke and axe suites verify public rendering, signed-out route protection, public metadata endpoints, and programmatically detectable WCAG issues on selected signed-out pages. Manual QA is still required before release for authenticated workflows, role-specific platform tools, media uploads, messaging, notifications, events, prayer requests, group interactions, database behavior, and RLS policy behavior.

Accessibility still requires manual color-contrast validation, keyboard-only navigation, visible focus review, screen-reader testing, zoom and text reflow checks, reduced-motion behavior, touch target review, and validation of content meaning and reading order. Cross-browser and mobile assistive-technology coverage also remains manual.
