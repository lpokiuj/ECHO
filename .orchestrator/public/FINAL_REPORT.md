# FINAL REPORT: public site build (branch `public-site-build`)

Final full-suite check (2026-11-10, HEAD 56a4766), every app, all green:
- apps/api: lint clean, unit 8/8, e2e 387/387
- apps/web: `npm run check` 335/335, e2e 102/102 (5.5 min, 44 logins, max 2 per account)
- apps/public: `npm run check` 127/127, e2e 93/93 (1.6 min; real public POSTs: the two `[real]` tests only)

## 1. Features done, with commits
| Feature | Commit |
|---|---|
| P1 Move portal to /volunteer-portal | a1835ee |
| T1 Delete endpoints (users, bidang; services keep soft delete) | 6b9cd09 (+ chore dfe1bbb for stale web e2e) |
| T2 Portal delete buttons + e2e cleanup | 75b13a9 |
| B1 Public submission endpoints | 48f5be7 |
| B2 Admin submission endpoints | be4722a |
| F1 Public site scaffold | 2a10db6 |
| F2 Home: Hero, Ibadah, Lokasi | de74dd3 |
| F3 Home: Acara, Tentang, Pertama Kali, Kontak, Persembahan | 194d5ad |
| F4 Prayer request form (/doa) | be0ffac |
| F5 Volunteer registration form (/relawan) | 0bfcb62 |
| P2 Portal submissions inbox | 7b7dc86 |
| F6 Public polish | 56a4766 |

## 2. Decisions (full text and reasons in DECISIONS.md; D-006 and D-004 were superseded)
- Preflight / P1: D-001 API docs are at `docs/api/` (tell Bs another path). D-002 no `server.open` (add `open` in vite config). D-003 `E2E_BASE_URL` stays an origin (put the full URL in the variable).
  D-005 P1 scope includes poc-up.sh and the root CLAUDE.md POC section (n/a). D-007 pagination failures do not excuse "e2e green" (n/a). D-008 P1 includes the helper, the aria-label fix and auth.spec:58 (plan-level).
  D-009 router basename keeps its trailing slash (restore `.replace(/\/$/, '')`). D-010 home URL assertions restored to strict. D-011 "Rekap bidang" aria-label fix (restore `detailAria`).
  D-012 attendance.spec recap checks moved to home (point lookups back at attendance). D-013 timing-only spec edits (remove the timeouts and wait).
- T1: D-014 services keep soft delete (a later feature converting it). D-015 cascade wins over attendance history (migration back to RESTRICT plus a 409 check). D-016 users who created records are blocked with 409
  (nullable + SET NULL migration). D-017 last ADMIN counts all rows, self-delete is 400 (change the query or status). D-018 schema and two replaced tests approved (migration restoring old FKs and the two tests).
  D-019 dev DB migrated via the script (`npm run migration:revert`). D-020 stale web e2e fixed as a separate chore (n/a).
- T2: D-021 delete buttons on the lists only, errors as toasts (add a detail button or inline alert). D-022 one shared e2e PEMBINA excluded from cleanup (backend `created_by ON DELETE SET NULL` then drop the exception);
  token cache file under `.screens/`; `db:reset` at the start of every feature.
- B1: D-023 camelCase request keys, resettable throttler storage in tests only, no extra DB CHECKs, honeypot validated first (rename DTO fields; later migration for checks).
- B2: D-024 camelCase keys, `handledBy` is `{id,name}`, any PATCH sets handledBy/handledAt, empty or repeated `?status=` is 400, counts in a small module (change the mapper or add a column).
- Public site: D-025 Logo = favicon mark plus wordmark, root files not edited in F1 (add root scripts later). D-026 section order follows the plan, Maps iframe without `sandbox` (re-add the attribute).
  D-027 final home order, "Kegiatan" renamed "Acara", contact values plain text (re-add sections, revert rename). D-028 no `PUBLIC_RATE_LIMIT` knob, few real POSTs per run (add an env-configurable limit in apps/api).
  D-029 429 copy fixed to the plan sentence (edit `site.errors`). D-030 F5 bidang picker as checkbox group, `PlaceholderBlock` left unused (delete it).
- P2: D-031 detail as its own route derived from the list (no GET-by-id), English slugs, `redirectTo` prop on `RequireRole`, one Simpan button, 1 real POST per endpoint per run (edit routes, switch to dialog or auto-save).
- F6: D-032 `site.meta` plus static index.html tags kept in sync by `meta.test.ts`, home title stays `ECHO`, SVG og placeholder, no root `dev:public` script, 6 saved screenshots (edit `site.meta`/index.html, delete og-image.svg).

## 3. Deviations from PUBLIC_PLAN.md
- Services keep their soft delete (plan said hard delete for services; the user chose this, D-014), and T2 uses the existing endpoint.
- Deleting users who created records returns 409; blocked users cannot be deleted (D-016). Because of it, one shared PEMBINA account is exempt from the `e2e-` cleanup (D-022), a second permanent exception besides the E2E admin.
- T2 criterion "suite passes with the default `LOGIN_RATE_LIMIT` of 5" was not runnable (dev backend uses 1000 and restarting it is forbidden). Evidence instead: per-account maximum 2 logins, admin 1 per run.
- Two existing tests were replaced with the user's approval (schema membership RESTRICT test, teams "no delete-team route"), and `routes.spec:225` (a test of a page nothing can reach after the forced password change was removed) was deleted at the user's choice.
- API request and response keys are camelCase; the plan's `admin_note` and similar were indicative. `handledBy` is `{id,name}`.
- Docs live at `docs/api/`, not `apps/api/docs/api/`.
- P2 detail routes (`/prayer-requests/:id` and so on) were added because the contract has no GET-by-id.
- Root files outside the plan scope were not touched: root package.json scripts, root CLAUDE.md.

## 4. B sessions and fix rounds
14 Sonnet B agents in total.
| Feature | B agents | Fix rounds |
|---|---|---|
| P1 | 1 | 1 |
| T1 | 2 (one was the web e2e chore) | 0 |
| T2 | 1 | 0 |
| B1 | 1 | 0 |
| B2 | 1 | 0 |
| F1 | 1 | 0 |
| F2 | 1 | 0 |
| F3 | 1 | 0 |
| F4 | 2 | 0 |
| F5 | 1 | 0 |
| P2 | 1 | 0 |
| F6 | 1 | 0 |
Hard stops along the way (all resolved, see RUN_LOG History of stops): missing E2E variables, login 429 from per-test logins, credential state, backend down (twice), stale `.env.test`, the T1 soft-delete and RESTRICT questions,
and `db:reset` denied twice by the auto-mode classifier (resolved by the user's permission).

## 5. Things you must do manually
- Check every public page and the portal inbox on a real phone.
- Replace the placeholders in `apps/public/src/content/` (all "akan diisi" text, contact values, `site.meta` description, bank/QRIS block); the static events are placeholders dated 2030.
- The logo is the favicon "E" mark plus an "ECHO" wordmark copied from apps/web; replace if a real logo exists. Replace `apps/public/public/og-image.svg` with a 1200x630 PNG and an absolute URL for real link previews.
- Check the Google Maps embed with the real address (never loaded in tests).
- Production: reverse proxy routes (`/`, `/volunteer-portal/`, `/api/`) and making the backend trust the proxy so the rate limit sees real client IPs. Not done in this run. Until then, behind the POC tunnel all visitors share one bucket of
  5 public POSTs per endpoint per 10 minutes.
- Optional root changes I may not make: a `dev:public` script and public in root `build/lint/test/check`; the root CLAUDE.md still names only apps/api and apps/web.
- This `FINAL_REPORT.md` is not committed (you did not ask for a commit). Commit it if you want it in history; everything else is committed.

## 6. Known gaps and risks
- (Fixed by E3) the static 2030 events time bomb is gone; events now come from the API.
- `PlaceholderBlock.tsx` and `site.states.placeholder` in apps/public are unused; `ListCard.inlineAction` in apps/web is unused in production code.
- The public POST rate limit is in memory, per process, and 5 per 10 minutes per IP per endpoint: real-backend e2e runs must stay small (about two full runs in 10 minutes per app), and multiple instances would not share it.
- No GET-by-id for submissions, so the inbox detail loads the whole list (fine at low volume; request noted as optional).
- B2: if the acting user is deleted mid-PATCH, the UPDATE hits a FK error (500). Extremely unlikely, left as is.
- `ErrorPage` (route errorElement) in apps/public has no e2e or axe test. The og image is an SVG with a relative path, which scrapers ignore.
- `prayer.spec.ts`, `sections.spec.ts` and `volunteer.spec.ts` in apps/public fail `prettier --check`; `check` does not run prettier.
- Web unit tests (5 s timeouts) and one API e2e test can flake when the machine is loaded; rerun alone with `--maxWorkers=2`.
- `npm ls` shows cosmetic ELSPROBLEMS for vitest 4 (api) against vitest 5 (web, root).
- Nameless prayer requests cannot be matched by the `e2e-` cleanup; tests always send a name, but any nameless leftover stays in echo_dev.
- The T2 and later e2e rely on the E2E admin and the shared e2e PEMBINA existing in echo_dev (created by `db:reset` and the seed).

## Addendum: events backend (user request 2026-11-10, D-033 to D-036, spec EVENTS_ADDENDUM.md)
Three extra features, all verified by me, NOT committed (the user did not ask for a commit; E3 also left `content/events.ts` as a staged deletion):
- E1 Events API: `events` table (migration AddEvents, applied to echo_dev), `GET /public/events` (upcoming, ascending, 5 fields), `/admin/events` list (newest first), POST, PATCH, DELETE (hard), ADMIN and PEMBINA. API e2e 446/446 (was 387).
- E2 Portal "Acara" page `/events` (create, edit, delete with confirmation, WIB times). Web unit 360, e2e 109 (was 335 and 102).
- E3 Public Acara section reads `GET /public/events`; static data deleted. Public unit 132, e2e 97 (was 127 and 93).
- Gaps: no dedicated test that the global setups remove an `e2e-` event (exercised across runs); `ListCard.inlineAction` still unused; the docs JSON examples in `docs/api/events.md` are not captured from a live server; the running backend must be restarted by the user to load the new routes only if it was started before E1 (it already answered `/public/events`).
