# Echo volunteer portal (web)

Indonesian-language web app where Echo volunteers see the service schedule and leaders and
admins manage it. Vite, React, TypeScript (strict), React Router, TanStack Query, Tailwind CSS
and shadcn/ui. It talks to the backend in `../api`. `PLAN.md` holds scope and decisions,
`../../docs/archive/web/DECISIONS.md` (archived) logs the choices made while building,
`../../docs/api/` documents the API.

## Run

Prerequisites: Node.js and a running Echo API (see `../../docs/api/README.md`:
`docker compose up -d --wait db`, `npm run migration:run`, `npm run seed`, `npm run start:dev`).

```bash
npm install        # once, at the repo root (npm workspaces)
npm run dev        # http://localhost:5173/volunteer-portal/ (from apps/web, or `npm run dev:web` at the root)
```

The dev server proxies `/api` to the backend, so the browser stays same-origin. The proxy
target is read in `vite.config.ts` and is never sent to the browser.

## Environment

Set these in the shell that runs the commands. Names only; never commit values.

| Variable             | Used by    | Meaning                                                      |
| -------------------- | ---------- | ------------------------------------------------------------ |
| `API_PROXY_TARGET`   | dev server | Backend URL. Defaults to `http://localhost:3000`.            |
| `E2E_BASE_URL`       | Playwright | App origin only. Defaults to `http://localhost:5173`.        |
| `E2E_ADMIN_EMAIL`    | Playwright | Email of the seeded admin on echo_dev.                       |
| `E2E_ADMIN_PASSWORD` | Playwright | That admin's password.                                       |
| `E2E_USER_PASSWORD`  | Playwright | The default password the API gives users that admin creates. |

`VITE_*` variables are exposed to the browser. Never put a secret in one.

## Scripts

Run from `apps/web`, or from the root with `npm run <script> -w @echo/web`.

| Command         | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `npm run dev`   | Dev server                                              |
| `npm run build` | Typecheck and production build into `dist/`             |
| `npm run check` | Typecheck, lint and unit tests (run before a commit)    |
| `npm test`      | Unit and component tests (Vitest, Testing Library, MSW) |
| `npm run e2e`   | Browser tests (Playwright, Chromium) on the real API    |

## Tests

- Unit and component tests live next to the code and use MSW handlers copied from the API docs.
- Browser tests are in `e2e/`. Install the browser once with `npx playwright install chromium`.
  They need the backend running on echo_dev and the `E2E_*` variables above.
- **The `e2e-` prefix rule.** Everything a browser test creates is named with the prefix `e2e-`:
  user emails (`e2e-<random>@echo.local`), team names and service titles. Never create test data
  without it, and never give seeded data that prefix.
- **Cleanup.** A Playwright global setup (`e2e/global-setup.ts`) runs before every run. It logs
  in as the E2E admin and deletes, through the API and in this order, every `e2e-` service
  (matched by title), team (by name) and user (by email). Teams go before users because the
  team delete also removes the assignments and absence records that would otherwise block
  deleting their leaders and absence takers. It never deletes anything without the prefix, the
  E2E admin (matched by `E2E_ADMIN_EMAIL` and by id) or the shared PEMBINA. It prints counts
  per type only, never names, emails or credentials, and any failed delete fails the whole run.
- **The shared PEMBINA.** `e2e-pembina@echo.local` (password `E2E_USER_PASSWORD`) is created by
  the setup if missing and is the only other account never deleted. The API refuses to delete a
  user who created a service, and a PEMBINA creating a service is a tested flow, so that role
  action uses this one account. Tests must never change, deactivate or delete it.
- **Login once per run.** The setup logs in once as the E2E admin and once as the shared PEMBINA
  and caches both tokens in `.screens/e2e-session.json` (gitignored, owner-only, replaced
  atomically, refreshed from `X-Access-Token`, removed when the run ends, never printed).
  Browser sessions get the token injected into `sessionStorage` (`seedSession`), because
  Playwright `storageState` does not cover `sessionStorage`. Tests that create their own users
  log in as those users, once each; the login-flow tests do too, never as the E2E admin. The
  run ends with a count of login calls by account type (counts only), and the design keeps
  every account at 5 logins or fewer (the backend's default `LOGIN_RATE_LIMIT`).
- Lists are paginated, so specs find records with `findInList` (and `expectNotInList`) in
  `e2e/fixtures.ts`, never by assuming page 1.
- `e2e/routes.spec.ts` visits every route at 360, 390, 768 and 1280px: no console errors, no
  horizontal scroll, no clipped content, axe with no serious or critical violations and
  44px touch targets below 1024px. Screenshots go to `.screens/` (gitignored).
- A unit test (`src/lib/no-literals.test.ts`) fails if user-facing text appears outside
  `src/lib/messages.ts`.
- Users that created a service, assigned someone or recorded an absence cannot be deleted by the
  API (409). The cleanup relies on deleting teams first. Leftovers from runs made before the
  cleanup existed may include such users, which then fail the setup: reset echo_dev once.

## Structure

- `src/api/`: the only place that touches the network (client, types, session store)
- `src/features/<feature>/`: screens, TanStack Query hooks, tests
- `src/components/ui/`: shadcn/ui. `src/components/`: shared UI
- `src/lib/`: dates and `messages.ts` (all UI text). `src/routes/`: router and route guards

The access token lives only in memory and `sessionStorage`. Dates are shown in Asia/Jakarta
with a "WIB" label.
