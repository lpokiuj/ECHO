# Echo public site

Indonesian-language public website of Echo: one long home page (`/`), a prayer request page
(`/doa`) and a volunteer registration page (`/relawan`). No login. Vite, React, TypeScript (strict),
React Router, TanStack Query, Tailwind CSS and shadcn/ui. It talks to the backend in `../api`
through `/api` (see `../../docs/api/public.md`). `CLAUDE.md` holds the rules for working here.

## Install and run

Prerequisites: Node.js. A running Echo API is only needed for the `/api` features and the browser
tests (`docker compose up -d --wait db`, then see `../../docs/api/README.md`).

```bash
npm install        # once, at the repo root (npm workspaces)
npm run dev        # http://localhost:5174/ (from apps/public, or `npm run dev -w @echo/public` at the root)
```

The dev server uses port 5174 (strict: it fails instead of picking another port; the portal uses 5173) and proxies `/api` to the backend, so the browser stays same-origin.

## Environment

Set these in the shell that runs the commands, or in the env files noted below. Names only; never
commit secrets. `.env.example` lists them all.

| Variable              | Used by         | Meaning                                                                                                        |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| `VITE_PORTAL_URL`     | browser (build) | Target of the footer link "Portal Relawan". Default `/volunteer-portal/`. `.env.development` sets the dev URL. |
| `API_PROXY_TARGET`    | dev server      | Backend URL. Defaults to `http://localhost:3000`. Never sent to the browser.                                   |
| `E2E_PUBLIC_BASE_URL` | Playwright      | Origin of the public dev server. Defaults to `http://localhost:5174`.                                          |
| `E2E_ADMIN_EMAIL`     | Playwright      | Email of the E2E admin on echo_dev (same account as apps/web).                                                 |
| `E2E_ADMIN_PASSWORD`  | Playwright      | That admin's password.                                                                                         |

`VITE_*` variables are exposed to the browser. `vite build` does not read `.env.development`, so a
production build uses the default path unless `VITE_PORTAL_URL` is set when building.

## Scripts

Run from `apps/public`, or from the root with `npm run <script> -w @echo/public`.

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server on port 5174                                 |
| `npm run build`     | Typecheck and production build into `dist/`             |
| `npm run check`     | Typecheck, lint and unit tests (run before a commit)    |
| `npm test`          | Unit and component tests (Vitest, Testing Library, MSW) |
| `npm run e2e`       | Browser tests (Playwright, Chromium)                    |
| `npm run typecheck` | `tsc -b`                                                |
| `npm run lint`      | ESLint                                                  |

## Where to edit

- **Title, meta and Open Graph**: the page titles are `site.titles` (set per route by
  `useDocumentTitle`; home is plain `ECHO`). The static tags in `index.html` (title, description,
  `theme-color`, `og:*`, `twitter:card`) cannot import from `site.ts`, so their values live in
  `site.meta` and `src/content/meta.test.ts` fails if they drift apart. `public/og-image.svg` is a
  placeholder: in production replace it with a 1200x630 PNG and an absolute URL (scrapers such as
  WhatsApp and Facebook ignore SVG and relative paths).
- **Text**: everything visitors read is in `src/content/site.ts` (navigation, section titles,
  footer, contact and social placeholders, error messages). Placeholders say "akan diisi": replace
  them with real content. Components never contain copy.
- **Home sections** (page order: hero, Ibadah, Lokasi, Acara, Tentang Kami, Pertama Kali?, Kontak,
  Persembahan; the key order of `site.sections` is the page order). The hero, the worship schedule
  (`sections.worship`), the address and map (`sections.location`), Tentang Kami with vision, story
  and the bidang overview (`sections.about`, static text), the FAQ (`sections.faq`, an accordion),
  Kontak (`sections.contact`) and Persembahan (`sections.giving`) are all in `src/content/site.ts`.
  Contact and giving values (WhatsApp, Instagram, email, bank, QRIS) are plain-text placeholders
  ("akan diisi"), not links, and `content.test.ts` rejects real-looking numbers; real links will
  need a small builder in `src/lib` like `maps.ts`. There are no separate Doa or Relawan sections:
  those are pages, reached from the hero, the header and the burger. To point the map at the real church,
  change `sections.location.map.query` (the embed URL is built in `src/lib/maps.ts`). The Google Maps
  base URL there is the only external URL on the site.
- **Events**: `src/content/events.ts` (static list). The app reads events only through
  `getEvents()` in `src/lib/events.ts`, so the source can later become an API. The Acara section
  shows only `upcomingEvents(list, now)` (sorted, `startsAt < now` hidden) through
  `useUpcomingEvents()`, with loading, error (retry) and empty states.
- **Prayer form** (`/doa`): labels, hints, validation messages, the privacy note and the success
  text are in `site.pages.prayer` (`form`, `success`); the 429, 400, network and server banners use
  `site.errors`. Limits (2000, 100, 100) mirror the API in `src/features/prayer/limits.ts`. Code in
  `src/features/prayer/` (schema, hook, form, success screen); shared field pieces are
  `src/components/FormField.tsx` and `src/components/ui/{input,textarea,label,checkbox}.tsx`.
- **Volunteer form** (`/relawan`): labels, hints, validation messages, the bidang notes (loading, failed,
  empty) and the success text are in `site.pages.volunteer` (`form`, `success`); error banners use
  `site.errors`. Limits (100, 30, 255, 500, 1000, 20 bidang) mirror the API in
  `src/features/volunteer/limits.ts`. The bidang come from `GET /public/bidang` (`useBidang`, no retry)
  and render as a checkbox group; if the call fails or the list is empty the group is hidden, a short
  note shows and the form still submits without `bidangIds`. Code in `src/features/volunteer/`
  (schema, hooks, `BidangPicker`, form, success screen).
- **Logo**: `src/components/Logo.tsx` (the "E" mark and the "ECHO" wordmark) and `public/favicon.svg`.
- **Colors, radius, font**: tokens in `src/index.css`, copied from the portal so the brand matches.

## Tests

- Unit and component tests sit next to the code (`*.test.ts(x)`); MSW handlers copy the examples in
  `../../docs/api/public.md`.
- Browser tests are in `e2e/` (install the browser once with `npx playwright install chromium`):
  a smoke test at 360px through the burger menu, the footer portal link, and a responsive check at
  360, 768 and 1280px (no console errors, no horizontal scroll, 44px touch targets, axe with no
  serious or critical violations). `e2e/home.spec.ts` covers the hero buttons, the header and burger
  section links (with the sticky header offset), reduced motion and the map iframe attributes.
  `e2e/sections.spec.ts` covers Acara (past hidden and the empty state, by fixing the page clock
  with `page.clock.setFixedTime`), the FAQ keyboard behaviour, axe with an item open, and the
  header at 1024px.
  `e2e/prayer.spec.ts` covers /doa: client-side validation (nothing is sent), mocked 429, 400, 500
  and network errors with the data kept, disabled-while-sending, the honeypot (not reachable by Tab,
  sent as `website`), 44px targets and axe on the idle, error and success states. Exactly one test,
  tagged `[real]`, posts to the real backend (name `e2e-<random>`): one real POST per full run.
  `e2e/prayer-mocks.ts` makes that safe: every test gets a default route for the endpoint that
  aborts the request and fails the test; a test must opt in with `prayer.mock(...)` or
  `prayer.real()`. While iterating run `npx playwright test e2e/prayer.spec.ts --grep-invert "\[real\]"`.
  `e2e/volunteer.spec.ts` covers /relawan the same way: bidang options from the API (real in the
  `[real]` test, stubbed with `mockBidang` elsewhere), the bidang loading, empty and failed states
  (the form still submits), client-side blocking (invalid email, missing fields), mocked 429, 400, 500
  and network errors, honeypot, 44px targets and axe. Exactly one test, tagged `[real]`, posts to the
  real backend (`fullName` `e2e-<random>`). `e2e/volunteer-mocks.ts` is the same default-route guard
  as `prayer-mocks.ts` for `/public/volunteer-applications` (`volunteer.mock(...)` / `volunteer.real()`).
  Browser tests never load Google: `e2e/maps-mock.ts` answers requests to google.com locally.
  Screenshots go to `.screens/` (gitignored).
- **Cleanup.** `e2e/global-setup.ts` runs before every run. It logs in once as the E2E admin
  (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`), caches the token in `.screens/e2e-session.json`
  (owner-only, atomic, removed when the run ends) and deletes, through the admin API, every prayer
  request whose `name` starts with `e2e-` and every volunteer application whose `fullName` starts
  with `e2e-`. It deletes nothing else, prints counts only and fails the whole run on any failed
  call. Everything a browser test submits must be named `e2e-<random>`.
- **Rate limit.** The public POST endpoints allow 5 requests per 10 minutes per IP per endpoint, in
  memory in the backend; a real-backend e2e cannot reset it without restarting the backend. Keep
  real submissions few (the forms in F4 and F5 are mostly covered by mocked tests). The prayer
  form's `[real]` e2e test sends 1 POST per run, and so does the volunteer form's (each endpoint has
  its own counter).

## Structure

- `src/content/`: all text and static events
- `src/api/`: the only place that touches the network
- `src/pages/`: route components. `src/features/<feature>/`: feature UI and hooks (`home/`: hero,
  Ibadah, Lokasi, Tentang, FAQ, Kontak, Persembahan; `prayer/`: the /doa form; `volunteer/`: the /relawan form)
- `src/components/`: shared UI. `src/components/ui/`: shadcn/ui
- `public/`: static files (`favicon.svg`, placeholder `og-image.svg`)
- `src/lib/`, `src/hooks/`, `src/routes/`, `src/test/`

The laptop POC script (`scripts/poc-up.sh`) serves only the portal; the public site is not part of it.
