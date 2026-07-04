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

The axe accessibility suite covers `/`, `/community`, `/discover`, `/discover/groups`, `/signin`, `/signup`, and the signed-out `/dashboard` guard after it redirects to sign in. It checks detectable WCAG 2.0 and 2.1 Level A and AA violations in Chromium, including `color-contrast`. It also verifies mobile navigation dismissal and focus restoration, the skip link, and signed-out authentication form tab order.

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
npm run test:a11y
```

The accessibility suite uses the same local server, placeholder environment values, reports, and artifact directories as the smoke suite. It does not require GitHub secrets or production credentials.

The smoke tests start the local Next.js server through Playwright unless `PLAYWRIGHT_BASE_URL` is set. CI should leave `PLAYWRIGHT_BASE_URL` unset so the run validates the checked-out application in isolation.

## GitHub Secrets

No GitHub secrets are required for the current CI workflow. Do not add production Supabase credentials to CI. The placeholder Supabase values in `.github/workflows/ci.yml` are not credentials and must stay pointed at localhost.

If future authenticated or database-backed tests need secrets, use a disposable test Supabase project only. Keep those values scoped to GitHub Actions secrets, document them here before use, and keep all test data isolated from production.

## Playwright Reports

Playwright writes its HTML report to `playwright-report/` and per-test artifacts to `test-results/`. The repository ignores both directories.

CI namespaces smoke and accessibility output under `playwright-report/smoke/`, `playwright-report/a11y/`, `test-results/smoke/`, and `test-results/a11y/`, then uploads both root directories after every workflow run. Failure screenshots are saved under `test-results/`, and traces are captured on the first retry. Download the `playwright-report` artifact from the GitHub Actions run summary to inspect the HTML reports locally.

For local report review after running either Playwright suite:

```bash
npx playwright show-report
```

## Future Visual Regression Baseline

Do not add screenshot assertions until each route can render from deterministic fixtures or an explicitly controlled fallback state. The first baseline should cover:

- `/` at the hero and first content section.
- `/community`, `/discover`, and `/discover/groups` with deterministic empty or unavailable states.
- `/signin` and `/signup`.
- The signed-out `/dashboard` redirect state.
- The branded not-found page.

Capture each route at `1440x900` desktop and `390x844` mobile viewports. Add `768x1024` tablet captures only for layouts with a distinct tablet breakpoint or interaction pattern.

Approve new snapshots only when the visual change is intentional, the pull request explains the expected difference, and a reviewer has inspected the rendered diff at every affected viewport. Generate and approve baselines with the pinned CI Chromium version and the same operating system used by CI; never approve snapshots only to make an unexplained failure pass.

To avoid flaky comparisons, use fixed test data and time, disable animations and transitions, wait for fonts and images to finish loading, keep viewport size and device scale factor fixed, and mask timestamps, remote media, or other unavoidable dynamic regions. Do not capture production data or depend on live external services. Keep thresholds strict and scoped; prefer stabilizing the page over increasing pixel-difference tolerance.

## Manual QA

The smoke and axe suites verify public rendering, signed-out route protection, public metadata endpoints, and programmatically detectable WCAG issues on selected signed-out pages. Manual QA is still required before release for authenticated workflows, role-specific platform tools, media uploads, messaging, notifications, events, prayer requests, group interactions, database behavior, and RLS policy behavior.

Accessibility still requires manual contrast review over real uploaded imagery, complete keyboard-only navigation, visible focus review, screen-reader testing, zoom and text reflow checks, reduced-motion behavior, touch target review, and validation of content meaning and reading order. Cross-browser and mobile assistive-technology coverage also remains manual.
