# Echo Volunteer Portal: Frontend PLAN.md (auto version)

Directory: `apps/web-auto`. Built by Claude with minimal human involvement.
A separate learning version lives in `apps/web-learn`. Never copy code between them.

## Goal

A professional, mobile-first web app in Indonesian where Echo volunteers see the service
schedule, and where leaders and admins manage it. It talks to the backend in `apps/api`.

## Source of truth for the API

- `../api/docs/api/`: `README.md` (conventions), one file per area, `flows.md`, and the
  permission matrix.
- Use only endpoints documented there. Field names, error codes, and behaviors in THIS
  file come from the backend specs and may be stale. The docs win.
- If the docs disagree with how the real API behaves, stop, add the finding to
  `BACKEND_REQUESTS.md`, and ask me. Do not work around it silently.
- Never edit anything under `apps/api`. Needed backend changes go in `BACKEND_REQUESTS.md`.

## Screens by role

Routes live at the root (no `/volunteer` prefix).

| Who                                                  | Screens                                                   |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Everyone logged in                                   | Login, forced password change, My schedule, Full schedule |
| Team leader (any `isLeader` membership in `GET /me`) | + Assign screen for each team they lead                   |
| PEMBINA, ADMIN                                       | + Services management                                     |
| ADMIN                                                | + Users, Teams and membership                             |

The UI hides what a role can't use, but the backend is the authority. Every 403 must be
handled with a clear message, never a blank screen.

## Behaviors that matter (confirm names against the docs)

- Every authenticated response may carry a fresh token in `X-Access-Token`. Replace the
  stored token whenever it is present (15-minute sliding idle window).
- 401 means not authenticated: clear the session and go to login. EXCEPTION:
  `POST /auth/change-password` returning 401 means the current password was wrong, not
  that the session expired. Show an inline error and stay logged in.
- 403 with code `PASSWORD_CHANGE_REQUIRED`: redirect to the forced password change page.
  Only that page and `GET /me` work until the password is changed.
- After login call `GET /me` and build navigation from `role` and the memberships.
- Assigning is a race by design: a request can partly succeed. Show who was added and who
  was skipped, with the reason. Always refetch candidates after an assign response,
  successful or not.
- `GET /services` hides ended services by default; `?includePast=true` shows all.
- No pagination in v1.

## UI quality bar ("professional" means this checklist, not taste)

Polish beyond this list needs my approval.

- Tokens: colors, radius, spacing, and type scale are CSS variables via the Tailwind theme.
  No hardcoded hex values or magic pixel sizes in components.
- Shell: sidebar at 1024px and up; a top bar with a menu sheet below that. Every page uses
  one header pattern (title, one-line description, primary action).
- Components: shadcn/ui primitives for buttons, inputs, selects, dialogs, dropdowns,
  tables, tabs, badges, toasts, and skeletons. No `alert`, `confirm`, or `prompt`.
- States: hover, focus-visible, disabled, and loading on every interactive element. Lists
  load with skeletons and cause no layout shift. Empty states have an icon, one sentence,
  and a next action. Errors are plain sentences with a retry, never raw codes or traces.
- Feedback: a toast for every mutation outcome. Destructive actions use a confirm dialog
  that names what will change.
- Lists: tables on desktop, cards below 768px.
- Typography: Inter, self-hosted. Inputs are at least 16px. One date format everywhere.
- Accessibility: `<html lang="id">`, WCAG 2.2 AA contrast, visible focus ring, full keyboard
  operation, labelled inputs, `aria-live` for async results, `prefers-reduced-motion`
  respected. axe reports no serious or critical violations on any route.
- Details: a page title per route, favicon, a not-found page and an error page, role badges
  and initials avatars used consistently.
- Brand: none supplied. Use a neutral theme with one accent color and log the choice.
  Replace this line if I give you brand colors, a logo, or fonts.
- Responsive: works from 360px to 1920px. No horizontal page scroll. 
  Touch targets at least 44px tall below 1024px. Dialogs fit a 360px screen (bottom sheet or full screen on small screens). Forms are single column below 768px.

## Decisions (change them here, not in code)

| Decision              | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reason                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Framework             | Vite, React, TypeScript (strict), React Router, TanStack Query, Tailwind CSS, shadcn/ui. A single-page app with no server layer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Simplest fit for a logged-in app in front of a separate API                                                                       |
| Approved dependencies | react, react-dom, react-router, @tanstack/react-query, typescript, vite, @vitejs/plugin-react, tailwindcss and its Vite plugin, shadcn/ui with the Radix packages its CLI installs, class-variance-authority, clsx, tailwind-merge, lucide-react, sonner, react-hook-form, zod, @hookform/resolvers, @fontsource-variable/inter. Test tooling: vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, msw, @playwright/test, @axe-core/playwright. Also eslint with typescript-eslint, eslint-plugin-react-hooks, @eslint/js and globals (approved in feature 1), prettier, prettier-plugin-tailwindcss, tw-animate-css, shadcn, and `openapi-typescript` only if the backend docs ship an OpenAPI spec. Anything else: ask. | No stopping for every package, no silent growth                                                                                   |
| Server state          | TanStack Query. No global store for server data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Server data is most of the state                                                                                                  |
| Auth token            | An in-memory variable mirrored to `sessionStorage`. Never `localStorage`. Cleared on 401 and logout. Never in a URL or a log.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Survives a refresh in one tab; the 15-minute window makes long-lived storage pointless. XSS can read it, which is accepted for v1 |
| API access            | Dev: a Vite proxy so the browser calls same-origin. The proxy target comes from an env var read in `vite.config`, never exposed to the browser. Production hosting is undecided and out of scope. If the app and API end up on different origins, the backend must enable CORS and expose `X-Access-Token` (a `BACKEND_REQUESTS.md` item).                                                                                                                                                                                                                                                                                                 | No CORS work in development                                                                                                       |
| Language              | Indonesian UI. Use the organization's own words: "Bidang" for team, "Ketua Bidang" for team leader, "Relawan" for volunteer and plain member, plus "Pembina" and "Ketua ECHO". Role labels: ADMIN "Admin", PEMBINA "Pembina", MEMBER "Relawan". Code and identifiers stay English (`team`, `leader`). Register: neutral and polite, "Anda" only when unavoidable. All UI text lives in `src/lib/messages.ts`. Never show raw backend message text: map error codes and statuses to Indonesian messages, with a generic fallback.                                                                                                           | The backend's messages are English                                                                                                |
| Dates                 | Display in `Asia/Jakarta` with `Intl`, locale `id-ID`, 24-hour clock, with a "WIB" label. Date and time inputs are read as Asia/Jakarta and sent as ISO 8601 with the `+07:00` offset. One helper module.                                                                                                                                                                                                                                                                                                                                                                                                                                  | The API wants an explicit offset and returns UTC                                                                                  |
| Theme                 | Light only for v1. Tokens are CSS variables so dark mode is cheap to add later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Halves the visual QA surface                                                                                                      |
| Tests                 | Vitest, Testing Library, and MSW for components and logic (MSW handlers reuse real examples from the docs). Playwright runs against the real backend on echo_dev, including mutating flows. Fixtures are created through the API with the admin account (`E2E_ADMIN_*` env vars) and named `e2e-<random>`. Specs find elements by role and by text imported from `messages.ts`, never by hardcoded literals. Specs never depend on each other's data and tolerate leftovers.                                                                                                                                                               | Real flows, including the assign race                                                                                             |
| Dev data              | echo_dev is free to use for development and Playwright runs, through the API. The agent may also run the backend's own `migration:run` and `seed` scripts against echo_dev when the baseline is missing. It never runs SQL, drops, truncates, or wipes volumes, and never edits `apps/api`. It never changes seeded users or teams, only `e2e-` data, which keeps specs deterministic. The seeded admin starts with `must_change_password`: the agent works out the bootstrap, records it here, and asks me only if it needs a backend change.                                                                                             | Dev data is disposable; a reset is a backend task, not a frontend one                                                             |
| Contract              | One API client module and one types module. If an OpenAPI spec exists, types are generated from it and never hand-edited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | A backend change touches one place                                                                                                |
| Hosting               | A static build served with a fallback to `index.html`. Undecided and out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Informational                                                                                                                     |
| Scaffold              | Vite `react-ts` template, TypeScript 6 (strict) with the `@/` alias for `src/`. Dev server on port 5173, `/api` proxied to `API_PROXY_TARGET` (default `http://localhost:3000`, prefix stripped). Playwright runs chromium only, with a `webServer` that starts `npm run dev` and reuses a running one. Vitest covers `src/**/*.test.{ts,tsx}` only. ESLint (flat config) forbids `any`, bare `@ts-ignore` and `alert`/`confirm`/`prompt`. Prettier ignores PLAN.md and CLAUDE.md. | Feature 1 choices, recorded so later features follow them |
shadcn style | Radix, not the Base UI default. Read init --help for how to choose Radix non-interactively. If the CLI can't, hand-write the components on Radix primitives. | The CLI's default style changed to Base UI, which isn't approved.
## Out of scope (Later)

- Public site, Figma implementation
- Notifications, offline mode, PWA
- Service notes
- Languages other than Indonesian
- Dark mode
- Production hosting and deployment
- Visual polish beyond the quality bar

## Open questions (agent: ask me BEFORE implementing)

None at the moment.

## Feature order (one Claude Code session per item)

1. **Scaffold.** Vite (React + TypeScript template), Tailwind, React Router, TanStack Query,
   Prettier, Vitest/RTL/MSW, Playwright with `webServer` config, `.env.example`,
   `npm run check` (typecheck + lint + unit tests).
   - `npm run check` passes.
   - The dev server renders a placeholder page and `index.html` has `lang="id"`.
   - A trivial Playwright test runs.
2. **Design foundation.** shadcn/ui init, theme tokens, Inter, app shell, page header, toast,
   skeleton, empty state, error state, confirm dialog, and `src/lib/messages.ts`.
   - A `/design` route (removed in feature 10) shows every component and state.
   - Tokens are used everywhere. A grep for hex colors in `src/components` and `src/features` finds none.
   - Shell works at 390px, 768px, and 1280px (Playwright screenshots, reviewed).
   - axe finds no serious or critical violations on `/design`.
3. **API client and session core.** `src/api/client.ts`, the types module, the session store.
   - The token is replaced when `X-Access-Token` is present and kept when absent.
   - It is stored in `sessionStorage` (not `localStorage`), cleared on logout and on 401,
     and never appears in a URL or console output.
   - 401 clears the session and goes to login, except from `POST /auth/change-password`.
   - `PASSWORD_CHANGE_REQUIRED` redirects to the forced change route.
   - Errors are normalized for 400, 403, 404, 409, and network failure, and mapped to
     Indonesian messages by code and status. An unknown code shows the generic message,
     never the backend's text (unit test).
   - With the backend running, the dev proxy reaches the backend's `/health` and gets 200.
4. **Login, forced password change, navigation.** Role-based nav and route protection.
   - Wrong credentials show one generic message.
   - A user who must change the password can't reach any other route.
   - A wrong current password shows an inline error and does NOT log out.
   - Nav is correct for MEMBER, leader, PEMBINA, and ADMIN (a test per role).
   - Playwright: an admin-created `e2e-` user logs in, completes the forced change, and lands home.
5. **Schedules.** Full schedule and My schedule.
   - Full schedule lists each service with every team's people.
   - The `includePast` toggle works. Ended services are hidden by default.
   - Loading, error with retry, and empty states exist.
   - A known UTC instant renders in WIB with Indonesian day and month names (unit test).
   - Playwright: a created service and its assigned people appear. No horizontal scroll at 390px.
6. **Services management** (ADMIN, PEMBINA). Create, edit, delete with confirmation.
   - Form limits match the docs. End must be after start.
   - Date and time input converts to ISO with `+07:00` (unit test).
   - Server validation errors show as Indonesian messages next to the form. A 403 shows a clear message.
   - Playwright: create a service in WIB, see the right time, edit it, delete it.
7. **Leader assign screen.** Pick a service and one of the leader's teams; candidates, assign, unassign.
   - Candidates show who is already assigned.
   - Assign sends only the selected ids and a double click sends one request.
   - Partial success shows added and skipped users with the reason. When another team
     holds a person, the response's team name is shown.
   - Candidates are refetched after every assign response.
   - A service that already started disables the controls and says why.
   - A leader of two teams can switch teams. Unassign needs confirmation.
   - Playwright with two browser contexts (leaders of two different teams, fixtures made
     through the API) assigns the same volunteer at the same time: exactly one succeeds,
     the other sees the skipped result and a refreshed candidate list.
8. **Admin users.** List, create, edit (name, email, role, active), reset password.
   - Duplicate email shows inline. Reset needs confirmation.
   - An admin can't change their own role or active flag (UI disables it, a 400 is also handled).
   - Playwright: create a user, then that user logs in and changes the password.
9. **Admin teams and membership.** Teams list/create/rename; per team the members list, add,
   remove, set leader.
   - Removal warns that future assignments of that team are deleted.
   - Inactive members are marked, and adding an inactive user shows the error.
   - Playwright: add a member, set them leader, they see the assign screen.
10. **Hardening.** Remove `/design`. Audit every screen against the UI quality bar, for
    loading, error, and empty states, and for dead code. README (run, test, env).
    - Playwright visits every route at 390px, 768px, and 1280px with zero console errors.
    - axe finds no serious or critical violations on any route.
    - A grep finds no user-facing text literals outside `src/lib/messages.ts`.
    - Screenshots of every route are reviewed against the quality bar and the findings listed.

Every UI feature (2 to 9) must also pass, in Playwright at 360px, 390px, 768px, and 1280px: no horizontal page scroll on any route it adds, and no clipped or overlapping content.

## Status

- [x] 1. Scaffold
- [x] 2. Design foundation
- [ ] 3. API client and session core
- [ ] 4. Login, password change, navigation
- [ ] 5. Schedules
- [ ] 6. Services management
- [ ] 7. Leader assign screen
- [ ] 8. Admin users
- [ ] 9. Admin teams and membership
- [ ] 10. Hardening

## Notes for later features (orchestrator, feature 2)

- `shadcn add` would install `cn` and `next-themes` (not approved). Take component source with `npx shadcn@latest view <name>` and write the file, importing `cn` from `@/lib/utils`. `components.json` style is `radix-nova`.
- `/design` and its dev-only "Desain" nav link (D-003) are removed together in feature 10.
