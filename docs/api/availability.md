# Availability (member marks upcoming services unavailable)

Any logged-in user acts on **themselves**; there is no role check. The default for every service,
including new ones, is available: no row means available. A member who is marked unavailable
cannot be assigned by a team leader.

| Route | Result |
|---|---|
| `PUT /services/:id/unavailability` | 204, idempotent. Marks the caller unavailable |
| `DELETE /services/:id/unavailability` | 204, idempotent (deleting a missing mark is fine) |
| `GET /me/unavailability` | 200, array of service ids |

## PUT / DELETE /services/:id/unavailability
Empty body, empty 204 response.

| Status | Condition | Body |
|---|---|---|
| 400 | Malformed `:id` | standard uuid error |
| 401 | | |
| 404 | Unknown or soft-deleted service | `Service not found` |
| 409 | Service already started (`startsAt <= now`), for PUT and DELETE | `code: "SERVICE_ALREADY_STARTED"` |
| 409 | PUT only: the caller is already assigned to the service | `{"statusCode":409,"error":"Conflict","code":"ALREADY_ASSIGNED","message":"..."}` |

On `ALREADY_ASSIGNED` the member must ask the team leader to unassign them first. The server never
changes the schedule silently. Order: 401, 400 (bad uuid), 404, 409 `SERVICE_ALREADY_STARTED`, 409
`ALREADY_ASSIGNED`. The mark and an assignment can never both exist: assign and PUT are made
mutually exclusive in the database (single statement with `NOT EXISTS` plus an advisory lock), so
a leader assigning someone while they mark themselves unavailable ends with exactly one of them.

## GET /me/unavailability
```json
["00adcf97-63e1-4dc6-a319-46fe3f93e922", "e9ae933a-fe76-4f62-95a4-d3b4db8f27ae"]
```
Ids of **upcoming** (`startsAt > now`), non-deleted services the caller marked unavailable,
ordered by `startsAt`. `[]` when none.

## Effects on other routes
- `GET /services`: every service has `unavailable: boolean` for the caller.
- `GET /me/schedule`: every item has `unavailable` (always `false`: an assigned user cannot be
  unavailable).
- `GET .../candidates`: every candidate has `unavailable: boolean`. Unavailable members are still
  listed, flagged, and the UI should make them not selectable.
- `POST .../assignments`: an unavailable user is **skipped**, not an error:
  `{"userId":"...","reason":"UNAVAILABLE"}`; the rest of the batch still succeeds.
