# RUN_LOG: public site build

Branch: `public-site-build` (created from `main` at 0009da3)

## Preflight (2026-11-09)

1. Read PUBLIC_PLAN.md, root CLAUDE.md, apps/api/CLAUDE.md, apps/web/CLAUDE.md, docs/api/README.md.
   - `apps/public` does not exist yet (created in F1).
   - PUBLIC_PLAN.md names the API docs `apps/api/docs/api/README.md`; the real location is
     `docs/api/README.md` (root CLAUDE.md agrees). See DECISIONS.md D-001.
   - The API has no `/api` prefix and health is `GET /health`. The `/api` prefix is only a dev
     proxy / reverse proxy concern.
2. Branch `public-site-build` created from main (working tree was clean).
3. `GET http://localhost:3000/health` returned 200.
4. E2E_* env vars: not checked, not printed (per instructions).
5. Baseline:
   - `npm run check -w @echo/web`: pass (20 files, 287 tests).
   - `npm test -w @echo/api`: pass (2 files, 8 tests).
   - `npm run lint -w @echo/api`: pass, no output.
   - `npm run test:e2e -w @echo/api`: pass (11 files, 239 tests). The logged
     "blocked for test" QueryFailedError is an intentional trigger in a test.
6. Migrations: `npm run migration:run` (builds, then runs TypeORM against `dist/`); test DB:
   `npm run migration:run:test`; generate: `npm run migration:generate -- src/migrations/<Name>`;
   seed: `npm run seed`. No `synchronize`. All are existing npm scripts, so no hard stop.
   `@nestjs/throttler` is already listed in apps/api dependencies.
7. Agent tool accepts `model: "sonnet"`.
8. Resume: Status list is fully unticked, git status clean. Starting at P1.

## B sessions
- B1-P1 (model: sonnet): P1 plan, then implementation (same B). Plan approved, see DECISIONS D-002..D-004.

## P1 verification (in progress, HARD STOP)
- git status / diff stat: 20 files, all inside apps/web (plus untracked .orchestrator/). In scope.
- B reported `npm run check -w @echo/web` green (287 tests). Not yet re-run by me.
- `npm run e2e -w @echo/web` run by me: 87 tests, most fail with
  `Missing environment variable E2E_ADMIN_EMAIL` / `E2E_USER_PASSWORD` (thrown by
  apps/web/e2e/fixtures.ts `requireEnv`). The E2E_* variables are NOT set in the shell that
  Claude A and B run in, although preflight item 4 says they are. Passing: health.spec.ts
  (proxy works under the new base) and the two unauthenticated auth tests.
- I did not check, print, or source the variables, and did not look for them.
- Result: acceptance criterion "full e2e suite green under the new base" is UNVERIFIED.
- Not yet done: re-run check myself, grep for any/ts-ignore/.only/.skip, doc review, commit.
- State: branch `public-site-build`, last commit 0009da3, unstaged P1 changes in apps/web,
  nothing staged, nothing committed. Status list unticked.

## Run resumed (2026-11-09, second session)
- HEAD is now 94c414f ("Update public plan"). The plan's P1 scope now INCLUDES
  `scripts/poc-up.sh` and the root CLAUDE.md "Laptop POC hosting" section, so D-004's
  "known gap" is superseded (see D-005). Those two files are still untouched: P1 is not done.
- Backend `GET /health` = 200. Uncommitted changes: the same 20 files in apps/web (in scope).
- I re-ran `npm run e2e -w @echo/web`. The E2E_* variables are now visible to the tests
  (they reached `POST /api/auth/login`; I did not read or print them). Result: the first few
  logins pass, then every login returns **429**, so nearly all of the 87 tests fail in
  `apiLogin` (e2e/fixtures.ts:29, `API login failed with status 429`).
- Cause (from docs/api/auth.md:26): login is limited to `LOGIN_RATE_LIMIT` (default 5) attempts
  per email per IP per 15 minutes. The e2e suite logs in as the admin far more often than
  that, so it cannot pass against a backend running the default limit. Waiting alone will not
  fix it. This is not a credential failure (the status is 429, not 401).
- HARD STOP: raising the limit means setting `LOGIN_RATE_LIMIT` in the backend's env and
  restarting the backend. Restarting the backend is forbidden for me and every B, and I may
  not read `.env`. I did not work around it.
- Not done: poc-up.sh and root CLAUDE.md POC edits (B work), my own `npm run check` re-run,
  grep for any/ts-ignore/.only/.skip, doc review, commit. Status list unticked.
- State at stop: branch `public-site-build`, last commit 94c414f, 20 unstaged files in
  apps/web plus untracked .orchestrator/, nothing staged, nothing committed.

## Run resumed (2026-11-09, third session) — HARD STOP again
- HEAD is b540687 ("chore: T2 logs in once per run"). Branch `public-site-build`. Same 20
  unstaged apps/web files + untracked .orchestrator/. Backend `GET /health` = 200.
- Re-ran `npm run e2e -w @echo/web` once to see whether the backend login limit had been
  raised since the last stop. Result: 22 passed, the rest failed (8.2 min). Same failing
  pattern as the second session (every test that needs an admin or user login). I did not
  re-confirm the 429 status code this time (tail of output only); I did not read or print
  any E2E_* value.
- Why this still blocks P1: P1 acceptance needs the full existing e2e suite green. The suite
  logs in per test, which exceeds the default `LOGIN_RATE_LIMIT` of 5 per 15 min. The "log in
  once per run" fix is in T2, which comes after P1, so P1 as ordered cannot pass against a
  backend on the default limit.
- Not done: any B session, poc-up.sh / root CLAUDE.md edits, my own check re-run, doc review,
  commit. Status list unticked.

## Run resumed (2026-11-09, fourth session)
- HEAD b540687, branch `public-site-build`, same 20 unstaged apps/web files + untracked
  .orchestrator/. Backend `GET /health` = 200.
- Probe: `npm run e2e -w @echo/web -- e2e/teams.spec.ts e2e/services.spec.ts` (17 tests):
  4 passed, 13 failed. NO 429 this time: login works, global setup logged in once and printed
  `e2e cleanup: 19 of 19 removed`. The login-limit blocker from sessions 2 and 3 is gone.
- New failures are not login related:
  - services.spec.ts (7): `getByLabel('Tanggal mulai')` strict mode violation, resolves to the
    date-picker button and a hidden `input[type=date]` (services.spec.ts:59).
  - teams.spec.ts (6): rows/cards for the `e2e-` team not found on the list after the test
    created it (teams.spec.ts:233 and others).
  Unknown whether these are pre-existing (UI changed after the specs were written) or caused by
  the P1 changes. To be diagnosed by a fresh B (comparing against committed HEAD via
  `git diff`/`git show`, not by checkout/stash).
- Action: fresh B given P1 to finish (resume rule 8), see B sessions below.

## B sessions (fourth session)
- B2-P1 (model: sonnet): finish and verify P1 from the existing uncommitted apps/web changes, plus
  scripts/poc-up.sh and the root CLAUDE.md POC section; diagnose the 13 failing e2e tests.

## B2-P1 result: HARD STOP (e2e login with provided credentials fails)
B's report (not yet verified by me, so treat as claims):
- Done: scripts/poc-up.sh (waits on and prints `/volunteer-portal/`), root CLAUDE.md POC section,
  apps/web docs, new auth.spec test (deep link hard refresh + no request to old `/volunteer`
  path). Selector fixes in services.spec.ts and routes.spec.ts (date picker button + hidden
  input both match the label) and a `showTeam()` pagination helper in teams.spec.ts. Both
  are pre-existing drift (DateField.tsx, usePagination.ts unchanged at HEAD), not P1 faults.
- Full `npm run e2e -w @echo/web`: 60 failed, 27 passed (9.6m). Log in the scratchpad `full.log`.
- BLOCKER: a user created through the admin API gets 401 from POST /api/auth/login when logging
  in with E2E_USER_PASSWORD (B's probe spec, deleted afterwards). So E2E_USER_PASSWORD does not
  match the running backend's default user password. ~26 tests depend on this (auth, users,
  services-PEMBINA, teams-non-admin, responsive). I did not read or print any value.
- Hard stop rule: a login with the provided credentials fails. I do not look for or work out the
  credentials and cannot restart the backend.
- Pending decision (not made, since the stop comes first): make the other specs pagination-aware
  (services, schedule, users, routes, teams detail) with one shared helper; B recommends yes.
- Not done: my own verification (scope, diff, check, grep, criteria), commit, tick. P1 unticked.
- State: branch `public-site-build`, last commit b540687, ~23 unstaged apps/web files plus
  scripts/poc-up.sh and root CLAUDE.md, untracked .orchestrator/, nothing staged.

## Run resumed (2026-11-09, fifth session) — HARD STOP again
- HEAD is 3b2e6c2 ("chore: pagination-aware e2e helper moves to T2"). That settles the pending
  pagination decision from B2-P1: pagination-aware helper belongs to T2, not P1 (see D-006).
  Branch `public-site-build`, same unstaged files (22 tracked + untracked .orchestrator/),
  nothing staged. Backend `GET /health` = 200.
- Probe: `npm run e2e -- e2e/auth.spec.ts e2e/users.spec.ts` in apps/web: 2 passed, 16 failed.
  Admin login itself works (global setup ran). The failures in `createE2eUser`
  (e2e/fixtures.ts:60) throw: "POST /users returned 403: the e2e admin may still have to change
  its password (PASSWORD_CHANGE_REQUIRED). Stopping." So the E2E admin account has a forced
  password change pending on the dev database. Every test that creates a user through the admin
  API fails, and so does everything that depends on those users.
- Not the same as session 4's symptom (401 for created users logging in with E2E_USER_PASSWORD):
  that may be a consequence, or still a separate problem. I cannot tell without touching the credentials.
- Why hard stop: it is a login/credential-state problem with the provided E2E admin. Fixing it
  means changing the admin's password or the flag (through the API, the UI or the db), which is
  working with the credentials or direct db access. Forbidden, and not mine to decide.
- Not done: any B session this run, my own verification, doc review, commit, tick. P1 unticked.
- State at stop: branch `public-site-build`, last commit 3b2e6c2, unstaged P1 changes in apps/web,
  scripts/poc-up.sh, root CLAUDE.md; untracked .orchestrator/; nothing staged, nothing committed.
- (superseded by the sixth session below for the admin 403; the resume steps still apply to E2E_USER_PASSWORD)
- To resume: clear the pending password change on the E2E admin in echo_dev (log in once as that
  admin in the portal and complete the forced change, then update E2E_ADMIN_PASSWORD in your
  shell/.env to the new value, or reset the flag yourself), and make sure E2E_USER_PASSWORD
  satisfies the backend's default user password policy. Then re-run this prompt.

## Run resumed (2026-11-09, sixth session) — HARD STOP (E2E_USER_PASSWORD login fails)
- HEAD 3b2e6c2, branch `public-site-build`, same unstaged files, nothing staged. `GET /health` = 200.
- Probe `npm run e2e -w @echo/web -- e2e/auth.spec.ts e2e/users.spec.ts`: 6 passed, 12 failed.
  The admin 403 (PASSWORD_CHANGE_REQUIRED) from session 5 is GONE: admin creates users fine.
- Remaining failure type 1 (credentials): auth.spec.ts:58 — a user created through the admin API
  cannot log in with E2E_USER_PASSWORD; the login page shows "Email atau kata sandi salah."
  and stays on /login (expected /change-password). Same symptom as session 4. Affects every test
  that logs in as a created user (auth, users, services-PEMBINA, teams-non-admin, responsive).
  Hard stop by rule; I did not read, print or test the value, and did not look for it.
- Failure type 2 (not a stop): users.spec.ts:85 cannot find the created user's row (list
  pagination drift). That is the T2 pagination helper's job (D-006), not P1.
- Not done: any B session, my own verification, doc review, commit, tick. P1 unticked.
- To resume: make E2E_USER_PASSWORD match what the backend accepts for a user created via
  POST /users (the backend may require a password policy or set its own default; the value you
  verified for the admin may not be the one this flow uses). Then re-run the prompt.

## Run resumed (2026-11-09, seventh session) — HARD STOP (E2E admin PASSWORD_CHANGE_REQUIRED again)
- HEAD 3b2e6c2, branch `public-site-build`, same unstaged files (22 tracked + untracked
  .orchestrator/), nothing staged. `GET /health` = 200.
- Probe `npm run e2e -- e2e/auth.spec.ts` in apps/web: 2 passed, 7 failed. `createE2eUser`
  (e2e/fixtures.ts:60) fails: "POST /users returned 403: the e2e admin may still have to change its
  password (PASSWORD_CHANGE_REQUIRED)". Same as session 5. Admin login itself works (global setup ran).
- So the admin's forced-password-change state flips between sessions (clear in session 6, set again
  now). Something is re-setting it on echo_dev (a reseed/migration, or a test that completes a forced
  change on the admin account), or the dev db differs between runs. I did not investigate via db or credentials.
- Why hard stop: fixing it means touching the admin's password or flag, which is working with the
  credentials or direct db access. Forbidden. Session 6's E2E_USER_PASSWORD failure is also still unresolved.
- Not done: any B session, my own verification, doc review, commit, tick. P1 unticked.
- To resume: (1) log in once as the E2E admin in the portal and complete the forced change, then set
  E2E_ADMIN_PASSWORD to the new value in the shell that runs Claude; (2) make E2E_USER_PASSWORD an
  accepted password for users created via POST /users; (3) check nothing reseeds echo_dev or resets the
  admin between runs. Then re-run the prompt.

## Run resumed (2026-11-09, eighth session)
- HEAD 3b2e6c2, branch `public-site-build`, same unstaged files, nothing staged. `GET /health` = 200.
- Probe `npm run e2e -w @echo/web -- e2e/auth.spec.ts e2e/users.spec.ts`: 12 passed, 6 failed.
  Credential blockers from sessions 4-7 are GONE: admin creates users, created users log in with
  E2E_USER_PASSWORD, forced password change page is reached (auth.spec.ts:58 got to
  /volunteer-portal/change-password). No 429, no PASSWORD_CHANGE_REQUIRED.
- Remaining failures: (a) auth.spec.ts:84 expects URL `/\/$/` after the forced change but the home
  URL under the new base is `http://localhost:5173/volunteer-portal` (no trailing slash): a P1 path
  assertion to update, not a behavior change; (b) users.spec.ts rows for the created user not found
  (list pagination drift, T2's job per D-006) and users.spec.ts:201/213 that depend on it.
- Action: fresh B given P1 to finish (resume rule 8).

## B sessions (eighth session)
- B3-P1 (model: sonnet): finish and verify P1 from the existing uncommitted changes; fix path/selector
  failures only; classify every remaining e2e failure as path/selector (fix) vs pagination (report).
- STOPPED BY USER before B3-P1 reported. No result, nothing verified, nothing committed, P1 unticked.
  B3 may have left partial edits in apps/web, scripts/poc-up.sh or root CLAUDE.md; check `git diff`
  against the state at the start of this session (same 22 tracked files) before continuing.
  To resume: re-run the prompt; resume rule 8 applies (P1 is still the first unticked feature).

## Run resumed (2026-11-09, ninth session) — HARD STOP (preflight: backend not reachable)
- Branch `public-site-build`, HEAD 3b2e6c2. Same 22 unstaged tracked files (CLAUDE.md,
  apps/web/*, scripts/poc-up.sh) + untracked .orchestrator/. Nothing staged. Not diffed against the
  eighth-session start state; B3-P1 may have left partial edits, so check `git diff` before continuing.
- `GET http://localhost:3000/health`, `http://127.0.0.1:3000/health` and `http://localhost:5173/api/health`
  all fail to connect (curl exit 7, HTTP 000). The backend is not running (or not on :3000). I may not
  start it or Docker.
- Preflight item 3 fails, so I did not run the check/test baseline, start any B, or commit. P1 unticked.
- To resume: start the database and the backend in watch mode yourself, confirm
  `curl localhost:3000/health` returns 200, then re-run the prompt.

## Run resumed (2026-11-09, tenth session) — HARD STOP (preflight 5: baseline not green)
- Branch `public-site-build`, HEAD 3b2e6c2. Same 22 unstaged tracked files (CLAUDE.md, apps/web/*,
  scripts/poc-up.sh) + untracked .orchestrator/. Nothing staged. Nothing under apps/api is modified.
  `GET /health` = 200 (backend is back).
- Baseline results:
  - `npm run check -w @echo/web`: pass (20 files, 287 tests).
  - `npm test -w @echo/api` (unit): pass (2 files, 8 tests).
  - `npm run test:e2e -w @echo/api`: **FAIL**, 238 passed, 1 failed (239). Failing test:
    `test/users.e2e-spec.ts:401` "POST /users/:id/reset-password > resets to the default password and
    requires a change": `loginWith(target.email, PASSWORD).expect(401)` got 200 (after the reset, the
    old PASSWORD still logs in). Re-ran that file alone: same single failure, so it is deterministic,
    not flaky. At the first preflight this suite passed 239/239.
  - The "blocked for test" QueryFailedError in the output is the known intentional trigger, not the cause.
- Likely cause (UNVERIFIED, I did not read env files): the test's PASSWORD now equals the backend's
  default/reset password in the test env (`.env.test`), so "old password gives 401" can no longer hold.
  Something about that env value changed since the first preflight (sessions 4-8 also showed the
  E2E/default-password state changing between runs).
- Why hard stop: preflight 5 says the baseline must be green. Fixing needs reading/changing `.env.test`
  (forbidden for me) or editing an existing API test (forbidden: never weaken a test).
- Not done: any B session, P1 verification, commit, tick. P1 unticked.
- RESOLVED (same session): the user fixed `.env.test` themselves. `npm run test:e2e -w @echo/api` now
  passes 239/239. Baseline green: web check 287, api unit 8, api e2e 239. Preflight complete; starting P1
  (resume rule 8: the 22 uncommitted files belong to P1, given to a fresh B to finish and verify).
- USER INSTRUCTION (tenth session): stop after the P1 commit. Do NOT start T1. The user wants to adjust
  PUBLIC_PLAN.md before the run continues. After the commit, report and wait.

## P1 result (tenth session): HARD STOP (acceptance "full existing e2e suite green" not met)
B sessions: B-P1-plan and B-P1-impl (same agent, model: sonnet). B's claims, NOT yet verified by me
(I only re-checked `git status`: same 22 tracked files, all in scope, nothing staged):
- `npm run check -w @echo/web` pass (287 tests); `npm run build -w @echo/web` OK (dist references
  /volunteer-portal/); `bash -n scripts/poc-up.sh` OK; 401 handling in client.ts is basename-safe.
- Full e2e (one run, ~12 min): 87 tests, 52 passed, 35 failed. No failure looks like a base-path symptom;
  the new deep-link/no-old-path test passed.
- 29-ish failures = list pagination drift (assign, attendance, availability, schedule, services, users,
  teams, routes:277). Local fixes would be a page-walk in 8 specs = the T2 shared helper (D-006/D-007).
- 7 failures = real a11y bug in apps/web src, NOT P1: home "Rekap bidang" buttons have
  aria-label "Detail ketidakhadiran: ..." but visible text "Detail" (axe serious
  label-content-name-mismatch). Fails responsive.spec:6 (3) and routes.spec:133 (4).
- 1 unclassified: auth.spec:58 after reload `getByRole('main').getByText(user.name)` not visible (line 92).
- Not done: second e2e run, deep-link curl and screenshot, my own verification, commit, tick.
- State: branch public-site-build, HEAD 3b2e6c2, 22 unstaged tracked files + untracked .orchestrator/.
- Why stop: the criterion cannot be met as written without (a) T2's pagination helper and (b) a src fix
  outside P1's diff. I may not reword the criterion or reorder features. This matches the user's request
  to stop and adjust PUBLIC_PLAN.md.
- Options for the user: (1) reorder/split the plan so the pagination helper and the a11y fix come before
  or inside P1; (2) relax P1 to "base-path complete, known failures listed"; (3) fix the 35 failures first
  as a separate chore. Then re-run the prompt (resume rule 8 applies to the uncommitted P1 files).
- (original resume note, now obsolete) To resume: make the test environment's default user password differ from the PASSWORD constant used in
  `apps/api/test/users.e2e-spec.ts` (compare `.env.test` with `.env.example`'s default password), confirm
  `npm run test:e2e -w @echo/api` passes 239/239, then re-run the prompt.

## Run resumed (2026-11-09, eleventh session)
- Prompt change: P1 now explicitly covers the pagination-aware helper across specs, the "Rekap bidang"
  aria-label fix and the auth.spec:58 cause (see D-008). HEAD 1352cf8, branch `public-site-build`, same
  22 unstaged tracked files (CLAUDE.md, apps/web/*, scripts/poc-up.sh) + untracked .orchestrator/. Nothing staged.
- Preflight: `GET /health` = 200. Not checked: E2E_* values.
- Baseline (machine under load, load average ~10 after my own runs; vitest 5s timeouts trip):
  - `npm run check -w @echo/web`: typecheck + lint pass; unit tests flaky under default parallelism
    (run 1: 6 failed, run 2: 9 failed, DIFFERENT tests each time, all 5s timeouts). With
    `npm test -w @echo/web -- --maxWorkers=2`: 287/287 pass. Not a code failure.
  - `npm test -w @echo/api`: 8/8 pass.
  - `npm run test:e2e -w @echo/api`: 238/239 once (seed.e2e-spec "runs the real seed-data.ts" 5056ms timeout);
    that file alone: 11/11 pass. Earlier sessions: 239/239. Same load flake, nothing in apps/api is modified.
  - Baseline accepted as green; load flake noted. Use `--maxWorkers=2` for web unit runs when load is high.
- Migrations: unchanged from preflight item 6.

## B sessions (eleventh session)
- B1-P1-plan (model: sonnet, planning only, no changes): P1 plan covering the existing uncommitted diff,
  the helper, the aria-label fix, auth.spec:58 and auth.spec:84.
  Plan review: approved with conditions, see D-009..D-011 (plan round 1 of max 2). Same B resumed to implement
  (B1-P1-impl, model: sonnet). Waiting for its report; nothing verified by me yet.
- B1-P1-impl report #1 (B's claims, not yet verified): code done, typecheck/lint/unit (287) pass; last full e2e
  84 passed / 3 failed (attendance:65, :122, assign:153); assign:153 then fixed and assign.spec re-run 6/6; full suite
  not re-run. Blocker: attendance specs look for "Rekap bidang" on /attendance but PLAN.md (line 95, which I checked)
  puts it on the home page. Decision D-012 (move lookup to home, keep all assertions), D-013 (timing-only edits).
  Fix round 1 of max 3: B told to apply D-012 and run check + one full e2e.
- Timing note for the user (asked "why so slow"): B's time so far ~43 min total for plan + implementation, mostly
  waiting on 10+ minute full e2e runs on a loaded machine (config: fullyParallel, default workers, 30s test timeout,
  no global setup so every test logs in itself). At verification I will time the full run and record per-test durations.
  Also noted by B: ~350 leftover users in echo_dev make `findInList` walks slow (35 pages); cleanup is T2.
- B1-P1-impl report #2 (B's claims): after D-012, `check` pass and ONE full e2e 87/87 green, 8.3 min wall time,
  teardown "124 of 124 removed", no 429s. B's total running time ~54 min across plan + implementation.

## P1 verification (my own, eleventh session)
- Scope: `git status`/`git diff --stat`: 24 tracked files, all in apps/web, plus scripts/poc-up.sh and root CLAUDE.md
  (both in P1 scope) and untracked .orchestrator/. Nothing in apps/api. PASS.
- Dependencies: no diff in package.json / package-lock.json / apps/web/package.json. PASS.
- Greps on added lines in apps/web (`any`, `@ts-ignore`, `.only(`, `.skip(`): no hits. PASS.
- Spec diffs read. Removed assertion lines are all replaced: `itemFor/teamItem` visibility checks now go through
  `findInList(...)` + the same `toBeVisible`/`toContainText`; five `toHaveURL(/\/$/)` became the stricter
  `/\/volunteer-portal\/$/`; the recap-heading assertion moved from Kehadiran to home (D-012) and the Kehadiran
  h1/scroll/axe checks stay. Timing-only edits (D-013): `expect` timeout 20s in assign.spec, `setTimeout(90_000)` in
  assign and availability, a 400ms wait before the 44px measurement; the `>= 44` assertion is unchanged. New
  assertions only (deep-link test, home hard refresh, no request to `/volunteer/`). No test deleted/skipped. PASS.
- src diff read: router basename = BASE_URL (trailing slash), `detailAria` = `Detail {count} ketidakhadiran {name}`
  with a space before the badge, attendance.test.tsx only adds `count: 1` to the name lookup (fixture Amy count 1).
  `vite.config.ts` base `/volunteer-portal/`. `poc-up.sh` waits on and prints `/volunteer-portal/`. PASS.
- `npm run check -w @echo/web -- --maxWorkers=2`: pass, 20 files / 287 tests (npm warned that `--maxWorkers`
  was passed to npm, so vitest may not have received it; the run still passed).
- Process slip (mine): I appended `; echo done` to one command, which the rules forbid (no chaining with `;`).
  Harmless, logged, not repeated.
- Test selection: changed files are apps/web + scripts + root docs, so row "apps/web": `npm run check` + apps/web e2e.
  Nothing in apps/api, no package.json/lockfile change, so no api or other-app tests.
- My full `npm run e2e -w @echo/web`: **87 passed, 0 failed, 8.3 min** wall time, teardown "e2e cleanup: 124 of 124
  removed". Output kept at the scratchpad `e2e-p1-verify.log`.
- Timing breakdown (asked by the user): summed test time 1803 s over 498 s wall = ~3.6x parallelism. Slowest tests are
  the list-walking and per-width tests: users responsive 48-72 s each, teams responsive 38-45 s, routes admin 38-42 s,
  assign 43 s. The 4 specs that walk paginated lists (users, teams, services, schedule) hold 36 of the 87 tests. Cause:
  ~350 leftover users (35 pages) make `findInList` walks slow, plus every test logs in itself and the machine is
  loaded. No test waited out a failure timeout in this passing run. T2's cleanup and single login should cut this;
  not changed here (config is not mine to edit).
- Acceptance criteria, one by one:
  1. Full existing e2e suite green under the new base: 87/87 (above). PASS.
  2. Hard refresh on a deep link works: auth.spec:116 "deep link survives a hard refresh under /volunteer-portal/ and
     never hits the old path" passed; it also hard-refreshes home (auth.spec:58 reload test passed too). PASS.
  3. No request goes to the old `/volunteer` path: same test asserts every request path is under /api/ or
     /volunteer-portal/ and none starts with /volunteer/. PASS.
  4. apps/web README and CLAUDE.md state the base path and dev URL (README:16, CLAUDE.md:11 and :48; .env.example
     comment says origin only); grep for `/volunteer([^-]|$)` over apps/web, scripts and root CLAUDE.md finds only
     auth.spec.ts:136, the no-old-path assertion. PASS.
  5. scripts/poc-up.sh waits on and prints `/volunteer-portal/` (read the diff, `bash -n` OK); root CLAUDE.md POC
     section matches (one wording change; one oddly wrapped line left, cosmetic). PASS. Not run: the script itself
     (needs Docker, cloudflared and starting services, which I may not do).
  6. Global: loading/error/empty states unchanged; axe serious/critical clean in responsive.spec:6 (390/768/1280) and
     routes.spec:134 (all four widths), attendance:122, all passed. The "Rekap bidang" aria-label fix is proven by those
     axe tests and the unit test, not by screenshots.
- Screenshots viewed (4 of max 6, from my run): login 360 and 1280, home 360 and 1280 (admin). Layout fine, assets load
  under the new base. The home shots show the recap EMPTY state, so the changed "Detail" button is not visible in them.
- Docs: web README, CLAUDE.md, PLAN.md "Base path" row, .env.example, root CLAUDE.md POC section all state the new base
  path; none mention the old path. PASS.
- Result: P1 verified. Fix rounds used: 1 (D-012). B sessions: 1 agent (plan then implementation, two resumes for the
  decision and the status check).

## Run resumed (2026-11-09, twelfth session): new prompt with preflight db:reset
- P1 is committed (a1835ee) and ticked. HEAD a8f0451, branch `public-site-build`, working tree clean. First unticked: T1.
- Preflight: plan, all CLAUDE.md files, docs/api/README.md (real path, D-001), logs read. `GET /health` = 200.
  E2E_* not checked. Baseline: `npm run check -w @echo/web` 287 pass; `npm test -w @echo/api` 8 pass;
  `npm run lint -w @echo/api` clean; `npm run test:e2e -w @echo/api` 239 pass. Migration script: `npm run migration:run`
  (existing, unchanged); `@nestjs/throttler` already in apps/api deps; root workspaces `apps/*` already covers apps/public.
- `npm run db:reset -w @echo/api`: "Reset done: echo_dev", "Seed done." Health still 200. Not to be run again this session.
- Starting T1.

## B sessions (twelfth session)
- B-T1-plan (model: sonnet, planning only): T1 inventory of existing delete endpoints + plan. Reported; changed nothing
  (`git status` shows only this log modified).

## T1 inventory and HARD STOP (twelfth session)
Inventory (B's report; the service finding verified by me with grep):
- users: no delete endpoint (only create, list, PATCH isActive/role, reset-password). Class-level ADMIN.
- teams (bidang): no delete endpoint. No soft-delete column.
- services: `DELETE /services/:id` exists, ADMIN+PEMBINA, 204, but it is a SOFT DELETE
  (`services.service.ts:90` `softDelete`, `service.entity.ts:36` `@DeleteDateColumn deleted_at`). Row stays.
  Docs, attendance recap ("soft-deleted services still count"), availability, assignments and
  `TeamsService.removeMember` all depend on it.
- team membership `DELETE /teams/:id/members/:userId`: hard delete, ADMIN, 200 with removedAssignments (kept as is).
- assignments `DELETE /services/:id/teams/:teamId/assignments/:userId`: hard delete, leader or ADMIN (kept as is).
- FKs: every FK to users/teams/services is ON DELETE RESTRICT (none CASCADE or SET NULL). `created_by`,
  `assigned_by`, `recorded_by` -> users are NOT NULL.
HARD STOP: the T1 rule says an existing soft delete must not be changed; stop and report. I did not plan or build anything.
Open decisions for the user (B's recommendations in brackets):
1. Services: keep soft delete and drop services from T1 [recommended], or change to hard delete (rewrites existing
   soft-delete tests/docs, loses recap history of deleted services).
2. Cascade vs attendance: user/team delete cascades assignments and silently removes absence history [recommended per
   plan], or block with 409 when attendance exists.
3. `created_by` / `assigned_by` / `recorded_by` NOT NULL FKs block hard-deleting any user who created services or assigned
   people (the seeded admin likely created all services). Options: block with 409 [B's pick], CASCADE (too destructive),
   or make nullable + SET NULL (schema change). Plan implies cascade of memberships/assignments only, not these.
4. Last-ADMIN rule: count all ADMIN rows [recommended] or only active ones.
5. Self-delete: 400, matching the existing PATCH self-change convention [recommended].
State at stop: branch public-site-build, HEAD a8f0451, only .orchestrator/ modified, nothing staged, T1 unticked.
To resume: answer 1 to 3 (4 and 5 can stay at the recommendations), update PUBLIC_PLAN.md T1 if the scope changes, re-run the prompt.
- RESOLVED in conversation: user answered keep soft delete, cascade, block 409, last-ADMIN all rows, self-delete 400 (D-014..D-017).

## T1 plan round 2 (B-T1-plan resumed): STOPPED FOR USER APPROVAL (schema + existing tests)
B's plan (verified facts per B; not yet checked by me): `service_absences.team_id` has no FK; the composite FK
(service_id,user_id)->service_assignments is RESTRICT, so a plain cascade would make any user/team with an absence undeletable,
and flipping it to CASCADE would break the existing 409 HAS_ATTENDANCE_RECORDS tests and PLAN.md line 159.
Proposal needing approval (schema = no-guess area, existing tests = hard stop):
1. Option B: add FKs `service_absences.user_id -> users` and `.team_id -> teams` (both CASCADE), composite FK RESTRICT -> NO ACTION.
   Option A (no new FKs): service layer deletes the user's/team's absences first in the same transaction; small race, not DB-enforced.
2. `assigned_by` and `recorded_by` RESTRICT -> NO ACTION (same blocking, checked at statement end; avoids wrongly blocking self-assigned users).
3. Two existing tests encode the superseded behavior and cannot pass as written: schema.e2e-spec "refuses to delete a user who has a
   team membership (RESTRICT)" and teams.e2e-spec ~line 300 "has no delete-team route" (404). B proposes replacing them with the new behavior's tests.
Why stopped: my rules forbid guessing on schema and forbid deleting or weakening an existing test; the plan did not clearly imply these.
State: branch public-site-build, HEAD a8f0451, only .orchestrator/ modified, T1 unticked.
- RESOLVED in conversation: user approved "B, yes, yes" (D-018). PUBLIC_PLAN.md delete row reverted to hard delete for users/bidang at the
  user's request (the only plan edit I made, on explicit instruction).

## T1 implemented and verified by me; HARD STOP on the web e2e row (twelfth session)
B-T1-plan resumed to implement (model: sonnet; B sessions for T1: 1 agent, 2 plan rounds, 1 implementation, 0 fix rounds).
My verification:
- Scope: `git status`/diff stat: only apps/api (src, test, new migration 1794235300560-CascadeUserTeamDeletes.ts, PLAN.md), docs/api/*,
  PUBLIC_PLAN.md (user-requested) and .orchestrator. No package.json or lockfile change. PASS.
- Added-line greps: no `any`, `@ts-ignore`, `.only(`, `.skip(`. Test diffs read: only the two approved tests replaced
  (schema "refuses to delete a user who has a team membership" and teams "has no delete-team route"); everything else is additions. PASS.
- Migration SQL read: only the approved FKs dropped/re-added, 2 new absence FKs, `down()` restores. PASS.
- `npm run lint -w @echo/api` clean; `npm test -w @echo/api` 8/8; `npm run test:e2e -w @echo/api` 258/258 (was 239). PASS.
- Docs read: users.md, teams.md, README.md (32 routes, error codes), permissions.md, flows.md, attendance.md, apps/api/PLAN.md; grep for stale
  "no delete" wording in docs, READMEs and PLANs finds none. PASS.
- Test selection: T1 touches existing entities/tables, so row "apps/api touching existing ... tables" applies: api tests + apps/web e2e.
- My `npm run e2e -w @echo/web` (dev DB already migrated by B with `npm run migration:run`): **54 passed, 33 failed, 4.9 min** (P1: 87/87, 8.3 min;
  faster after the preflight db:reset). ALL 33 failures are one cause: 29 expect `/\/change-password$/` but the new user lands on
  `/volunteer-portal/` (home), 4 expect the heading "Ganti kata sandi". Cause: commit 63bd3be ("stop forcing password change for new and reset
  accounts", after P1's green run) removed the forced change; apps/web specs that create users and log in still expect it. Not related to T1
  (no auth, login or user-creation code changed). I cannot prove this by running T1-less code (git checkout/stash forbidden), but the errors are
  uniform and a1835ee (87/87) predates 63bd3be.
- Not met as written: global criterion "existing tests still pass in every affected app" (web e2e red). Fixing means editing web spec ASSERTIONS about
  the forced-change flow (apps/web, outside T1's scope, and a behavior-assertion change, not a way of finding records), so it is a hard stop.
- (superseded below) Not done: tick, commit. T1 code is complete and uncommitted.

## Web e2e chore (D-020), thirteenth step of the twelfth session
- B-web-e2e (model: sonnet): plan, then implement. Plan: 26 of the 33 failures are one shared helper (`loginAndChange` in
  e2e/fixtures.ts plus a private copy in schedule.spec.ts) expecting the removed forced change; 7 tests assert the forced-change page.
  No API or UI path reaches that page any more (docs/api: nothing sets mustChangePassword), so it has unit coverage only.
- User chose option 1: rewrite the 7 to the new behavior, removing only the forced-change expectations. routes.spec:225 ("forced password
  change page at every width") has no equivalent left; the user has NOT said what to do with it, so it is untouched and still fails.
- Spec diffs read by me (apps/web only; README:31 and PLAN.md:145 reworded): removed assertions are exactly the change-page ones in auth:58
  (URL, heading, no-nav, route lock, wrong-current-password inline error, change submit), auth:143 x4 (change-page heading, screenshot,
  overflow, axe, empty-submit block), users:163 (`/change-password` URL became `/volunteer-portal/`), helper bodies. Kept: every login-page,
  home, reload, logout, re-login, reset-flow assertion. Added: viewport 1280 and nav visible on home in auth:58. Test titles changed. No
  test deleted/skipped; no `any`/ts-ignore/.only/.skip added.
- `npm run check -w @echo/web`: pass (B ran it twice, 287 tests). Not re-run by me after B's edits.
- My full `npm run e2e -w @echo/web`: 85 passed, 2 failed, 6.4 min. Failures: routes.spec:225 (expected, awaiting user) and
  assign.spec:221 (a 30s `toBeVisible` timeout under full-suite load); `npm run e2e -w @echo/web -- e2e/assign.spec.ts` alone: 6/6 pass,
  so it is a load flake, not a code failure.
- RESOLVED: user said delete routes.spec:225 ("2") and file the backend request note. B deleted that one test (nothing else removed;
  no import became unused) and added a low-priority entry to docs/backend-requests.md (no apps/api edit). I read both diffs.
  My `npm run check -w @echo/web`: pass (287). My full `npm run e2e -w @echo/web`: **86 passed, 0 failed, 5.6 min** (P1 baseline 8.3 min for 87;
  teardown "123 of 123 removed"). One test fewer than before, by approval.
- T1 acceptance, one by one (apps/api e2e, all in the 258 passing): ADMIN 204 and row gone (users, teams); PEMBINA/MEMBER/leader 403 and row kept;
  no token 401; unknown id 404 (+ malformed id 400); cascades (memberships, assignments, unavailability, absences) for user and team; deleting yourself
  400; last ADMIN 400 LAST_ADMIN (race test + service-level inactive-ADMIN test); blocked users 409 USER_HAS_CREATED_RECORDS (created_by incl. soft-deleted
  service, assigned_by, recorded_by); submissions `handled_by` re-check skipped (tables do not exist yet, B2 re-checks); services soft delete untouched
  (D-014, plan text amended by the user); docs updated and grepped. Existing endpoints kept (membership/assignment removal).
- T1 stats: B sessions 1 agent (3 rounds: plan, plan round 2, implement); fix rounds 0; plus web e2e chore B (1 agent, plan + implement + 1 follow-up).
  Login calls per run and T2-specific numbers are T2's.
- Commits (two, T1 first with explicit paths since `git add -A` would mix them): T1 = apps/api, docs/api, PUBLIC_PLAN.md (user edit + tick);
  chore = apps/web e2e fixes + docs, docs/backend-requests.md; .orchestrator logs go with the second commit.
## T1 committed (6b9cd09 feat(api)) and chore (dfe1bbb chore(web)); T2 plan round 1
- Ticked T1 in the Status list. Starting T2: B-T2-plan (model: sonnet, planning only). Report (B's claims, not verified by me):
  - Delete UI: services already have the button/dialog (soft delete, only copy changes); users and teams need new buttons, client methods,
    error codes USER_HAS_CREATED_RECORDS and LAST_ADMIN, hooks, unit and e2e tests.
  - E2E: every spec already uses the `e2e-` prefix; ~330 admin API logins per run today (cannot pass at LOGIN_RATE_LIMIT 5, so the running
    backend must use a raised limit); `findInList` exists; only teams.spec `memberItem()` on the member list lacks the helper.
  - Undeletable-user problem: only ONE actor is blocked by the T1 409 rule: the e2e PEMBINA in services.spec who creates a service in the UI
    (created_by survives soft delete). Leaders (assigned_by) and absence takers (recorded_by) are freed by deleting teams first (cascade).
- HARD STOP (T2 plan needs the user): (1) the plan's fixed decisions allow exactly one permanent e2e exception (the E2E admin). B's option A adds
  a second one (a fixed shared `e2e-pembina@...` account, excluded from cleanup) so the PEMBINA test can still create a service; alternatives are a
  backend change (created_by ON DELETE SET NULL, schema = the user's call) or tolerating 409. (2) Token storage: the app keeps its token only
  in sessionStorage, so Playwright storageState cannot carry it; B proposes a cached token file (gitignored, mode 0600, under .screens/, removed at
  teardown) or process.env. apps/web/CLAUDE.md says to STOP and ask about token storage. (3) Legacy `e2e-` users already in echo_dev (including
  PEMBINA users from my runs this session that created services) are undeletable, so the first cleanup would fail the run; only `db:reset` clears them,
  and my rules allow it only in preflight. Also to confirm: which LOGIN_RATE_LIMIT the dev backend runs with.
- State: branch public-site-build, HEAD dfe1bbb, working tree clean except these log edits. T2 unticked, nothing built.
- RESOLVED by the user (D-022): option A (shared PEMBINA), token cache file, db:reset at the start of every feature (I ran it before resuming B; B was
  told not to), dev LOGIN_RATE_LIMIT is 1000.

## T2 implemented and verified by me
B-T2 (model: sonnet; 1 agent: plan, resumed to implement; 0 fix rounds; 2 plan rounds counting the user decisions).
- Scope: `git status`: only apps/web (src, e2e, playwright.config.ts, CLAUDE.md, PLAN.md, README.md; two e2e helper files deleted: created.ts,
  global-teardown.ts, replaced by global-setup.ts and session.ts) and docs/backend-requests.md. No apps/api, no package.json or lockfile change. PASS.
- Greps on added lines: no `any`, `@ts-ignore`, `.only(`, `.skip(`, `fixme`. PASS.
- Setup code read in full (global-setup.ts, session.ts): prefix match only (services by title, teams by name, users by email); users exclude the E2E admin
  by email and by id and the shared PEMBINA by email; order services, teams, users; counts-only output; any non-204 throws a counts/status error; token
  file under `.screens/` (gitignored, verified with check-ignore), mode 0600, atomic rename, removed in teardown, never printed; login counter stores a
  hash and an actor type only. PASS.
- Spec diffs read: removed lines are signature/import changes (`adminToken()` without `request`), the old per-test PEMBINA/MEMBER login now uses the
  shared PEMBINA session (same assertions: nav link count 0, no-access page), `memberItem` lookups replaced by `findInList`, one formatting-only change.
  services PEMBINA test still creates and deletes a service through the UI as a real PEMBINA; the MEMBER part still asserts no menu item and no-access.
  New tests: delete (confirm, cancel, gone after reload) for users, teams, services; own row has no delete button; dialog axe/overflow at all widths.
  No test deleted or skipped. PASS.
- `npm run check -w @echo/web`: pass, 20 files, 302 tests (was 287).
- Two FULL `npm run e2e -w @echo/web` runs by me, back to back (after B's own two): run A 90 passed in 6.7 min, cleanup `services 27, teams 40, users 90
  deleted` (counts > 0 for every type the previous run created); run B 90 passed in 6.5 min, same counts. Second run is not slower (6.5 vs 6.7 min). B's
  runs: 6.6 min (fresh DB, setup `0/0/0`) then 7.1 min (setup 27/40/90).
- Login calls per run (same every run): 43 = admin 1, shared PEMBINA 1, test users 41 across 39 accounts, max 2 per account.
- Not satisfiable as written: "passes with the backend's default LOGIN_RATE_LIMIT of 5" cannot be run (dev backend is 1000, I cannot restart it). The
  design evidence is the per-account maximum of 2 and the admin at 1; recorded for the user (D-022).
- Screenshots viewed (2 of max 6): delete user dialog at 360 (bottom sheet) and delete bidang dialog at 1280. Permanent-deletion copy, entity name, Hapus/Batal
  all visible, no clipping.
- Docs: README (prefix rule, cleanup, shared PEMBINA, login once, token cache), CLAUDE.md data-safety, PLAN.md decisions/status; grep for stale
  `teardown`/`created.ts`/"deactivate on exit"/"teams cannot be removed" finds none. docs/backend-requests.md gained two low-priority requests. PASS.
- Result: T2 verified. Committing as feat(web). B noted `ListCard.inlineAction` is now unused in production code (left to avoid deleting its test).
- (superseded) Status: T1 not committed. Waiting for the user's decision on routes.spec:225 (delete, or convert to login-page widths/axe) before the web
  e2e can be green and T1 plus the chore can be committed. B sessions so far this run: T1 B (3 rounds), web-e2e B (2 rounds). State: branch public-site-build, HEAD a8f0451, unstaged T1 changes (apps/api, docs/api,
  PUBLIC_PLAN.md) + .orchestrator, nothing staged. echo_dev already has the new migration.

## T2 committed (75b13a9). B1: preflight reset, plan, implementation, verification
- Per the user's new rule I ran `npm run db:reset -w @echo/api` at the start of B1 (before creating B): "Reset done", "Seed done", health 200.
- B-B1 (model: sonnet): plan, then implement (1 agent, 2 rounds, 0 fix rounds besides B's own test fix). Decisions D-023.
- Scope: apps/api (3 new feature folders, new migration 1794242787286-AddPublicSubmissions.ts, app.module.ts, entities.ts, PLAN.md, 4 new test
  files) and docs/api. No package.json/lockfile change, no apps/web change, no existing test file changed (all test changes are new files). PASS.
- Greps: no `any`, `@ts-ignore`, `.only`, `.skip` in the new files (one comment contains the words "any real value"). PASS.
- Code read: DTOs (consent `@Equals(true)`, conditional contact via ValidateIf, content 1-2000, bidangIds max 20 uuids, website declared), services (honeypot
  returns `{ok:true}` without storing; transaction; unknown bidang id fails the FK, rolls back, plain 400), controllers (`@Public()`, `ThrottlerGuard` +
  `@Throttle` 5/600000 only on the two POSTs, none on GET /public/bidang), PublicBidangController (explicit `{id,name}`), migration SQL (only the 3 new tables,
  2 enums, 4 FKs: handled_by SET NULL x2, join CASCADE x2; down() reverses). PASS.
- `npm run lint` clean; `npm test` 8/8; `npm run test:e2e` 298/298 (was 258, +40 new). B ran `migration:run` for echo_dev.
- Test selection: B1 edits `app.module.ts` (new tables/routes only, but the row names app.module), so I also ran the web e2e: `npm run e2e -w @echo/web`
  90 passed in 5.7 min, login calls 43 (admin 1, pembina 1, max 2 per account); cleanup 0/0/0 (fresh DB).
- Acceptance: 201 + stored row (minimal, full, trimmed, lowercase email, deduped bidang); 400 missing/non-true consent; 400 missing contact with
  follow-up; 400 too-long content and fields (boundaries pass); 400 unknown/malformed bidang ids, nothing stored; honeypot 201 stores nothing (valid-first);
  6th request 429 per endpoint (honeypot and 400s count; GET bidang, login, health unaffected); GET /public/bidang only id+name, ordered; protected routes
  still 401; user delete keeps submissions with handled_by NULL (T1 re-check done early, B2 re-checks with the admin endpoints); team delete not blocked.
  PASS. I did not re-run each of these tests individually; they are inside the 298 passing.
- Docs: docs/api/public.md (new), README (index, 35 routes, protected-routes line, 429 row), permissions.md rows 25-27, users.md, teams.md, flows.md section 6,
  apps/api/PLAN.md (data model, API, FK row, decision row, out-of-scope). PASS.
- Known risk (documented in public.md): `req.ip` with no trust proxy, so behind the POC tunnel all visitors share one bucket of 5 per endpoint per 10 min.
  Heads-up for F4/F5/P2 recorded in D-023: real-backend e2e cannot reset the in-memory limiter.
- Result: B1 verified, committing as feat(api).

## B1 committed (48f5be7). B2: preflight reset, plan, implementation, verification
- `npm run db:reset -w @echo/api` at the start of B2 (before creating B): "Reset done", "Seed done".
- B-B2 (model: sonnet): plan, then implement (1 agent, 2 rounds, 0 fix rounds). Decisions D-024.
- Scope: apps/api (new admin-submissions module, admin controllers/services/DTOs in the two existing modules, module registrations, PLAN.md, 5 new test files)
  and docs/api. No migration, package.json, lockfile, apps/web or existing-test change. PASS.
- Greps: no `any`, `@ts-ignore`, `.only`, `.skip` in the new files. PASS.
- Code read (admin-submission.ts, both admin services, controllers, DTOs, counts service): table/enum/column names from a fixed whitelist, all values bound
  parameters, PATCH = one `WITH ... UPDATE ... RETURNING` joined to handler name (and sorted bidang names), DELETE = `DELETE ... RETURNING` with 404, empty PATCH 400,
  null/blank note clears, `@Roles(ADMIN, PEMBINA)` on all three controllers (leaders and members 403). PASS.
- `npm run lint` clean; `npm test` 8/8; `npm run test:e2e` 387/387 (was 298, +89 new). B's `migration:run`: "No migrations are pending" (dev DB already had the tables
  after the reset).
- Test selection: B2 edits `app.module.ts` (new routes only), so I also ran the web e2e: 90 passed in 6.7 min, login calls 43, max 2 per account.
- Acceptance (all inside the 387): all 7 routes: no token 401, MEMBER 403, team leader 403, PEMBINA and ADMIN ok; status filter and invalid/empty/repeated status 400;
  PATCH sets handledBy/handledAt (both types), updates adminNote on both types, invalid status 400, empty body 400, unknown id 404 on PATCH and DELETE; DELETE 204,
  row gone, no longer listed, second delete 404; volunteer delete removes join rows (teams untouched); counts after create/status change/delete; deleting a handler
  user (PEMBINA, via DELETE /users/:id) keeps the submission with handledBy null (T1 re-check done); public routes never expose adminNote. PASS. I did not run the
  tests individually.
- Docs: admin-submissions.md (new), README (index, 42 routes, enums), permissions.md rows 28-34 + count, public.md pointer, users.md sentence, apps/api/PLAN.md. PASS.
- Known risk: if the acting user is deleted mid-PATCH the UPDATE hits a FK error (500); B left it unhandled (extremely unlikely).
- Result: B2 verified, committing as feat(api).

## B2 committed (be4722a). F1: preflight reset, plan, implementation, verification
- `npm run db:reset -w @echo/api` at the start of F1 (before creating B): "Reset done", "Seed done".
- B-F1 (model: sonnet): plan, then implement (1 agent, 2 rounds, 0 fix rounds). Decisions D-025.
- Scope: apps/public (new, 69 files) and package-lock.json only. `git status` outside apps/public: only .orchestrator and package-lock.json. No root file, apps/web or
  apps/api change. PASS.
- Lockfile diff read: 50 insertions, 0 deletions: the `apps/public` package entry and the `node_modules/@echo/public` link; no other package version changed. B ran
  `npm install` once at the root ("added 1 package"). PASS.
- Dependencies: apps/public/package.json read: same ranges as apps/web, minus `sonner`; no `react-router-dom`; nothing outside the approved list. PASS.
- Greps in src, e2e and configs: no `any`, `@ts-ignore`, `.only`, `.skip`, localStorage, sessionStorage, document.cookie, or imports from apps/web. PASS.
- Setup code read in full (e2e/global-setup.ts, e2e/session.ts): one admin login, lists both admin endpoints, matches `name` / `fullName` startsWith `e2e-` only (null never
  matches), strict 204, counts-only output, errors carry status only, token file mode 0600 + atomic rename, removed at teardown (verified: absent after my run). PASS.
- Test selection: root package-lock.json changed, so `npm run check` in every app (no e2e for api/web) plus the apps/public e2e (public row):
  - `npm run check -w @echo/public`: pass, 12 files, 43 tests.
  - `npm run check -w @echo/web`: pass, 302 tests. `npm run lint -w @echo/api` clean, `npm test -w @echo/api` 8/8.
  - `npm run e2e -w @echo/public` (mine): 15 passed in 14.6 s, cleanup `prayer requests 0, volunteer applications 0 deleted`, `login calls: 1 (admin 1)`.
  - B's cleanup proof (B's claim; I did not repeat it, to protect the 5-per-10-min public rate limit): after one curl POST to each public endpoint with an `e2e-` name, run 1
    printed 1 and 1 deleted (15 passed, 16.0 s); run 2 printed 0 and 0 (15 passed, 15.0 s).
- Acceptance: `npm run check` passes (above). Smoke at 360px via the burger menu (sheet opens, Doa -> /doa, CTA -> /relawan, Kegiatan scrolls), footer link href ends with
  `/volunteer-portal/` (exact override semantics in a unit test), README covers install/dev/env/tests/content/logo (not re-read line by line: B wrote it, and the
  `.env.example` sync is enforced by a unit test), `.env.example` lists `VITE_PORTAL_URL` (the only VITE_* read) with placeholders, global setup cleanup as T2. PASS.
- Screenshots viewed (3 of max 6): home at 360 and 1280, /doa at 360. Layout clean, no overflow, header/burger/footer/portal link present, placeholders obvious, no stock images.
  B reported axe serious/critical clean and no console errors on `/`, `/doa`, `/relawan`, 404 at 360/768/1280 (inside the passing responsive spec).
- Not done by design (D-025): root package.json scripts, README, CLAUDE.md, docs/README.md, CI, poc-up.sh. The root CLAUDE.md still names only apps/api and apps/web (I may not
  edit it). Listed for the final report.
- Result: F1 verified, committing as feat(public).
