# CLAUDE.md (apps/web)

Frontend for the Echo volunteer portal, built autonomously with Vite and React. Read
PLAN.md before any task. PLAN.md is the source of truth for scope and decisions.
`../../docs/api/` is the source of truth for the API.

## Commands (edit if scripts differ)

- Install once at the repo root: `npm install`, then once `npx playwright install chromium`.
  Run the scripts below from `apps/web`, or from the root with `npm run <script> -w @echo/web`.
- Dev server: `npm run dev` (http://localhost:5173/volunteer-portal/)
- All checks: `npm run check` (typecheck + lint + unit tests)
- Unit tests: `npm test`
- Browser tests: `npm run e2e` (needs the backend running on echo_dev and the `E2E_*` env vars)

## Structure

- `src/api/`: the ONLY place that touches the network (`client.ts`, types, session store)
- `src/features/<feature>/`: screens, TanStack Query hooks, tests
- `src/components/ui/`: shadcn/ui. `src/components/`: shared UI.
- `src/lib/`: dates, `messages.ts`. `src/routes/`: router setup and route guards.

## Decide vs ask

Decide yourself, and log non-obvious choices in PLAN.md Decisions in the same commit:
component structure, layout, naming, Indonesian copy, UI states, helpers, and use of
approved libraries.

STOP and ask me before:

- anything affecting security (token storage, CORS, what is logged or stored)
- a dependency not on the approved list in PLAN.md
- a change needed in the backend (write it in `../../docs/backend-requests.md` instead)
- the docs disagreeing with the real API's behavior
- adding a screen or feature not in PLAN.md, or polish beyond the UI quality bar
- anything destructive to data beyond what Data safety allows
  When asking, give 2 or 3 options with a recommendation and the reason, then wait.

## Rules

- All HTTP goes through `src/api/client.ts`. No `fetch` in components.
- Server state lives in TanStack Query hooks. No global store for server data.
- Types for API data live in one module. No `any`. No `@ts-ignore` without a written
  reason. Generated types are never hand-edited.
- The token lives only in the session store (memory plus `sessionStorage`). Never in
  `localStorage`, a URL, a log, a screenshot, or a test file. Nothing secret goes in code:
  Vite exposes every `VITE_*` value to the browser.
- The app lives under `/volunteer-portal/` (Vite `base` + router basename). Keep `PATHS` basename-relative; `/api` stays at the origin root. In e2e use relative `goto('teams')`, never `goto('/teams')`.
- Role-based UI comes from `GET /me`. Hiding UI is UX only. Handle 403 on every call.
- Follow the UI quality bar in PLAN.md. Use shadcn/ui and the theme tokens. No native
  `alert`, `confirm`, or `prompt`.
- All UI text is Indonesian and lives in `src/lib/messages.ts`. Use the terms in the
  PLAN.md Language decision. Tests import text from there.
- Never show raw backend message text. Map error codes and statuses to Indonesian
  messages, with a generic fallback. Show field-level messages when the response names the field.
- Client validation is a convenience. Always handle the server's 400 and 409 as well.
- Dates: use the helper module only. Display in Asia/Jakarta with a "WIB" label. Send ISO 8601
  with an explicit offset. Never parse a date string that has no timezone.
- Never weaken, skip, or delete a test to make it pass. If a test seems wrong, stop and explain why.
- Every acceptance criterion in PLAN.md needs a test or a Playwright check.
- Layouts must work from 360px up: no horizontal scroll, touch targets at least 44px, dialogs that fit small screens.

## Data safety (echo_dev)

- echo_dev is free to use for development and Playwright runs. Create, edit, and deactivate
  data through the API as much as you need. Every e2e run starts by deleting all `e2e-` data
  through the API (`e2e/global-setup.ts`), so leftovers never accumulate and need no report.
- You may run the backend's own `migration:run` and `seed` scripts against echo_dev when the
  baseline is missing. Nothing else on the backend or the database: no SQL, no drops or
  truncation, no volume wipes, no edits under `apps/api`. If you think a wipe is needed, tell me.
- Name data you create `e2e-<random>` (emails `e2e-<random>@echo.local`); the cleanup matches
  that prefix and deletes nothing else. Never change seeded users or teams. The E2E admin and
  the shared PEMBINA (`e2e-pembina@echo.local`) are the only `e2e-` accounts that are kept: never
  change, deactivate or delete them. A role action that creates services runs as the shared
  PEMBINA, because such a user can never be deleted. Log in as the E2E admin only through the
  cached session (`adminToken`, `seedSession`), never per test.
- Never assume an empty database. Never depend on data left by another spec.

## Verification (nobody reviews every diff, so these gates are real)

- Run `npm run check` yourself and report the real output.
- For every UI feature, run the app against the real backend and exercise the screen with
  Playwright at 3360px, 390px, 768px, and 1280px wide. Save screenshots in `.screens/` (gitignored),
  look at them, and judge them against the UI quality bar. List what you found and fixed.
  Report console errors and axe results.
- MSW handlers copy real response examples from `../../docs/api/`. Never invent a response shape.
- Never say a screen works without having run it.

## Workflow

- One feature per session. Start in plan mode and show the plan before editing.
- Keep diffs readable. If one grows past what a person can review in 15 minutes, split the task.
- One commit per feature: `feat(web): <what>`.
- When a decision changes, update PLAN.md in the same commit.
- Tick the feature in the PLAN.md Status list only after the checks pass.

## Don't

- Don't install a dependency outside the approved list without asking.
- Don't add another component library besides shadcn/ui.
- Don't refactor outside the current feature.
- Don't put secrets or real tokens in code, docs, tests, or screenshots.

The initial build is complete (features 1 to 10). For changes, keep diffs small and update PLAN.md only when a rule, decision, or documented behavior changes