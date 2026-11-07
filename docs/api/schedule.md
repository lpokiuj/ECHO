# Schedule views

Two read-only routes available to **every logged-in user** (MEMBER, team leader, PEMBINA, ADMIN
all get the same data and 200). No token is 401. While `mustChangePassword` is true both return
`PASSWORD_CHANGE_REQUIRED`. Conventions: [README.md](README.md).

## Shared rules
- Soft-deleted services never appear.
- Ordered by `startsAt` ascending, then `title` (ties on both are in no defined order).
- **Default window:** only services that have **not ended** (`endsAt > now`). A service that has
  started but not ended is still listed. `?includePast=true` returns everything.
- Query `includePast`: `true` or `false` only. Anything else: `400`
  `{"message":["includePast must be true or false"],"error":"Bad Request","statusCode":400}`.
- No emails, no `isActive`, no password data anywhere in these responses. Deactivated users'
  assignments stay visible **(code)**.
- No pagination.

## GET /services
The full schedule: every service with everyone assigned, across all teams.

| Query | Type | Default |
|---|---|---|
| `includePast` | `true` \| `false` | `false` |

**200**
```json
[
  {
    "id": "e9ae933a-fe76-4f62-95a4-d3b4db8f27ae",
    "title": "Sunday Service",
    "startsAt": "2026-11-01T03:00:00.000Z",
    "endsAt": "2026-11-01T05:00:00.000Z",
    "unavailable": false,
    "assignments": [
      { "userId": "aafeafcb-ef7f-4b60-bbcf-70d762f8ff28", "name": "Enji", "teamId": "681e9003-157a-4f26-9b69-a39af059d88b", "teamName": "Worship", "notes": "", "isAbsentTaker": false }
    ]
  },
  {
    "id": "00adcf97-63e1-4dc6-a319-46fe3f93e922",
    "title": "KEEP 1",
    "startsAt": "2026-11-20T15:26:31.938Z",
    "endsAt": "2026-11-20T17:50:31.938Z",
    "unavailable": false,
    "assignments": [
      { "userId": "8bbc624a-3766-40b0-a32c-321f33524dc4", "name": "Agner", "teamId": "77256f56-93fc-46e9-b360-ca69f8b3263a", "teamName": "Sound", "notes": "", "isAbsentTaker": false },
      { "userId": "db93ae8c-9da7-4be1-bcc8-2c72c12033da", "name": "Giana", "teamId": "681e9003-157a-4f26-9b69-a39af059d88b", "teamName": "Worship", "notes": "", "isAbsentTaker": false }
    ]
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `id`, `title` | uuid, string | |
| `startsAt`, `endsAt` | ISO 8601 UTC | |
| `unavailable` | boolean | the **caller** marked this service unavailable (see [availability.md](availability.md)) |
| `assignments` | array | `[]` if nobody is assigned; ordered by `teamName`, then `name` |
| `assignments[].userId`, `name` | uuid, string | |
| `assignments[].teamId`, `teamName` | uuid, string | the team that assigned them (use `teamId` for ADMIN unassign) |
| `assignments[].notes` | string | note set by the team leader, `""` when none. Visible to every logged-in user |
| `assignments[].isAbsentTaker` | boolean | this person records their team's absences (see [attendance.md](attendance.md)) |

Note: this list does **not** include `createdBy` / `createdAt` (unlike the create/edit responses).

Errors: `400` bad `includePast`, `401`.

## GET /me/schedule
Only the caller's own assignments.

| Query | Type | Default |
|---|---|---|
| `includePast` | `true` \| `false` | `false` |

**200**
```json
[
  { "serviceId": "00adcf97-63e1-4dc6-a319-46fe3f93e922", "title": "KEEP 1", "startsAt": "2026-11-20T15:26:31.938Z", "endsAt": "2026-11-20T17:50:31.938Z", "teamId": "77256f56-93fc-46e9-b360-ca69f8b3263a", "teamName": "Sound", "notes": "", "unavailable": false }
]
```

| Field | Type | |
|---|---|---|
| `serviceId` | uuid | note: `serviceId`, not `id` |
| `title`, `startsAt`, `endsAt` | | |
| `teamId`, `teamName` | uuid, string | the team that assigned the caller |
| `notes` | string | note on the caller's assignment, `""` when none |
| `unavailable` | boolean | always `false` here (an assigned user cannot be unavailable) |

`[]` when the user has no (upcoming) assignment. A user assigned through several teams sees every
service once (one team per service is guaranteed).

Errors: `400` bad `includePast`, `401`.
