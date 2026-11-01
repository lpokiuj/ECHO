# Teams and membership (admin)

All six routes are **ADMIN only**. A team leader (even of that very team), a PEMBINA and a MEMBER
all get `403 {"message":"Forbidden","statusCode":403}`; no token is 401. Conventions:
[README.md](README.md). There is **no endpoint to delete a team** and none to delete a user.

## Objects

**Team**: `{ "id": uuid, "name": string }`

**Member view** (from `GET /teams/:id/members`)

| Field | Type | Notes |
|---|---|---|
| `userId` | uuid | |
| `name`, `email` | string | |
| `isLeader` | boolean | |
| `isActive` | boolean | inactive members are listed |

## POST /teams
Create a team. Body `{ "name": string }`: trimmed, 1-100 chars.
**201** `{"id":"...","name":"docs-example-team-a"}`

| Status | Condition | Body |
|---|---|---|
| 400 | Empty / whitespace-only / >100 chars / not a string | `{"message":["name should not be empty"],"error":"Bad Request","statusCode":400}` |
| 401 / 403 | | |
| 409 | Name already used | `{"message":"Team name already in use","error":"Conflict","statusCode":409}` |

## GET /teams
**200** all teams ordered by name, no pagination.
```json
[{"id":"a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb","name":"Multimedia"},{"id":"aba2c1ed-b318-467b-8388-e97b051dec22","name":"Music"}, ...]
```
Errors: 401, 403.

## PATCH /teams/:id
Rename. Body `{ "name": string }` (same rules as create). **200** the Team.

| Status | Condition | Body |
|---|---|---|
| 400 | Bad uuid / validation | standard |
| 404 | Unknown team | `{"message":"Not Found","statusCode":404}` |
| 409 | Name used by another team | `{"message":"Team name already in use","error":"Conflict","statusCode":409}` |

## GET /teams/:id/members
Roster of one team, ordered by name. **200**
```json
[{"userId":"d50ed778-821b-47f1-8992-475f525b4097","name":"Docs Example Lead A","email":"docs-example-lead-a@echo.local","isLeader":true,"isActive":true},
 {"userId":"be218193-9844-482b-b44d-575c49d2e16f","name":"Docs Example Member 1","email":"docs-example-m1@echo.local","isLeader":false,"isActive":true}]
```
Errors: 400 (bad uuid), 401, 403, `404 {"message":"Team not found","error":"Not Found","statusCode":404}`.

## PUT /teams/:id/members/:userId
Add a user to a team **or** change their leader flag. Idempotent upsert: calling it again never
creates a duplicate; it updates `isLeader`. A team may have zero, one or several leaders.

| Body field | Type | Required | Default |
|---|---|---|---|
| `isLeader` | boolean | no | `false` (so `PUT` with no body adds a plain member, and **resets an existing leader to `false`**) |

**200** (both for create and update):
```json
{"teamId":"d582b5a4-4814-4e8b-9f2a-f21c8a956e35","userId":"d50ed778-821b-47f1-8992-475f525b4097","isLeader":true}
```

| Status | Condition | Body |
|---|---|---|
| 400 | `isLeader` not a boolean | `{"message":["isLeader must be a boolean value"],"error":"Bad Request","statusCode":400}` |
| 400 | `isLeader: true` for a PEMBINA | `{"message":"A PEMBINA cannot be a team leader","error":"Bad Request","statusCode":400}` |
| 400 | User is inactive | `{"message":"Cannot add an inactive user to a team","error":"Bad Request","statusCode":400}` |
| 400 | Malformed uuid | standard |
| 401 / 403 | | |
| 404 | Unknown team | `{"message":"Team not found","error":"Not Found","statusCode":404}` |
| 404 | Unknown user | `{"message":"User not found","error":"Not Found","statusCode":404}` |

A PEMBINA may be a plain member (`isLeader: false`). Leader changes apply on that user's next
request (see Gotchas in [flows.md](flows.md)).

## DELETE /teams/:id/members/:userId
Remove a member. In one transaction the server also deletes **that team's** assignments of that
user on **future** services (`startsAt > now`). Past/started assignments stay, assignments by
other teams stay, and other users' assignments stay.

**200**
```json
{"removedAssignments":[
  {"serviceId":"f13c4b91-112d-44ae-8c63-4ed9400ad52f","title":"docs-example Service 1","startsAt":"2026-12-06T02:00:00.000Z"},
  {"serviceId":"c570c017-5e63-41b7-8290-6d9da522b837","title":"docs-example Service 2 (renamed)","startsAt":"2026-12-13T02:00:00.000Z"}
]}
```
`removedAssignments` is sorted by `startsAt`, `[]` if none. Soft-deleted services are removed but
**not listed** (e2e: `test/teams.e2e-spec.ts` "deletes assignments on soft-deleted future services but does not report them").

| Status | Condition | Body |
|---|---|---|
| 400 | Malformed uuid | standard |
| 401 / 403 | | |
| 404 | Not a member of that team, or the team or user does not exist (all the same body) | `{"message":"Member not found","error":"Not Found","statusCode":404}` |

Removing a leader or the last leader is allowed.
