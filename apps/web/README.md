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
| `E2E_ADMIN_PASSWORD` | Playwright | That admin's password (after its forced password change).    |
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
  They need the backend running on echo_dev and the `E2E_*` variables above. They create data
  through the API, named `e2e-<random>`, never touch seeded users or teams, and on exit delete
  the services and deactivate the users that run created. Teams cannot be removed through
  the API, so e2e teams remain.
- `e2e/routes.spec.ts` visits every route at 360, 390, 768 and 1280px: no console errors, no
  horizontal scroll, no clipped content, axe with no serious or critical violations and
  44px touch targets below 1024px. Screenshots go to `.screens/` (gitignored).
- A unit test (`src/lib/no-literals.test.ts`) fails if user-facing text appears outside
  `src/lib/messages.ts`.
- After echo_dev is reset and reseeded, the seeded admin must change its password again
  (to the value in `E2E_ADMIN_PASSWORD`) before the browser tests can create data.

## Structure

- `src/api/`: the only place that touches the network (client, types, session store)
- `src/features/<feature>/`: screens, TanStack Query hooks, tests
- `src/components/ui/`: shadcn/ui. `src/components/`: shared UI
- `src/lib/`: dates and `messages.ts` (all UI text). `src/routes/`: router and route guards

The access token lives only in memory and `sessionStorage`. Dates are shown in Asia/Jakarta
with a "WIB" label.
