# Feature 8: Schedule views

Read-only endpoints. No writes. Rule 12 applies: while `must_change_password` is true,
these routes return 403 (only `change-password` and `GET /me` are exempt).

The service schedule is open: every logged-in user sees every service and who serves in
every team. The team roster (`GET /teams/:id/members`) is ADMIN only.

## Shared rules
- Soft-deleted services never appear.
- Ordered by `startsAt` ascending, then `title`.
- Default: only services that have not ended (`ends_at > now`). `?includePast=true`
  returns all. Anything other than `true` or `false` is 400.
- No pagination (v1).
- Deactivated users' assignments remain visible.
- Schedule responses never contain emails, password hashes, or `isActive`.
- Service notes are a future plan: no `notes` field exists in v1.

## GET /services
- Any logged-in user. No token: 401.
- The response is identical for every role (ADMIN, PEMBINA, team leader, plain MEMBER).
- Each item:
  `{ id, title, startsAt, endsAt, assignments: [{ userId, name, teamId, teamName }] }`.
- `assignments` covers all teams, ordered by `teamName`, then `name`.
- A service with no assignments appears with `assignments: []`.

## GET /me/schedule
- Any logged-in user. No token: 401.
- The caller's own assignments only:
  `[{ serviceId, title, startsAt, endsAt, teamId, teamName }]`.
- A volunteer in several teams sees every service they're assigned to, each once.
- Never includes another user's data (test with two users assigned to the same service).

## GET /teams/:id/members
- Used by the future admin team-management page. ADMIN only. PEMBINA, MEMBER, and team
  leaders (including the leader of that very team): 403. No token: 401.
- Unknown team: 404. `:id` must be a UUID (400).
- 200, ordered by name: `[{ userId, name, email, isLeader, isActive }]`. Includes
  inactive members (with `isActive: false`).
- Shows no information about the member's other teams.

## Tests that must exist
- `/services`: the same data requested as ADMIN, PEMBINA, a leader, and a plain MEMBER
  returns deep-equal bodies. A plain MEMBER gets 200, not 403.
- `/services`: assignments from every team appear; ordering; empty `assignments`; deleted
  services hidden; past services excluded by default and included with `includePast=true`.
- `/services`: the serialized JSON contains no fixture user's email and no
  `passwordHash`, `email`, or `isActive` keys.
- `/me/schedule`: only own rows; deleted services hidden; `includePast` behavior.
- `/teams/:id/members`: 401 without a token; 403 for PEMBINA, MEMBER, and a leader of that
  very team; 404 for an unknown team; ADMIN sees inactive members and the `isLeader` flag.