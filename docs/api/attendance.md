# Attendance (absent-taker and miss counter)

For each service, each team leader (or ADMIN) designates ONE volunteer assigned by that team as the
**absent-taker**. After the service has started, the taker (or ADMIN) records which of the team's
volunteers did not attend. A member's miss count is **derived**: the number of recorded absence
rows. Only recorded absences count; if the taker never submits, nothing is counted.

| Route | Who | Result |
|---|---|---|
| `PUT /services/:id/teams/:teamId/absent-taker` body `{"userId"}` | leader of `:teamId`, ADMIN | 204 |
| `PUT /services/:id/teams/:teamId/absences/:userId` | that team's absent-taker, ADMIN | 204, idempotent |
| `DELETE /services/:id/teams/:teamId/absences/:userId` | same | 204, idempotent |
| `GET /me/absences` | any logged-in user | 200 `{count, items}` |
| `GET /teams/:teamId/absences` | leader of `:teamId`, PEMBINA, ADMIN | 200 array |
| `GET /teams/:teamId/absences/:userId` | leader of `:teamId`, PEMBINA, ADMIN | 200 `{count, items}` |

## PUT .../absent-taker
Designates `userId` and, in one transaction, clears the previous taker of that team for the
service. Allowed before or after the service starts. The target must be assigned to the service
**by that team**, else `400 INVALID_USERS` (with `invalidUserIds`) and the old taker stays.
Concurrent designations are serialized: there is never more than one taker per team and service
(also guaranteed by a partial unique index).

## PUT / DELETE .../absences/:userId
- Caller must be the designated taker of `:teamId` for this service, or ADMIN (so a past service
  with no taker can still be recorded by ADMIN). Anyone else (including the leader, if not the
  taker) gets 403.
- The service must have started: `409 SERVICE_NOT_STARTED` before `startsAt`.
- The target must be assigned by that team: otherwise `400 INVALID_USERS`.
- `400 CANNOT_MARK_SELF` when PUT targets the caller.
- PUT of an existing absence and DELETE of a missing one are 204.

| Status | Condition |
|---|---|
| 400 | Malformed id or body; `INVALID_USERS`; `CANNOT_MARK_SELF` |
| 401 | |
| 403 | Not the leader (designation) / not the taker nor ADMIN (absences). Non-admin on an unknown team is 403 |
| 404 | Unknown or soft-deleted service; unknown team (ADMIN) |
| 409 | `SERVICE_NOT_STARTED` |

Check order: 401, malformed uuid 400 (pipes), 403, 404, `CANNOT_MARK_SELF` 400, 409, then
`INVALID_USERS` 400 (decided by the database write).

## GET /me/absences
```json
{"count":2,"items":[{"serviceId":"...","title":"Sunday Service","startsAt":"2026-11-01T03:00:00.000Z"}]}
```
Newest service first. Soft-deleted services **still count**.

## GET /teams/:teamId/absences
```json
[{"userId":"...","name":"Amy","count":1},{"userId":"...","name":"Bob","count":0}]
```
Active members of the team ordered by name, with their lifetime miss count across **all** teams.
404 `Team not found` for ADMIN on an unknown team; 403 for any non-leader.

## GET /teams/:teamId/absences/:userId
Same shape and order as `GET /me/absences`, for one active member of the team (absences from
**all** teams, soft-deleted services included). 404 `Team not found` (ADMIN, unknown team) or
`Member not found` (not an active member of that team); 403 for any non-leader.

## Other effects
- `GET /services` assignments carry `isAbsentTaker: boolean`.
- `DELETE .../assignments/:userId` and `DELETE /teams/:id/members/:userId` answer
  `409 HAS_ATTENDANCE_RECORDS` if a recorded absence points at the assignment (normally only
  reachable after a started service is moved back into the future). Nothing is removed.
- Unassigning a taker (only possible before the service starts) clears the role.
