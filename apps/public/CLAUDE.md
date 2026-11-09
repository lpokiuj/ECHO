# CLAUDE.md (apps/public)

The public website of Echo (Indonesian, no login): a long home page, `/doa` (prayer request form,
F4) and `/relawan` (volunteer form, F5). Vite, React, TypeScript, React Router, TanStack Query,
shadcn/ui, lucide-react. `../../docs/api/` is the API contract (`public.md` for this app).
It mirrors `apps/web` (same config, same theme tokens); read `../web/CLAUDE.md` for the shared habits.

## Commands

- Install once at the repo root: `npm install`, then once `npx playwright install chromium`.
  Run scripts from `apps/public`, or from the root with `npm run <script> -w @echo/public`.
- Dev server: `npm run dev` (http://localhost:5174/, port is strict)
- All checks: `npm run check` (typecheck + lint + unit tests)
- Unit tests: `npm test`. Browser tests: `npm run e2e` (needs the backend on echo_dev and
  `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in the shell)

## Structure

- `src/content/`: ALL user-facing text (`site.ts`) and the static events (`events.ts`)
- `src/api/`: the only place that touches the network (`client.ts`, types, errors)
- `src/lib/`: `events.ts` (`getEvents()`), `env.ts` (`getPortalUrl()`), `dates.ts`, `utils.ts`
- `src/pages/`: the route components. `src/features/<feature>/`: feature UI and hooks (F2 to F5;
  `home/` holds the hero, Ibadah and Lokasi sections)
- `src/components/`: shared UI (Logo, header, footer, layout). `src/components/ui/`: shadcn/ui
- `src/hooks/`, `src/routes/` (router, `PATHS`), `src/test/` (Vitest setup, render helper, MSW handlers)

## Rules

- No auth at all: no token, no login code, no cookies, no `localStorage`/`sessionStorage` (ESLint
  enforces it). All HTTP goes through `src/api/client.ts` (`getBidang`, `submitPrayerRequest`,
  `submitVolunteerApplication`). No `fetch` in components. Never send an Authorization header.
- All copy lives in `src/content/`. Components never hard-code text (`no-literals.test.ts`).
  Tests and e2e import text from `site.ts`. Indonesian, same terms as the portal ("Bidang",
  "Relawan", "Ibadah"). Placeholders must be obvious ("Alamat akan diisi"); never invent facts
  (addresses, phone numbers, bank accounts, URLs). `content.test.ts` checks it. The one allowed
  external URL is the Google Maps base in `site.sections.location.map.baseUrl` (exact match in
  `content.test.ts`); the embed URL is built from it and `map.query` in `src/lib/maps.ts`. Unit and
  e2e tests never load Google (e2e uses `mockGoogleMaps` from `e2e/maps-mock.ts`).
- Events are read only through `getEvents()` (`src/lib/events.ts`, async) via the `useEvents()`
  query hook. ESLint forbids importing `@/content/events` anywhere else.
- Never import from `apps/web` (ESLint enforces it). Copy what you need (theme tokens, Logo glyph,
  shadcn files). Copy shadcn components from `apps/web/src/components/ui/`; do not run the shadcn
  CLI (it adds unapproved packages). Replace any `messages` import with `site` from `@/content/site`.
- One `<Logo />` (`src/components/Logo.tsx`). Icons: lucide-react only.
- Use the theme tokens in `src/index.css`; no hex colors, no `[Npx]` sizes in components
  (`tokens.test.ts`). No images from the internet or stock photos: gradients, shapes, blocks.
- Design: mobile-first, right at 360px first, then up to 1280px. Touch targets >= 44px, no horizontal
  scroll, no axe violations of serious or critical level, respect `prefers-reduced-motion`, no
  carousels or heavy animation. Every screen that loads data has loading, error and empty states.
- Never show raw backend message text; map to `site.errors`. Handle 400 and 429 on every POST.
- The portal link comes from `getPortalUrl()` (`VITE_PORTAL_URL`, default `/volunteer-portal/`).
  Every `VITE_*` variable the app reads must be listed in `.env.example` (`env-example.test.ts`).
  VITE_* values reach the browser: never put a secret in one.
- Never weaken, skip or delete a test. No `any`, no `@ts-ignore`, no `.only`, no `.skip`.
- Only approved dependencies (the ones `apps/web` uses, plus `react-hook-form`, `zod`,
  `@hookform/resolvers` which are already listed). Ask before adding anything else.
- The web and api apps are never edited from here. Backend needs go in `../../docs/backend-requests.md`.
- Do not commit unless asked. One commit per feature: `feat(public): <what>`.

## Data safety (echo_dev) and e2e

- Every e2e run starts with `e2e/global-setup.ts`: it logs in ONCE as the E2E admin, caches the token
  in `.screens/e2e-session.json` (gitignored, mode 0600, atomic rename, removed at teardown, never
  printed) and deletes through the admin API every prayer request whose `name` starts with `e2e-` and
  every volunteer application whose `fullName` starts with `e2e-`. Prefix only; nothing else is
  deleted. It prints counts only (never names, emails, credentials). Any failed list or delete call
  (any status other than 200 / 204) fails the whole run. Tests never log in again (`adminToken()`
  in `e2e/fixtures.ts`; pass response headers to `refreshFrom` after admin calls).
- **F4 and F5 tests MUST always send an `e2e-` name** (`name` of a prayer request, `fullName` of an
  application; use `e2eName()`). A prayer request without a name cannot be matched by the cleanup
  and would stay in echo_dev forever.
- Rate limit: the public POSTs allow 5 per 10 minutes per IP per endpoint (every request counts,
  including 400s and honeypot hits), counted in memory by the backend. A real-backend e2e cannot
  reset it and the backend must not be restarted from here. Keep real POSTs to a minimum (at most
  5 per endpoint per 10 minutes across a whole run); cover validation, 400, 429 and error states with
  Vitest + MSW or `page.route` mocks. F1 sends no POSTs.

## Decisions

- Own Vite port 5174 (strict), `base: '/'`, `/api` proxied to `API_PROXY_TARGET` like apps/web.
  Playwright base URL variable is `E2E_PUBLIC_BASE_URL` (apps/web uses `E2E_BASE_URL`).
- Theme tokens copied from apps/web without the portal-only sidebar/topbar tokens; radius is 0.75rem
  (rounder cards for the youth feel). Light theme only.
- `react-router` (not `react-router-dom`), like apps/web.
- Home section order follows the plan: hero, Ibadah, Lokasi, Kegiatan, Tentang, then the rest; the
  header links follow the same order. Hash links scroll via `useHashScroll` in `SiteLayout`, which
  also depends on `location.key` so clicking the same link twice scrolls twice. The map iframe has
  no `sandbox` attribute (decision), and the open-in-Maps link is the fallback when it does not show.
