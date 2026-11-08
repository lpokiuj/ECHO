# Echo: Public Site + Portal Move — PLAN

Scope: move the volunteer portal to `/volunteer-portal`, add public form submissions to the
backend, build a new public site (`apps/public`), and add a submissions inbox to the portal.
One orchestrated run over the whole repo. Features run in the order of the Status list.

## Fixed decisions (do not revisit)

| Topic | Decision |
|---|---|
| Public site stack | Same as the portal: Vite + React + TypeScript + React Router + TanStack Query + shadcn/ui + lucide-react. Separate app `apps/public`. SPA is fine; SEO does not matter. |
| Portal | `apps/web` moves to base path `/volunteer-portal/`. The learning version of the portal does not exist yet and is out of scope. |
| Public login | None. The public site has no auth at all. |
| Spam protection | Easiest version only: honeypot field + rate limit (`@nestjs/throttler`). No Turnstile, no captcha, no API keys. |
| Who reads submissions | ADMIN and PEMBINA only. MEMBER and Ketua Bidang (`is_leader`) cannot. |
| Retention | No auto-delete. ADMIN/PEMBINA manage status and can delete a submission manually. Delete is a HARD delete (the row is gone, no soft-delete flag), because prayer requests are sensitive and "deleted" must mean deleted. The UI always confirms before deleting. |
| Inbox alerts | A NEW-count badge on the two inbox nav entries. No email or WhatsApp notifications. |
| E2E test data | E2E tests keep using echo_dev. Everything a test creates is named with the prefix `e2e-` (user emails `e2e-<random>@test.local`, names, bidang names, service titles, submission names). At the START of every e2e run, a Playwright global setup logs in as the E2E admin and deletes all `e2e-` data through the API. Nothing without the prefix is ever deleted, and the E2E admin account itself is never deleted. Cleanup failure fails the run loudly. |
| Deleting users, bidang, services | Hard delete through the API and the portal. Users and bidang: ADMIN only. Services: whoever can already edit services (ADMIN, PEMBINA). Deleting cascades to the record's memberships and assignments; submission `handled_by` becomes NULL. A user cannot delete themselves, and the last ADMIN cannot be deleted. Every delete in the portal asks for confirmation. |
| Events | Static content in v1, but read only through one data function (`getEvents()`) via TanStack Query, so it can later be switched to a portal-managed API without touching components. |
| Volunteer registration | Lands in the portal inbox. Admin contacts the person on WhatsApp, then creates the account with the existing user-creation flow. No automatic account creation. |
| Logo | Echo logo lives in one `<Logo />` component. If `apps/web` already has a logo asset, copy it. Otherwise a text wordmark "ECHO" as a placeholder. |
| Basic icons | lucide-react, same as the portal (menu/burger, chevrons, map pin, clock, etc.). |
| Design | No Figma. Claude designs it, within the direction below. |
| UI language | Indonesian, same terms as the portal ("Bidang", "Relawan", "Ibadah"). |
| Content | All placeholder text, in content files. Placeholders are obviously placeholder (e.g. "Alamat akan diisi"). No invented real facts (addresses, phone numbers, bank accounts). |
| Images | No images downloaded from the internet, no stock photos. Use gradients, shapes, or simple placeholder blocks. |

## Routing

```
/                    → apps/public (home, one long scrolling page with sections)
/doa                 → apps/public (prayer request form)
/relawan             → apps/public (volunteer registration form)
/volunteer-portal/*  → apps/web (existing portal)
/api/*               → apps/api (NestJS)
```

Dev: portal on its own Vite port with `base: '/volunteer-portal/'`, public on another port.
Both proxy `/api` to the backend in Vite config. The public site's link to the portal comes
from `VITE_PORTAL_URL` (default `/volunteer-portal/`; set to the portal's dev URL in
`.env.development`). Production reverse-proxy config is out of scope for this run.

## Backend data model (new)

`prayer_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | varchar(100) null | optional |
| contact | varchar(100) null | WhatsApp or email, optional |
| wants_follow_up | boolean | if true, `contact` is required (validated) |
| content | text | required, 1–2000 chars |
| consent_at | timestamptz | set by server when consent = true |
| status | enum NEW, IN_PROGRESS, DONE | default NEW |
| admin_note | varchar(1000) null | internal note, never shown publicly |
| handled_by | uuid FK users null | last user to change status or note |
| handled_at | timestamptz null | |
| created_at | timestamptz | |

`volunteer_applications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| full_name | varchar(100) | required |
| whatsapp | varchar(30) | required |
| email | varchar(255) null | optional, validated if present |
| availability | varchar(500) null | free text |
| message | varchar(1000) null | free text |
| consent_at | timestamptz | |
| status | enum NEW, CONTACTED, ACCEPTED, DECLINED | default NEW |
| admin_note | varchar(1000) null | |
| handled_by | uuid FK users null | |
| handled_at | timestamptz null | |
| created_at | timestamptz | |

`volunteer_application_bidang` (join): application_id FK (ON DELETE CASCADE), bidang_id FK, PK on both.
Bidang interest is optional (0..n). Unknown bidang ids are rejected with 400.

Use the backend's existing migration approach and naming conventions. If the column or
table names above clash with existing conventions, follow the existing conventions.

## API (indicative; match existing route, DTO, and error conventions in apps/api)

Public, no auth:
- `GET  /public/bidang` → `[{ id, name }]` only. No member data.
- `POST /public/prayer-requests` → 201 `{ ok: true }`
- `POST /public/volunteer-applications` → 201 `{ ok: true }`

Both POSTs:
- Require `consent: true` (400 otherwise). Server sets `consent_at`.
- Honeypot field `website`: if non-empty, return the same 201 `{ ok: true }` and store nothing.
- Rate limit: 5 requests per 10 minutes per IP, per endpoint. Exceeding returns 429.
- Responses never echo back stored data.

Admin (ADMIN and PEMBINA; everyone else 403; unauthenticated 401):
- `GET    /admin/prayer-requests?status=` → newest first
- `PATCH  /admin/prayer-requests/:id` `{ status?, admin_note? }` → sets handled_by, handled_at
- `DELETE /admin/prayer-requests/:id` → 204, hard delete
- `GET    /admin/volunteer-applications?status=` → newest first, includes bidang names
- `PATCH  /admin/volunteer-applications/:id` `{ status?, admin_note? }` → sets handled_by, handled_at
- `DELETE /admin/volunteer-applications/:id` → 204, hard delete (join rows removed too)
- `GET    /admin/submissions/counts` → `{ prayerRequestsNew, volunteerApplicationsNew }`
  (count of status NEW only)

PATCH with an empty body is 400. No pagination (low volume). No bulk delete.

## Public site

### Conventions (F1 writes these into apps/public/CLAUDE.md)
- Mirror apps/web conventions: folder layout, lint/format config, test setup, scripts
  (`npm run check` = lint + typecheck + unit tests; Playwright for e2e), form library.
  If apps/web has no form library, use react-hook-form + zod through the shadcn Form component.
- All user-facing text lives in `src/content/` (site.ts, events.ts). Components never
  hard-code copy.
- Events are read only through `src/lib/events.ts` `getEvents()` (async, returns the static
  list now) via a TanStack Query hook.
- API calls only through one small client module. No auth code, no tokens, no session storage.
- Never import code from apps/web. Copy what is needed (e.g. theme tokens, Logo asset).

### Design direction
- Mobile-first. Must look right at 360px first, then up to 1280px.
- Reuse the portal's shadcn theme tokens (colors, radius, font) so the brand matches.
- Youth church feel: clean, modern, generous spacing, large bold headings, one accent color
  from the theme, rounded cards, subtle section background alternation. No clutter, no
  carousels, no heavy animation (respect `prefers-reduced-motion`).
- Sticky header: Logo, section links, "Daftar Relawan" button. Mobile: burger menu (sheet).
- Footer: logo, socials placeholders, contact placeholder, link "Portal Relawan".

### Home sections (in order)
1. Hero: name, tagline, next service time, buttons "Datang Beribadah" (scroll to Ibadah)
   and "Kirim Pokok Doa" (/doa).
2. Ibadah: days, times, what to expect.
3. Lokasi: address, Google Maps embed (iframe with placeholder query), transport/parking notes.
4. Acara: upcoming events from `getEvents()`, sorted by date; past events hidden;
   empty state when none.
5. Tentang Kami: vision, short story, bidang overview (static text, not the API).
6. Pertama Kali?: FAQ accordion for newcomers.
7. Kontak: WhatsApp, Instagram, email placeholders.
8. Persembahan: giving info placeholder (bank/QRIS placeholder block, no real numbers).

### Forms
- `/doa`: name (optional), wants follow-up (checkbox), contact (required only if follow-up),
  request (textarea, counter, max 2000), consent checkbox with short privacy note
  ("Pokok doa hanya dibaca oleh gembala/pembina"), hidden honeypot `website`.
- `/relawan`: full name, WhatsApp, email (optional), bidang interest (multi-select from
  `GET /public/bidang`; if that call fails, the form still works without bidang),
  availability, message, consent checkbox with privacy note, hidden honeypot.
- Both: client validation mirroring the backend, disabled submit while sending, success
  screen (not a toast only), clear error message on 429 ("Terlalu banyak percobaan, coba
  lagi nanti") and on network/server error, form data kept on error.
- Honeypot: visually hidden, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`.

## Global acceptance criteria (apply to every feature)
- `npm run check` passes in every app the feature touched. Backend tests pass in apps/api.
- Existing tests in all apps still pass. No test deleted, skipped, or weakened.
- No `any`, `@ts-ignore`, `.only`, `.skip` added.
- Every new frontend screen: loading, error, and empty states; usable at 360px and 1280px;
  no axe violations of serious or critical level.
- Backend: every new endpoint has tests for success, validation failure, and authorization
  (where applicable). API docs (`apps/api/docs/api/README.md`) updated in the same feature.
- Docs stay true: any README, CLAUDE.md, or `.env.example` that describes something the
  feature changed (URLs, paths, ports, env vars, scripts, roles, pages) is updated in the
  same feature. A doc that is now wrong is a failed verification.
- E2E data: from T2 onward, every e2e test names what it creates with the `e2e-` prefix and
  relies on the global setup cleanup. No test depends on data left by another run.
- Only approved dependencies (below).

## Features

### P1 — Move portal to /volunteer-portal
Scope: apps/web, plus `scripts/poc-up.sh` and the "Laptop POC hosting" section of the root
CLAUDE.md (only the parts the new base path breaks; no other change to either).
- Vite `base: '/volunteer-portal/'`, router basename, all internal links and redirects
  (login, logout, 401 redirect) work under the new base.
- Dev server opens at `/volunteer-portal/`. Playwright `baseURL` updated.
- Acceptance: full existing e2e suite green under the new base; a hard refresh on a deep
  link (e.g. `/volunteer-portal/<some page>`) works in the dev server; no request goes to
  the old `/volunteer` path; `apps/web` README and CLAUDE.md state the new base path and
  dev URL, and no doc in apps/web still mentions the old `/volunteer` path;
  `scripts/poc-up.sh` waits on and prints the portal at its new `/volunteer-portal/` URL,
  and the root CLAUDE.md POC section matches the script.

### T1 — Delete endpoints for users, bidang, services
Scope: apps/api only.
- First inventory what exists: for users, bidang, services, bidang membership and
  assignments, list which delete/remove endpoints already exist and how they behave.
  Record the inventory in the feature log.
- Add only what is missing, following the "Deleting users, bidang, services" decision.
  Existing endpoints that already hard delete with matching permissions are kept as they are.
- If an existing endpoint is a soft delete or deactivation (the row stays), or its
  permissions differ from the decision, do NOT change it: hard stop and report, because
  changing existing behavior is my call.
- Acceptance: tests prove for each delete endpoint: allowed roles get 204 and the row is
  gone; other roles 403; no token 401; unknown id 404; cascades remove memberships and
  assignments; submissions keep existing with `handled_by` NULL (once B1 exists this is
  re-checked in B2; here test it only if the tables exist); deleting yourself is 400 or
  403 per existing error conventions; deleting the last ADMIN is rejected. Docs updated.

### T2 — Portal delete buttons + e2e cleanup
Scope: apps/web only.
- Delete buttons for users, bidang, and services in the portal, shown only to roles allowed
  to delete. Each opens a confirmation dialog that says the deletion is permanent and what
  it also removes ("Semua jadwal dan keanggotaan orang ini juga akan dihapus." or the
  equivalent for bidang/services). After delete, return to the list and refresh it.
- Playwright global setup that deletes all `e2e-` users, bidang, and services through the
  API before the run, in an order that respects dependencies. It must:
  - match the prefix on the field the tests set (email for users, name/title otherwise)
  - never delete the account whose email equals E2E_ADMIN_EMAIL
  - print only counts deleted per type, never names, emails, or credentials
  - fail the whole run if any delete call fails
- Update every existing e2e test so the data it creates uses the `e2e-` prefix. Only names
  and emails change; assertions about behavior do not.
- Log in once per run, not once per test: the global setup logs in as the E2E admin (and
  any other fixed role it needs) and saves the session for reuse (Playwright
  `storageState` for UI tests, a cached token for API helpers). Tests that create their
  own users still log in as those users, once each. Tests whose purpose is the login flow
  itself keep logging in through the UI, but as their own `e2e-` user, not the E2E admin.
- Acceptance: e2e as ADMIN deletes a user, a bidang, and a service through the dialog and
  they are gone after reload; cancelling deletes nothing; a role without permission sees
  no delete button. Running the full e2e suite twice in a row leaves zero `e2e-` records
  from the first run before the second run's tests start (the setup logs counts > 0 on
  the second run, then the second run passes). The second full run is not slower than
  the first in any meaningful way; record both durations in the feature log. The full
  suite passes with the backend's default `LOGIN_RATE_LIMIT` of 5 (the E2E admin logs in
  at most once per run, plus at most once per test-created user); record the total
  number of login calls per run in the feature log.
  `apps/web` README documents the `e2e-` prefix rule and the cleanup.

### B1 — Public submission endpoints
Scope: apps/api only.
- Entities, migration, module(s) for prayer requests and volunteer applications; public
  bidang list; honeypot; throttler on the two POSTs only (not global).
- Acceptance: tests prove 201 + stored row on valid input; 400 on missing consent, missing
  contact when follow-up is requested, too-long content, unknown bidang id; honeypot returns
  201 and stores nothing; 6th request within the window returns 429; `GET /public/bidang`
  exposes only id and name. Existing auth-protected endpoints unaffected. Docs updated.

### B2 — Admin submission endpoints
Scope: apps/api only.
- List, status/note update, hard delete, and NEW counts for both submission types,
  ADMIN and PEMBINA only.
- Acceptance: tests prove, for every admin endpoint: ADMIN and PEMBINA succeed; MEMBER and
  a Ketua Bidang get 403; no token gets 401. Also: status filter works; PATCH sets
  handled_by/handled_at; PATCH updates admin_note on both types; invalid status 400; empty
  PATCH body 400; unknown id 404 on PATCH and DELETE; DELETE returns 204 and the row is
  gone (a following GET no longer lists it); deleting a volunteer application also removes
  its bidang join rows; counts change correctly after create, status change, and delete;
  deleting a user who handled a submission keeps the submission with `handled_by` NULL.
  Docs updated.

### F1 — Public site scaffold
Scope: apps/public (new), plus root-level config only if the repo has workspace config
that must list the new app.
- Vite app, theme tokens copied from apps/web, shadcn init, lucide, Logo component,
  header (desktop nav + mobile burger sheet), footer, layout, router with `/`, `/doa`,
  `/relawan`, 404 route, content files with placeholders, `getEvents()`, API client,
  Vite `/api` proxy, `VITE_PORTAL_URL`, Vitest + Playwright set up, `apps/public/CLAUDE.md`,
  `apps/public/README.md`, `apps/public/.env.example`.
- Acceptance: `npm run check` passes; Playwright smoke test loads `/` and navigates via the
  mobile burger menu at 360px; footer link points to `VITE_PORTAL_URL`;
  `apps/public/README.md` covers install, dev command and port, env vars, test commands,
  and where to edit content (`src/content/`) and the logo; `.env.example` lists every
  `VITE_*` variable the app reads, with placeholder values only. Playwright global setup in
  apps/public deletes `e2e-` prayer requests and volunteer applications through the admin
  API before each run, with the same rules as T2 (prefix only, counts only, fail loudly),
  and logs in once per run like T2.

### F2 — Home: Hero, Ibadah, Lokasi
Scope: apps/public.
- Acceptance: sections render from content files; header links scroll to sections;
  hero buttons work; map iframe has a title attribute; e2e covers the hero buttons.

### F3 — Home: Acara, Tentang Kami, Pertama Kali, Kontak, Persembahan
Scope: apps/public.
- Acceptance: events sorted, past events hidden, empty state shown when the list is empty
  (unit-tested on `getEvents` consumer logic); FAQ accordion keyboard-accessible; no real
  bank or phone numbers anywhere.

### F4 — Prayer request form (/doa)
Scope: apps/public. Requires B1.
- Acceptance: e2e against the real backend: valid submit shows success screen; follow-up
  without contact blocked client-side; 429 shows the rate-limit message (may be tested
  with a mocked route); honeypot is not reachable by Tab.

### F5 — Volunteer registration form (/relawan)
Scope: apps/public. Requires B1.
- Acceptance: e2e against the real backend: bidang options load from the API; valid
  submit shows success screen; form still submits if the bidang call fails (mocked);
  invalid email blocked client-side.

### P2 — Portal submissions inbox
Scope: apps/web. Requires B2, P1.
- Two pages: "Pokok Doa" and "Pendaftaran Relawan", visible in navigation only to ADMIN
  and PEMBINA. List with status filter, detail view, status change, and an admin note on
  both types. Route guard: other roles are redirected and see no nav entry.
- NEW-count badge on both nav entries, from `GET /admin/submissions/counts`. Hidden when
  the count is 0. Refreshes after any status change or delete (query invalidation), and on
  window focus.
- Delete button on the detail view. Always opens a confirmation dialog that says the
  deletion is permanent ("Hapus permanen? Data tidak bisa dikembalikan."). After delete,
  return to the list and refresh it and the badge.
- Acceptance: e2e as ADMIN: see a submission created through the public API, change its
  status and note, see both persist after reload; the badge count drops after the status
  changes from NEW; delete a submission through the dialog and it is gone after reload;
  cancelling the dialog deletes nothing. e2e as PEMBINA: can open both pages. e2e as
  MEMBER: nav entries absent and direct URL blocked. Test users are created through the
  API, never SQL. The T2 global setup also deletes `e2e-` prayer requests (by `name`) and
  volunteer applications (by `full_name`), and the submissions these tests create use the
  prefix. `apps/web` README (or its docs) lists the two inbox pages, their routes,
  which roles can see them, and that delete is permanent.

### F6 — Public polish
Scope: apps/public, plus the root README.md.
- 404 page, `<title>` and basic meta/Open Graph tags in index.html (placeholder image
  allowed), focus states, skip-to-content link, `prefers-reduced-motion`, final responsive
  check of every page at 360, 768, 1280.
- Acceptance: axe clean (serious/critical) on all routes; B checks every route at the three
  widths with Playwright screenshots and reports any layout problem; the orchestrator
  reviews up to 6 of them. Root README.md has a "Running locally" section: start order
  (database, backend, portal, public site), the command and dev URL of each, which env
  files each needs (pointing to the `.env.example` files, never values), and the
  production route map from the Routing section marked as not yet configured.

## Status
- [ ] P1 Move portal to /volunteer-portal
- [ ] T1 Delete endpoints for users, bidang, services
- [ ] T2 Portal delete buttons + e2e cleanup
- [ ] B1 Public submission endpoints
- [ ] B2 Admin submission endpoints
- [ ] F1 Public site scaffold
- [ ] F2 Home: Hero, Ibadah, Lokasi
- [ ] F3 Home: Acara, Tentang Kami, Pertama Kali, Kontak, Persembahan
- [ ] F4 Prayer request form
- [ ] F5 Volunteer registration form
- [ ] P2 Portal submissions inbox
- [ ] F6 Public polish

## Approved dependencies
- apps/api: `@nestjs/throttler`. Anything already in apps/api.
- apps/public: whatever apps/web already uses (same versions where possible), plus
  `react-router-dom` if apps/web uses a different router package name, `react-hook-form`,
  `zod`, `@hookform/resolvers` if not already used, shadcn-generated component deps
  (Radix packages, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`).
- apps/web: nothing new.
Anything else requires a logged decision with a reason, and only if no approved option works.

## Out of scope
Production reverse proxy / hosting config, Turnstile/captcha, email notifications,
events API, bulk delete, soft delete, notifications beyond the badge, pagination, real content, image uploads, SEO work,
the learning version of the portal.