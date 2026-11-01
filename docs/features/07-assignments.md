# Feature 7: Assignments (candidates, assign, unassign)

This is the feature the whole plan exists for. Domain rules 2 to 7 live here.

## Access (all three routes)
- Allowed: ADMIN, or a user with `is_leader = true` for the team in the path (`:teamId`).
- A leader of a different team: 403. A plain member of the team: 403. PEMBINA: 403
  (PEMBINA can never be a team leader).
  No token: 401. Leader status is read from the DB on every request.
- ADMIN may act as any team.
- Unknown team: 404 for ADMIN, 403 for everyone else (no existence leak).
- Unknown or soft-deleted service: 404. `:id`, `:teamId`, `:userId` must be UUIDs (400).
- Check order: 401, then 403, then 404, then 400/409.

## GET /services/:id/teams/:teamId/candidates
- 200, ordered by name, each item `{ userId, name, assigned }`.
- Includes active members of the team. Excludes inactive users.
- Excludes anyone assigned in this service by a DIFFERENT team.
- Includes anyone already assigned by THIS team, with `assigned: true` (all others false).
- Works for past services too (read only).

## POST /services/:id/teams/:teamId/assignments
- Body `{ userIds: [...] }`: an array of 1 to 100 UUIDs. Duplicates are removed silently.
  Empty, non-array, or non-UUID entries: 400.
- A past service (`starts_at <= now`): 409 with code `SERVICE_ALREADY_STARTED`.
- If any id is not an active member of the path team: 400 with code `INVALID_USERS`
  listing the offending ids, and NOTHING is inserted.
- Otherwise a single statement per request:
  `INSERT ... ON CONFLICT (service_id, user_id) DO NOTHING RETURNING *`.
  The code must not SELECT first to decide a conflict (rule 3).
- Response is always 200, even when every user was skipped:
  `{ assigned: [userId, ...], skipped: [{ userId, reason }] }`.
- Each inserted row has `team_id` = path team and `assigned_by` = the caller.
- For each skipped user, look up the existing row and set `reason` to
  `ALREADY_ASSIGNED_THIS_TEAM` or `ALREADY_ASSIGNED_OTHER_TEAM`.
- For `ALREADY_ASSIGNED_OTHER_TEAM`: the skipped entry also includes
  `heldByTeam: { id, name }` for every caller (ADMIN and leaders alike). Test it for a
  leader and for ADMIN. `ALREADY_ASSIGNED_THIS_TEAM` entries have no `heldByTeam`.
- Partial success: `[free user, user held by another team]` inserts the free one and
  skips the other.
- Re-assigning someone this team already assigned leaves the row count unchanged and
  reports `ALREADY_ASSIGNED_THIS_TEAM`.

## DELETE /services/:id/teams/:teamId/assignments/:userId
- 204 and the row is deleted. 404 if THIS team has no assignment for that user. That
  includes the case where another team holds them; the 404 body names no team. To remove
  another team's assignment, ADMIN uses the holding team's id (from `heldByTeam`) in the path.
- A past service: 409 `SERVICE_ALREADY_STARTED`.
- Works for deactivated users, so a leader can clean up their schedule.
- After unassigning, the user appears again in the candidates of every team they belong
  to, and another team can now claim them.

## The concurrency test (mandatory)
- Fixture: user X is an active member of teams A and B; one future service.
- Fire two assign requests with `Promise.all`, one as leader of A and one as leader of B,
  both for X.
- Expect exactly ONE assignment row for (service, X), in either order; one response lists
  X in `assigned`, the other lists X in `skipped` with `ALREADY_ASSIGNED_OTHER_TEAM`; the
  row's `team_id` matches the winner.
- Repeat in a loop of at least 20 iterations, cleaning between iterations, so a flaky
  check-then-insert cannot pass by luck.
- Real PostgreSQL, real parallel requests, no mocks.

## The user verifies by hand (not the agent)
- Sabotage check: temporarily drop the unique constraint (or turn the insert into
  check-then-insert). The concurrency test must FAIL. Restore it afterward.
- Read the diff: the assign path has no SELECT before the INSERT that decides conflicts.

## Other tests that must exist
- Every route: 401, and 403 for a leader of another team, a plain member, and PEMBINA.
- Candidate flow: X is in A and B. After A assigns X, B's candidates exclude X; A's show
  X with `assigned: true`.
- A leader cannot assign a volunteer who is not in their team (400, nothing inserted).
- A deleted service is 404 on all three routes. A past service blocks assign and unassign
  but not the candidate list.
- An inactive member is absent from candidates and rejected by assign, but can still be
  unassigned.
- Every `:id`, `:teamId`, `:userId` that is not a UUID: 400. Check order: a request that
  is both forbidden and malformed gets 403; unknown team gives 404 for ADMIN, 403 for others.
- Candidates: ordered by name; excludes inactive users and users held by another team;
  includes this team's assigned users with `assigned: true`; works on a past service.
- Assign validation: empty array, non-array, non-UUID entry, and 101 ids are 400;
  duplicate ids are removed silently; a non-member or inactive id gives 400 `INVALID_USERS`
  listing the ids and inserts nothing.
- Assign result: response is 200 with `{ assigned, skipped }`; inserted rows have the path
  `team_id` and `assigned_by` = caller; a partial batch inserts the free user and skips
  the held one; re-assigning is idempotent (row count unchanged, `ALREADY_ASSIGNED_THIS_TEAM`).
- `heldByTeam: { id, name }` is present on `ALREADY_ASSIGNED_OTHER_TEAM` for a leader and
  for ADMIN, and absent on `ALREADY_ASSIGNED_THIS_TEAM`.
- Unassign: 204 and the row is gone; 404 when this team has no assignment for the user
  (including when another team holds them); ADMIN removes another team's assignment using
  the holding team's id; a started service gives 409 `SERVICE_ALREADY_STARTED` for assign
  and unassign; after unassigning, the user reappears in candidates and another team can
  claim them.
- The concurrency test above.