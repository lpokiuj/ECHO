# EVENTS ADDENDUM (user request 2026-11-10): portal-managed Acara

The user asked for a real backend for the Acara (events) section. PUBLIC_PLAN.md listed "events API" as out of
scope and said events are static in v1 behind `getEvents()`. This addendum lifts that, by the user's request
(D-033). Everything else in PUBLIC_PLAN.md (fixed decisions, global acceptance criteria, approved dependencies,
e2e `e2e-` prefix rule) still applies. Features run in this order: E1, E2, E3.

## Data and rules
- Table `events`: id (uuid, same id style as other tables), title (required, max 120), starts_at (timestamptz,
  required), location (required, max 200), description (required, max 2000), created_by (nullable FK to users,
  ON DELETE SET NULL), created_at, updated_at. Migration via the repo's migration workflow.
- Who manages: ADMIN and PEMBINA (same as services). MEMBER and Ketua Bidang cannot (403). No token is 401.
- Delete is a HARD delete (the row is gone), always confirmed in the portal.
- Request/response keys are camelCase (`startsAt` ISO 8601 string, as in D-023/D-024).
- Public read: `GET /public/events` (no auth, no throttle needed beyond defaults) returns only upcoming events
  (`startsAt >= now`), sorted by `startsAt` ascending, fields `id,title,startsAt,location,description` only.
- Admin: `GET /admin/events` (all, newest start first or ascending: B decides and documents), `POST /admin/events`,
  `PATCH /admin/events/:id` (partial; empty body 400), `DELETE /admin/events/:id` (204). Match existing route,
  DTO and error conventions and where the existing admin submission endpoints live.
- E2E data: event titles created by tests start with `e2e-`; the T2 global setup in apps/web also deletes
  `e2e-` events (prefix on `title`) through the API. Nothing without the prefix is deleted.
- No seed change except optional: the seed may add NO events (the site shows its empty state). Do not invent
  real facts.

## E1 — Events API
Scope: apps/api only (plus docs/api/). Acceptance: tests prove, for every admin endpoint: ADMIN and PEMBINA succeed;
MEMBER and a Ketua Bidang get 403; no token 401. Also: create 201 with stored row; 400 on missing/too-long fields and
invalid date; PATCH updates fields and `updatedAt`; empty PATCH 400; unknown id 404 on PATCH and DELETE (invalid uuid
handled like the other modules); DELETE 204 and the row is gone; `GET /public/events` needs no token, hides past
events, sorts ascending, exposes only the five fields; deleting the creating user keeps the event (`created_by` NULL).
Docs `docs/api/` updated in the same change. Existing endpoints unaffected.

## E2 — Portal events management
Scope: apps/web only. Requires E1. Acceptance: nav entry "Acara" visible only to ADMIN and PEMBINA; route guard
like the submissions pages (`RequireRole` with `redirectTo`); list (loading, empty, error states), create and edit
form (title, date and time, location, description; validation messages; Indonesian copy in `messages.ts`), delete with
confirmation dialog (permanent wording as P2). e2e as ADMIN: create an event, see it in the list, edit it, both persist
after reload, delete via dialog (cancel deletes nothing); PEMBINA can open the page; MEMBER has no nav entry and a
direct URL redirects. Test users via the API. Test events use `e2e-` titles; the global setup deletes `e2e-` events.
Mocked unit tests for the list/form/dialog states, axe, 44px targets, no horizontal scroll at 360 and 1280.
README, PLAN.md, CLAUDE.md of apps/web updated. Max 6 saved screenshots.

## E3 — Public site reads events from the API
Scope: apps/public only. Requires E1 (and E2 so e2e can create events through the API as ADMIN). Acceptance:
`getEvents()` calls `GET /public/events` through the existing API client; components unchanged where possible; static
`content/events.ts` data removed (the type stays); loading, error and empty states of the Acara section still work and
are unit-tested with mocked responses; the 2030 time bomb is gone (tests no longer depend on static 2030 dates).
e2e: an event created through the admin API with an `e2e-` title (future date) appears in Acara on the home page;
deleted afterwards (or by the global cleanup); empty state when none. Public e2e must not exceed the real-POST
budget (events are GET, so no throttle concern). apps/public README/CLAUDE.md updated. The public e2e needs an
ADMIN login to create events: limit to 1 login per run and use the existing token approach from apps/public e2e
global setup if present.
