# FINAL REPORT: Echo web-auto build

Branch `web-auto-build`. All 10 features are committed. Last checks: `npm run check` 18 files / 214 tests pass; `npm run e2e` 80 passed (7.9m) against echo_dev.

## 1. Features and commits

| # | Feature | Commit |
|---|---|---|
| 1 | Scaffold | 7a302f3 |
| 2 | Design foundation | 1d9fed8 |
| 3 | API client and session core | 9935d60 |
| 4 | Login, password change, navigation | 500d88f |
| 5 | Schedules | 3bbb531 |
| 6 | Services management | a453ac4 |
| 7 | Leader assign screen | c1e3e03 |
| 8 | Admin users | 4149467 |
| 9 | Admin teams and membership | decb6b1 |
| 10 | Hardening | a1ceb6b |

(`5942455 Docs adjustment` is a docs commit from before this run.)

## 2. Decisions

The full list (D-001 to D-053, with options, reasoning and reversibility) is in `DECISIONS.md`, grouped by feature. The ones to read first:

**SECURITY**
- D-010: initial password for admin-created e2e users.
- D-013: Playwright traces.
- D-017: e2e fixtures assign as ADMIN (security-adjacent).
- D-030: service and team ids go in URL search params (ids only, no token).
- Feature 3: an ESLint rule forbids `localStorage` (see the SECURITY note near D-009).

**Reversible and risky: revisit?**
- D-001 accent color: revisit when brand colors exist.
- D-023 native date/time inputs. D-048 replaced the time input with an "HH:mm" text field, which is less comfortable on phones: revisit.
- D-020 and D-029: some criteria are covered by mocks only (see section 5).
- D-033 no search or filter on the users list.
- D-041 add-member picker shows the first 50 matches only.
- D-047 and D-051 home page `/` is only a welcome line with two links.
- D-053 focus return was fixed for `ConfirmDialog` only. The users, teams and services form dialogs may have the same gap: revisit.
- D-007 and D-016: axe is not run with an open Radix Select or account menu (Radix false positive).
- D-043 and D-045: timeouts were raised, then tightened after the DB reset.

## 3. Edits to PLAN.md and CLAUDE.md

- PLAN.md: Status ticks for features 2 to 10 (done as each passed).
- PLAN.md: the "Notes for later features" line about `/design` and the Desain link now says they were removed in feature 10.
- PLAN.md: a shadcn style row (Radix, not Base UI) exists in the decisions table; I did not verify who added it. Check `git log -p PLAN.md`.
- CLAUDE.md: no edits by me.
- No acceptance criteria, Data safety rules or dependency list were changed.

## 4. BACKEND_REQUESTS.md

- `PATCH /users/:id` 400s (changing your own role or active status, and making a team leader PEMBINA) have no error `code`. Low priority.
- `PUT /teams/:id/members/:userId` 400s, `POST/PATCH /teams` 409 duplicate name, and the roster rows have no `code`, field name or per-member `role`. Low priority.

## 5. Criteria covered only by mocks

- The "past services hidden by default" part of the schedule criterion is covered by MSW (D-020).
- The "started service" check mocks `GET /services` time in Playwright (D-029).
- Open-Select and account-menu axe states are not scanned (D-007, D-016).
- The assign race (two leaders assigning the same person) is covered by an API-level spec and unit tests, not by two real browsers.
- Console-error filtering on no-access pages allows the browser's 403/404 resource message. It was unused in the last runs (D-050).

## 6. What I was unsure of, and what to check by hand

- **Assign screen with two leaders assigning the same person:** the loser gets a partial result. Please try it with two real sessions and read the wording.
- **Indonesian wording in `src/lib/messages.ts`:** everything was written by the agent. Have a native speaker read it, especially error messages, the delete-assignment warning, and the home welcome line.
- **Every screen on a real phone.** Emulated widths passed (360, 390, 768, 1280), including no horizontal scroll, axe, and 44px targets below 1024px. The "HH:mm" time input and the dialogs are worth touching by hand.
- Form dialogs (users, teams, services) may not return focus to the opener after closing (D-053).
- No-access pages use an h2 title and no h1. axe does not flag it.
- Dead-code audit was limited to `/design` and its messages. A full unused-export sweep was not done. Empty, error and loading state tests were not added beyond existing ones.
- Home page `/` is still a thin placeholder.
- echo_dev still holds leftover `e2e-` users and teams from earlier runs. The new teardown removes services and users created by a run (not teams or UI-created users). After any DB reset, the seeded admin must redo the forced password change or every e2e fixture fails with 403.

## 7. Sessions and fix rounds

- B sessions: 14 of 40 allowed.
- Fix rounds: feature 7: 1. Feature 9: 2 (before the reset) plus a re-run on clean data. Feature 10: 2. Features 5, 6 and 8: 0. Features 2 to 4 were done in earlier sessions; see `RUN_LOG.md`.
- Hard stops: one (admin password change needed after the echo_dev reset), resolved by you.
- Permission event: B mistakenly `git rm`'d `e2e/responsive.spec.ts`. Its `git reset` attempt was denied and it did not work around it. I restored the file with `git restore` on that one path.
