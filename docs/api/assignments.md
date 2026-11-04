# Assignments (leader screen)

A team leader assigns members of their team to a service. Conventions: [README.md](README.md).
Screen flow: [flows.md](flows.md).

## Who may call (all four routes)
- **ADMIN**: any team.
- **Leader of `:teamId`**: a user with `isLeader: true` on that team, read from the database on
  every request (no stale token problem).
- Everyone else, **403** `{"message":"Forbidden","statusCode":403}`: plain member of that team,
  leader of a *different* team, PEMBINA, MEMBER, and any non-admin when `:teamId` is unknown or not
  a UUID (the server does not reveal which teams exist).
- No token: 401. `mustChangePassword`: `PASSWORD_CHANGE_REQUIRED` first.

## Order in which errors are produced
1. 401 (token) -> 403 `PASSWORD_CHANGE_REQUIRED` -> 403 (not admin/leader)
2. 400 malformed path uuid (`:id`, `:userId`; `:teamId` too for ADMIN) and 400 body validation
   (assign). These come **before** 404: an invalid body on an unknown service is 400, not 404.
3. 404 `Service not found` (unknown or soft-deleted), then 404 `Team not found` (ADMIN only)
4. 409 `SERVICE_ALREADY_STARTED` (assign/unassign only) **before** 400 `INVALID_USERS`
5. 400 `INVALID_USERS`, then the insert/delete

Path params for all three: `id` = service uuid, `teamId` = team uuid (and `userId` for unassign).

## GET /services/:id/teams/:teamId/candidates
Who can still be assigned by this team for this service.

Contains **active** members of the team, minus anyone already assigned in this service by a
*different* team. People already assigned by this team are included with `assigned: true`.
Works for started/past services too (read only). Ordered by name.

**200**
```json
[{"userId":"aafeafcb-ef7f-4b60-bbcf-70d762f8ff28","name":"Enji","assigned":true,"unavailable":false},
 {"userId":"db93ae8c-9da7-4be1-bcc8-2c72c12033da","name":"Giana","assigned":false,"unavailable":false},
 {"userId":"f269b9ce-a215-46c8-a444-0aaced5232f9","name":"Livana","assigned":false,"unavailable":false},
 {"userId":"73fbd314-9793-4bf3-b217-4ab94b7be54f","name":"Lukas","assigned":false,"unavailable":false}]
```

| Field | Type | |
|---|---|---|
| `userId` | uuid | |
| `name` | string | no email |
| `assigned` | boolean | already assigned by **this** team |
| `unavailable` | boolean | the member marked this service unavailable; show but do not allow selecting. Assigning them is skipped with `UNAVAILABLE` |

Errors: 400 (bad `:id`), 401, 403, `404 {"message":"Service not found",...}`, `404 {"message":"Team not found",...}` (ADMIN only).

## POST /services/:id/teams/:teamId/assignments
Assign several members in one request. **Always `200` when the request is valid**, even if every
user was skipped; inspect the body.

| Body field | Type | Required | Rules |
|---|---|---|---|
| `userIds` | uuid[] | yes | 1 to 100 entries, each a UUID. Duplicates are removed silently |
| `notes` | `{ [userId]: string }` | no | Per-user note stored on the new assignment. Keys must be UUIDs listed in `userIds`; values are strings of at most 1000 characters (`""` allowed). Users without an entry get `""`. `null`, arrays, non-string values: 400. Never overwrites the note of someone already assigned (they are skipped) |

Request:
```json
{"userIds":["be218193-9844-482b-b44d-575c49d2e16f","cdcac924-5fa6-45c0-9a0e-3b84845ca1e5"]}
```

**200 response**

| Field | Type | |
|---|---|---|
| `assigned` | uuid[] | users newly assigned by this call |
| `skipped` | array | users not assigned |
| `skipped[].userId` | uuid | |
| `skipped[].reason` | `ALREADY_ASSIGNED_THIS_TEAM` \| `ALREADY_ASSIGNED_OTHER_TEAM` | |
| `skipped[].heldByTeam` | `{id, name}` | **only** with `ALREADY_ASSIGNED_OTHER_TEAM`; present for leaders and ADMIN alike |

Examples (all real):

All assigned:
```json
{"assigned":["be218193-9844-482b-b44d-575c49d2e16f","85c483d5-d17f-495d-a088-78f652357e4d"],"skipped":[]}
```
Re-sending the same user (idempotent):
```json
{"assigned":[],"skipped":[{"userId":"be218193-9844-482b-b44d-575c49d2e16f","reason":"ALREADY_ASSIGNED_THIS_TEAM"}]}
```
Partial success (one free, one taken by another team):
```json
{"assigned":["cdcac924-5fa6-45c0-9a0e-3b84845ca1e5"],"skipped":[{"userId":"be218193-9844-482b-b44d-575c49d2e16f","reason":"ALREADY_ASSIGNED_OTHER_TEAM","heldByTeam":{"id":"d582b5a4-4814-4e8b-9f2a-f21c8a956e35","name":"docs-example-team-a"}}]}
```

A person can be assigned to a service by only one team. The first successful assignment wins,
decided by the database, so two leaders racing for the same person get exactly one winner. The
rest of a batch still succeeds. A user who marked the service unavailable is skipped too:
`{"userId":"...","reason":"UNAVAILABLE"}` (no `heldByTeam`). `assigned` plus `skipped` lists every submitted id once, except in
the rare case an assignment was removed between the insert and the lookup (that id then appears in
neither list) **(code)**.

| Status | Condition | Body |
|---|---|---|
| 400 | Empty array, >100 ids, non-array, non-UUID entry; invalid `notes` (see table above) | `{"message":["userIds must contain at least 1 elements"],"error":"Bad Request","statusCode":400}`; `["each value in userIds must be a UUID"]`; `["userIds must contain no more than 100 elements"]` |
| 400 | **Any** id is not an **active member of this team** (nothing is inserted) | `{"statusCode":400,"error":"Bad Request","code":"INVALID_USERS","message":"Some users are not active members of this team","invalidUserIds":["85c483d5-d17f-495d-a088-78f652357e4d"]}` |
| 401 / 403 | | |
| 404 | Unknown/deleted service; unknown team (ADMIN) | `Service not found` / `Team not found` |
| 409 | Service already started (`startsAt <= now`) | `{"statusCode":409,"error":"Conflict","code":"SERVICE_ALREADY_STARTED","message":"This service has already started"}` |

`INVALID_USERS` is the only 4xx with a list of offenders; it is for UI bugs (stale candidate list,
a member removed or deactivated meanwhile). Conflicts with other teams are **not** errors; they
come back in `skipped`.

## PATCH /services/:id/teams/:teamId/assignments/:userId
Set or edit the note on one assignment made by this team. Same access as the other routes
(leader of `:teamId`, or ADMIN using the holding team's id).

| Body field | Type | Required | Rules |
|---|---|---|---|
| `notes` | string | yes | At most 1000 characters. `""` clears the note. `null`, missing, non-string: 400 |

**200**
```json
{"serviceId":"...","userId":"...","teamId":"...","notes":"bring guitar"}
```

| Status | Condition |
|---|---|
| 400 | Malformed uuid, or invalid `notes` |
| 401 / 403 | |
| 404 | `Service not found` / `Team not found` (ADMIN only), or `Assignment not found` when **this team** has no assignment for that user (includes: another team holds them) |
| 409 | Service already started: `SERVICE_ALREADY_STARTED` (same body as above) |

Notes are read through `GET /services` and `GET /me/schedule` (`notes`, default `""`).

## DELETE /services/:id/teams/:teamId/assignments/:userId
Remove one assignment made by this team. **204**, empty body. Works for deactivated users, so a
leader can clean up. Afterwards the user shows up again in the candidates of every team they
belong to, and another team may claim them.

To remove an assignment held by **another** team, ADMIN calls this route with the *holding team's*
id (`heldByTeam.id` from an earlier `skipped` entry, or `teamId` from `GET /services`). A leader
cannot.

| Status | Condition | Body |
|---|---|---|
| 400 | Malformed uuid | standard |
| 401 / 403 | | |
| 404 | Service or team unknown | `Service not found` / `Team not found` |
| 404 | **This team** has no assignment for that user (includes: another team holds them; already removed) | `{"message":"Assignment not found","error":"Not Found","statusCode":404}` (names no team) |
| 409 | Service already started | `SERVICE_ALREADY_STARTED`, same body as above (returned even if nothing was assigned) |
| 409 | A recorded absence points at this assignment (see [attendance.md](attendance.md)) | `{"statusCode":409,"error":"Conflict","code":"HAS_ATTENDANCE_RECORDS","message":"..."}`; nothing is removed |
