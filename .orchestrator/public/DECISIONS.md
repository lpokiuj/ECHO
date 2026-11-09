# DECISIONS

## D-001 (preflight): API docs path
- Question: PUBLIC_PLAN.md says the API contract and docs live at `apps/api/docs/api/README.md`.
  That path does not exist.
- Options: (a) hard stop; (b) use `docs/api/README.md`, which exists and which root CLAUDE.md
  names as the contract; (c) create the new path.
- Choice: (b). Every "API docs" reference in the plan (global criteria, B1, B2) means
  `docs/api/` at the repo root.
- Reason: consistent with existing code and docs; no plan text is changed.
- Reverse: tell the Bs a different path.

## D-002 (P1): no `server.open`
- Question: "Dev server opens at /volunteer-portal/": set `server.open`?
- Options: (a) no `server.open`, docs and Vite's printed URL say `/volunteer-portal/`; (b) `server.open`.
- Choice: (a). Reason: Playwright's webServer and WSL would try to launch a browser; simpler.
- Reverse: add `open: '/volunteer-portal/'` to `server` in apps/web/vite.config.ts.

## D-003 (P1): `E2E_BASE_URL` stays an origin
- Options: (a) keep origin, append `/volunteer-portal/` in playwright.config.ts; (b) full URL.
- Choice: (a). Reason: fewer edits, `/api` helpers in fixtures keep working.
- Reverse: put the full URL in E2E_BASE_URL and update the `${baseUrl}/api` users.

## D-004 (P1): out-of-scope files affected by the new base
- Findings: root README.md line 41 (dev URL) and scripts/poc-up.sh (wait loop curls
  `http://127.0.0.1:5173/`, which no longer serves the app; tunnel users must open
  `<tunnel>/volunteer-portal/`) and the root CLAUDE.md "Laptop POC hosting" section.
- Choice: not changed in P1 (scope is apps/web only; I may not edit CLAUDE.md). Root README
  "Running locally" is rewritten in F6. poc-up.sh and root CLAUDE.md are a KNOWN GAP, listed in
  the final report for the user to fix.
- Reverse: n/a, user action.
- SUPERSEDED by D-005.

## D-005 (P1, resume): P1 scope now includes poc-up.sh and root CLAUDE.md POC section
- Question: D-004 left those two files as a known gap because the plan scoped P1 to apps/web.
  The plan (commit 94c414f) now lists them in P1's Scope and acceptance.
- Choice: follow the updated plan. A fresh B edits only the parts of `scripts/poc-up.sh` and the
  "Laptop POC hosting" section that the new base path breaks. D-004 no longer applies.
- Reason: the plan text is authoritative; no judgment needed.
- Reverse: n/a.

## D-007 (P1, plan review): pagination failures do not excuse "e2e green"
- Question: B's plan proposed declaring P1 done if only pagination-drift e2e failures remain (listed as T2 items).
- Options: (a) accept; (b) require a green suite using small local spec fixes, no shared helper; (c) build the T2 helper in P1.
- Choice: (b). P1 acceptance says the full existing suite is green; I may not reword it, and the shared helper
  belongs to T2 (D-006). If small local fixes are not enough, that is a hard stop, not a waiver.
- Also: routes.spec startDate selector change kept only if the original selector fails; root CLAUDE.md long line rewrapped.
- Reverse: n/a.

## D-006 (P1, resume): pagination-aware specs stay out of P1
- Question: B2-P1 recommended making services/schedule/users/routes/teams specs pagination-aware in P1.
- Choice: no. The user's commit 3b2e6c2 and the plan's P1 note both place the shared helper in T2.
  P1 keeps only the small selector fixes needed to pass.
- Reverse: n/a, plan-level.
- SUPERSEDED by D-008.

## D-008 (P1, eleventh session): P1 now includes the helper, the aria-label fix and auth.spec:58
- Question: D-006/D-007 kept the pagination helper in T2. The current orchestrator prompt says P1 is
  "base path plus a green portal suite: the pagination-aware helper across specs, the 'Rekap bidang'
  aria-label fix, and the auth.spec:58 cause", and that changing how a spec FINDS a record is allowed.
- Choice: follow the prompt. P1 includes all three. The helper is built in P1; T2 later reuses it and
  only adds the prefix, cleanup and single-login work. The aria-label fix is in apps/web src (in P1's
  apps/web scope). Assertions about behavior must not change; I verify by reading the spec diffs.
- Reason: the prompt is the later, explicit instruction and P1's acceptance needs a green suite.
- Reverse: n/a, plan-level.

## D-009 (P1, plan review): router basename keeps the trailing slash
- Question: auth.spec:58 root cause (per B's code reading, to be confirmed by running): basename
  `/volunteer-portal` (slash stripped) makes home `/volunteer-portal`, which Vite answers with a 404 hint
  page on hard refresh. Fix by `basename: import.meta.env.BASE_URL` so home is `/volunteer-portal/`?
- Options: (a) keep slash-less home and accept the broken refresh; (b) basename with trailing slash;
  (c) Vite dev middleware (does not cover preview/tunnel).
- Choice: (b). Reason: P1 requires hard refresh to work; it is the router-basename part of P1 and the plan
  clearly implies it. B must confirm in the browser; if it does not work, fall back to an explicit redirect.
- Reverse: restore `.replace(/\/$/, '')` in apps/web/src/routes/router.tsx.

## D-010 (P1, plan review): home-URL assertions go back to the original
- The loosened `/\/volunteer-portal\/?$/` regexes hid the bug. Revert to the original `/\/$/` or the
  stricter `/\/volunteer-portal\/$/`. This restores or tightens, never weakens.

## D-011 (P1, plan review): aria-label fix and its unit-test lookup
- "Rekap bidang" detail button: visible text is "Detail" + count badge. Fix the label to start with the
  visible text (`Detail {count} ketidakhadiran {name}`) and add a space between text and badge.
  attendance.test.tsx:344 builds the name through `fillMessage`; adding `count` only changes how the
  button is found, not what is asserted. Allowed; I verify by reading that diff.
- Reverse: restore `detailAria` in messages.ts and the old call sites.

## D-012 (P1, implementation): attendance.spec recap checks move to the home page
- Question: attendance.spec:65 and :122 expect "Rekap bidang" on `/attendance`. apps/web/PLAN.md line 95
  (the documented behavior) puts the recap on the home page only. Pre-existing drift, unrelated to the base path.
- Options: (a) hard stop; (b) point the recap lookups at the home page, keep every assertion; (c) change the app to show the recap on Kehadiran.
- Choice: (b). Reason: consistent with the documented behavior and the existing code; (c) would be an unplanned UI change.
  Conditions: every existing assertion stays (incl. scroll/axe on Kehadiran and the h1 check); the recap heading and
  recap table checks run on home. I verify by reading the diff.
- Reverse: point the two lookups back at `attendance`.

## D-013 (P1, review of B's report): timing-only spec edits accepted
- `test.setTimeout(90_000)`, a 20s expect timeout in assign.spec, and a 400ms wait before the toggle height
  measurement in availability.spec. Accepted as timing, not assertions, provided the 44px minimum assertion is unchanged.
  I verify by reading the diff. Reverse: remove the timeouts and the wait.

## D-014 (T1, user answer after hard stop): services keep their soft delete
- Question: existing `DELETE /services/:id` is a soft delete. Options: keep, or change to hard delete.
- Choice (user, in conversation): keep the soft delete. T1 adds delete endpoints for users and bidang only; the
  service endpoint, its tests and docs are untouched. PUBLIC_PLAN.md T1/T2 text still says services hard delete; I did not edit it
  (not mine to edit). T2 (portal) must use the existing soft-delete endpoint for services.
- Reverse: a later feature that converts services to hard delete.

## D-015 (T1, user answer): cascade wins over attendance history
- Choice (user: "whichever easier"): deleting a user or bidang cascades their memberships, assignments, unavailability and
  the absence rows hanging off those assignments (ON DELETE CASCADE). Simplest, and matches the plan's cascade decision.
- Reverse: new migration restoring RESTRICT plus a 409 check.

## D-016 (T1, user answer): block deleting users who created records
- Choice (user): `created_by` (services), `assigned_by` (assignments) and `recorded_by` (absences) FKs stay RESTRICT. Deleting a
  user still referenced there is rejected with 409 (coded error, B names it). No schema change to those columns.
- Consequence to watch (T2): soft-deleted services keep their `created_by`, so an `e2e-` user who created a service can never be
  deleted by the cleanup. T2 must have e2e services created by the E2E admin (or accept and report). Logged for T2.
- Reverse: nullable + SET NULL migration.

## D-017 (T1, user answer "sure"): last-ADMIN counts all ADMIN rows; self-delete is 400
- Last ADMIN: count all users with role ADMIN (active or not). Self-delete: 400, like PATCH self-change.
- Reverse: change the count query / error status.

## D-018 (T1, user approval "B, yes, yes"): schema and test changes approved
- Approved by the user: (1) option B: new FKs `service_absences.user_id -> users` and `.team_id -> teams` (CASCADE) and the composite
  FK to `service_assignments` RESTRICT -> NO ACTION; (2) `assigned_by` and `recorded_by` RESTRICT -> NO ACTION; (3) replace the two
  tests that encode the old behavior (schema.e2e-spec membership RESTRICT test, teams.e2e-spec "has no delete-team route") with tests
  of the new behavior. No other existing test may change. PUBLIC_PLAN.md delete row reverted to hard delete for users/bidang at the
  user's request (services stay soft).
- Reverse: a migration restoring the old FKs, and restoring the two tests.

## D-024 (B2, plan review, mine): accepted B's recommendations
- Body/response keys camelCase (`adminNote`; the plan text's `admin_note` was indicative). `handledBy` in list/PATCH responses is `{id, name}` or null (no email or role),
  because a PEMBINA cannot read the users list so a bare id would be useless. Any successful PATCH sets handledBy/handledAt (even a no-op or a reset to NEW).
  `adminNote` null or blank clears it. Empty or repeated `?status=` is 400. PATCH returns the updated item. Counts live in a small new `admin-submissions` module;
  admin controllers go into the existing prayer-requests and volunteer-applications modules. Single-statement SQL for PATCH (CTE) and DELETE ... RETURNING is allowed
  as long as it stays atomic and parameterised. No Status entry in apps/api/PLAN.md, as for B1. Reverse: change the DTO/response mapper, or add a nullable column later.

## D-023 (B1, plan review, mine)
- Request keys are camelCase (`wantsFollowUp`, `fullName`, `bidangIds`, `consent`, `website`), matching existing DTOs; DB columns stay snake_case. Reverse: rename DTO fields.
- Rate-limit test setup: resettable throttler storage override in the e2e tests only, production code and the 5 per 10 minutes values untouched (the plan says
  fix the test setup, not the limit). Rejected: a PUBLIC_RATE_LIMIT env knob (new config surface). Heads-up logged for F4/F5/P2: real-backend e2e cannot reset the
  in-memory limiter without restarting the backend (forbidden), so more than 5 public POSTs per endpoint per 10 minutes from one IP will return 429 there.
  That is a decision for the user before F4 (likely a PUBLIC_RATE_LIMIT knob set in the dev env, like LOGIN_RATE_LIMIT).
- No extra DB CHECK constraints (schema additions the plan does not imply); DTO validation only. Reverse: a later migration adding the checks.
- Unknown bidang ids: plain 400 (standard body, message), no new error code. Honeypot: validate first, so an invalid body is still 400. `wantsFollowUp` optional,
  default false. `bidangIds` max 20, duplicates ignored. Contact/whatsapp: length and non-empty only, no format check. `handled_by` FKs ON DELETE SET NULL, join
  `bidang_id` FK ON DELETE CASCADE (so DELETE /teams/:id is never blocked). No CORS work.
- apps/api/PLAN.md: update the data model, API, decisions and out-of-scope text; do NOT add a Status entry (its Status is for the numbered features). The root CLAUDE.md POC
  caveat B suggested is outside B1's scope (apps/api only): not done; the shared-IP rate-limit risk goes in the final report instead.
- Reverse: n/a, plan-level choices as listed.

## D-022 (T2, user answers after the plan hard stop)
- 1. Undeletable PEMBINA: option A. One fixed shared e2e PEMBINA account, excluded from cleanup like the E2E admin (a second permanent exception
  to the plan's e2e rule, approved by the user). All PEMBINA actions that create services use it. Reverse: backend `created_by ON DELETE SET NULL`
  (schema change) and then remove the exception.
- 2. Token cache: gitignored file under `.screens/`, mode 0600, written atomically, removed at teardown.
- 3. DB reset rule CHANGED by the user: `db:reset` is now run at the START of every feature, once, right before its first B is created (not only in
  preflight, and never mid-feature). Applies from T2 on. Dev backend LOGIN_RATE_LIMIT is 1000 (told by the user), so the "passes with the default
  5" criterion cannot be run against this backend; T2 will record login calls per email instead to show no email exceeds 5. I cannot restart the backend.
- Reverse: n/a.

## D-021 (T2, plan review, mine): small UI choices
- Delete button on the Teams and Users LIST only, not on TeamDetailPage (simpler; easier to add later). A 409/400 delete error is a toast with
  the mapped Indonesian message and the dialog closes (matches existing patterns). Services keep their existing delete button; only the
  confirmation copy changes to say it is permanent. Reverse: add the detail button / inline alert later.

## D-020 (T1, user answer "1"): fix the stale web e2e specs as a separate chore before committing T1
- Question: web e2e is red (33 failures) because commit 63bd3be removed the forced password change that specs still expect.
- Options: (1) update the specs now, separate from T1; (2) commit T1 and fix in T2; (3) restore the forced change.
- Choice (user): 1. A fresh B (sonnet, scope apps/web e2e) updates only what the specs expect about the forced change; all other
  assertions stay. Tests whose whole purpose was the forced-change page cannot be fixed by rewording: B must report them (hard stop
  candidate: deleting or weakening a test is not allowed).
- Reverse: n/a.

## D-019 (T1, mine): dev DB migrated through the existing script
- The new migration is run on echo_dev with `npm run migration:run` (allowed by the plan: echo_dev changes only through the migration
  script), after tests pass on the test DB, so the running dev backend and later web e2e match the schema. No db:reset.
- Reverse: `npm run migration:revert`.
