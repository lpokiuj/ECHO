# DECISIONS (orchestrator log)

## Feature 2: Design foundation

### D-001 Accent color
- Question: which single accent for the neutral theme (PLAN: Brand, none supplied)?
- Options: (a) deep teal; (b) indigo; (c) wait for brand colors.
- Choice: (a) deep teal, text/background pairs checked for AA (>= 4.5:1). Token-only, swappable.
- Reasoning: no brand given; smaller scope than waiting; reversible. Reversible: yes. Asked by: B.
- Revisit? yes, when brand colors exist.

### D-002 tw-animate-css
- Question: shadcn CLI may add `tw-animate-css`, not on the approved list.
- Options: (a) remove it, hand-write keyframes in index.css; (b) ask to approve; (c) skip animations.
- Choice: (a). Approved dependency list stays unchanged.
- Reasoning: CLAUDE.md forbids unlisted deps; keeps animation. Reversible: yes. Asked by: B.

### D-003 Dev-only "Desain" nav link
- Question: /design is required but not in the screens table; add a nav link?
- Options: (a) link in shell nav, removed in feature 10; (b) URL only.
- Choice: (a), flagged dev-only; feature 10 must remove link and route together.
- Reasoning: required route needs to be reachable for review; trivial to remove. Reversible: yes. Asked by: B.

### D-004 shadcn generation method (feature 2) — supersedes part of D-002
- Question: how to produce shadcn files after the failed `init -d -y`?
- Options: (a) `init --base radix` with flags; (b) hand-write components.json (Radix) then `shadcn add --dry-run`, review, `add` without -y; (c) hand-write all components.
- Choice: (b). Check every dry-run/view for `@base-ui` and Geist; fallback to (c) per component. Reversible: yes. Asked by: B.
- D-002 superseded: user approved `tw-animate-css` and `shadcn` (already on PLAN.md list), so CLI animation classes are kept; no hand-written keyframes needed.

### D-005 Style value, accent hex, token format, pre-auth header
- components.json style: read from CLI `--dry-run`/help; fall back to "new-york" Radix. Verify no Base UI imports. Reversible: yes.
- Accent: primary ~#0f766e (confirmed by contrast test >= 4.5). Hex values allowed in index.css `:root` only (not in src/components, src/features). Reversible: yes.
- Shell header before auth: logo/title + menu button only; user menu arrives in feature 4. Reversible: yes. Asked by: B.

### D-006 Components via `shadcn view`, not `add` (feature 2)
- Question: `add --dry-run` showed it would install unapproved `cn` and `next-themes`.
- Options: (a) accept them; (b) take source via `shadcn view` and write files by hand; (c) abort shadcn.
- Choice: (b), made by B and accepted by me. Approved list unchanged. (`cn@0.2.6` appears only as a transitive dependency of the approved `shadcn` package.) Reversible: yes. Asked by: B (deviation).

### D-007 axe not run with Radix Select open; Desain dev badge (feature 2)
- Open Select state is skipped in axe (aria-hidden-focus false positive from Radix); accepted, axe runs before/after. Revisit in feature 10 hardening. Reversible: yes.
- "dev" badge on Desain link kept until feature 10 (D-003). Reversible: yes. Asked by: B.

## Feature 3: API client and session core

### D-008 401 on change-password
- Question: treat it as wrong password always, or only if token is recent?
- Options: (a) always wrong password (PLAN.md says so); (b) track lastTokenAt; (c) verify via GET /me.
- Choice: (a). Reasoning: PLAN.md already decides it; simplest; a dead session surfaces on the next call. Reversible: yes. Asked by: B.

### D-009 Types scope and ESLint guard
- Types: only what each feature needs, appended to the single `src/api/types.ts`. Reversible: yes.
- SECURITY: add ESLint `no-restricted-globals`/`no-restricted-properties` for localStorage (config only, no dependency). Stricter option chosen. Reversible: yes. Asked by: B.

## Feature 4: Login, forced password change, navigation

### D-010 SECURITY: initial password for admin-created e2e users
- Question: the default password of a created user is the server's DEFAULT_USER_PASSWORD, not knowable from docs.
- Options: (a) new env var `E2E_USER_PASSWORD` (read from process.env only, name in .env.example, never a value); (b) read the API env (forbidden); (c) skip the forced-change e2e (violates criterion).
- Choice: (a). If the variable is missing or wrong, the e2e login fails: that is a HARD STOP for the run (user must set it). Reversible: yes. Asked by: B.

### D-011 Seeded admin must_change_password
- Choice: (b) assume the user already bootstrapped E2E_ADMIN_PASSWORD (user verified it). The fixture does NOT change any seeded user's password. If the admin login or POST /users returns PASSWORD_CHANGE_REQUIRED, fixture fails with a clear message (hard stop). Reversible: yes. Asked by: B.

### D-012 Nav before screens exist
- Choice: (a) `buildNavItems(me)` holds every role rule; each item has a `routeExists` flag, flipped on by the feature that adds the route. Only existing routes render. No "coming soon" screens (not in PLAN). Reversible: yes. Asked by: B.

### D-013 SECURITY: Playwright traces
- Choice: stricter than proposed: set `trace: 'off'` in playwright.config.ts for all specs (fixtures send passwords/tokens). No video. Screenshots must not reveal a password field. Reversible: yes. Asked by: B.

### D-014 Home and "3360px" typo
- Home = existing placeholder with greeting, name and role badge from /me; no new screen. CLAUDE.md "3360px" is read as 360px (PLAN says 360). Reversible: yes. Asked by: B.

### D-015 Button hover and UserMenu compact (feature 4)
- Default Button hover changed from `bg-primary/80` to `brightness-90` (axe contrast failure on hover); UserMenu gets a `compact` prop (avatar only below 640px) and no aria-label (label-content-name-mismatch). Reversible: yes. Asked by: B; accepted by orchestrator (small, needed for axe).

### D-016 axe skipped with account menu open
- Same Radix `aria-hidden-focus` false positive as D-007; axe runs before and after. Revisit in feature 10. Reversible: yes. Asked by: B.

## Feature 5: Schedules

### D-017 e2e fixtures assign as ADMIN (SECURITY-adjacent)
- Question: how do fixtures get a leader token to assign people (forced password change blocks new users)?
- Options: (a) fixture changes the new user's password; (b) ADMIN assigns (assignments.md: ADMIN any team); (c) skip.
- Choice: (b). No extra credential handling. Teams/members/leaders are created via API as admin with e2e- names. Reversible: yes. Asked by: B.

### D-018 No "Anda" badge on Full schedule
- Choice: omit (not in PLAN, beyond the quality bar). Reversible: yes. Asked by: B.

### D-019 Includepast toggle uses shadcn Switch
- Choice: Radix Switch via `shadcn view` source, imported from the already-installed `radix-ui` umbrella package. No new package. If that is not possible without a new package, stop and ask. Reversible: yes. Asked by: B.

### D-020 Past-service criterion covered by MSW only
- Question: the API rejects past startsAt on create and edit, so a real ended service can't be made.
- Choice: unit test with MSW for "ended hidden by default / shown with includePast"; Playwright checks only that the toggle sends includePast=true and the fixture stays visible. Listed in FINAL_REPORT "mock-only criteria". Reversible: yes. Asked by: B.
- '/' stays the placeholder home (D-014).

### D-021 Schedule hooks: retry false, placeholderData (feature 5)
- Query hooks use `retry: false` (as useMe) so error + Retry shows at once; `placeholderData: keepPreviousData` avoids a skeleton flash on toggle. Reversible: yes. Asked by: B (deviation), accepted.

### D-022 dates.ts imports messages with a relative path
- The `@/` alias does not typecheck when an e2e spec imports the module. "WIB" label lives in `messages.dates.wib`. Reversible: yes. Asked by: B.

## Feature 6: Services management

### D-023 Native date/time inputs
- Options: (a) native type=date/time; (b) shadcn Calendar (needs react-day-picker + date-fns, not approved). Choice: (a). Reversible: yes. Asked by: B.

### D-024 e2e PEMBINA user created via admin API
- Options: (a) create an `e2e-` PEMBINA via POST /users and use the same forced-change login flow as existing fixtures (E2E_USER_PASSWORD, D-010); (b) skip PEMBINA e2e. Choice: (a). No seeded user is touched; the new password is generated at runtime, kept in memory, never logged. Missing/failed login = hard stop as before. Reversible: yes. Asked by: B.

### D-025 Editing a started service
- Choice: allowed with startsAt disabled and a hint (matches services.md). Edit PATCH sends only changed fields. Reversible: yes. Asked by: B.

### D-026 Services page naming and layout (feature 6)
- Nav "Kegiatan", heading "Kelola Kegiatan"; `RequireRole` guard shows a no-access page for other roles; list hides ended services by default (include-past toggle); 404 on edit/delete = "already gone" toast + refetch; form is a dialog (bottom-aligned below 640px). The 44px field check is skipped at 1280px (Button/Input are 40px from 1024px). Reversible: yes. Asked by: B, accepted.

## Feature 7: Leader assign screen

### D-027 Assign screen is for leaders only
- Options: (a) leaders only (PLAN table); (b) ADMIN too (needs GET /teams + unplanned scope); (c) later. Choice: (a). ADMIN typing /assign sees the no-access page. Reversible: yes. Asked by: B.

### D-028 Checkbox via shadcn view, radix-ui umbrella
- Choice: write src/components/ui/checkbox.tsx from `shadcn view checkbox`, imports from the installed `radix-ui` package. No new package. Reversible: yes. Asked by: B.

### D-029 Started-service Playwright check mocks GET /services time
- The API can't create a past service. Choice: MSW unit test plus a Playwright check that mocks only the GET /services start time (POST stays real). Listed in FINAL_REPORT as partly mock-only. Reversible: yes. Asked by: B.

### D-030 SECURITY: service/team ids in URL search params
- Only non-secret uuids (never token/email/name). Choice: allowed. Reversible: yes. Asked by: B.

### D-031 Assign screen details (feature 7)
- `/assign?service=&team=` holds uuids only; unknown values fall back to the first service/team. Service list is `GET /services` without past, started-but-not-ended services shown with "(Sudah dimulai)". `fillMessage()` helper fills `{placeholder}` templates in messages.ts. Started notice is a token-styled `role="note"` div (no Alert component). Reversible: yes. Asked by: B.

### D-032 services.spec timeout raised (fix round 1)
- `services screens at Npx` runs axe 5 times over a list that grows with leftover e2e- services (138 at the time); timeout raised to 180s. No assertion changed. Leftover growth (~9 services per run) should be revisited in feature 10. Revisit? yes. Reversible: yes. Asked by: B (DR-A).

## Feature 8: Admin users

### D-033 No search/filter on the users list
- Options: (a) search + role filter; (b) search only; (c) none (not in PLAN; never add scope). Choice: (c). Specs find their own row with a text filter on the rendered list (Playwright doesn't need scrolling); extended timeouts where axe runs on a long list (see D-032). Reversible: yes. Asked by: B.

### D-034 Plain-string 400s on user PATCH
- The two 400s (self role/active change, leader can't be PEMBINA) have no field name or code. Options: (a) shape-based single combined Indonesian sentence; (b) parse backend English text (rejected: raw text); (c) pre-check only. Choice: (a)+(c): self controls disabled client-side; a 400 with no fieldErrors on a PATCH carrying role/isActive shows one combined sentence. 409 on POST/PATCH maps to the email field. BACKEND_REQUESTS.md gets an item asking for error codes. Reversible: yes. Asked by: B.

### D-035 Confirm dialog before deactivating a user
- Deactivation ends the user's sessions at once (users.md). Quality bar: destructive actions use a confirm dialog naming what will change. Choice: ConfirmDialog when saving an edit that sets active to false. Reversible: yes. Asked by: B.

### D-036 Users page details (feature 8)
- One dialog serves create and edit; the deactivate confirm is part of the edit flow; list refetch after a mutation runs in the background. Reversible: yes. Asked by: B.

### D-037 Destructive Button hover /20 -> /15
- axe measured 4.34:1 on hover in the confirm dialog; same kind of fix as D-015. Reversible: yes. Asked by: B.

### D-038 Reduced axe scope on the users list (revisit in feature 10)
- echo_dev holds ~500 leftover e2e- users, which makes full-page axe too slow. `users screens at Npx` runs axe on the first 10 rows/cards only (rows share one markup) and on dialogs scoped to the dialog; timeouts raised (90s/180s). Revisit? YES: coverage is narrower than "axe on every route"; feature 10 should run full-page axe on a smaller list or via a lighter check. Reversible: yes. Asked by: B, accepted by orchestrator.
