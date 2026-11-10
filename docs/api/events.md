# Events (Acara)

Events shown in the Acara section of the public site, managed in the portal. Conventions:
[README.md](README.md). All keys are camelCase. Verified by e2e tests
(`test/admin-events*.e2e-spec.ts`, `test/public-events.e2e-spec.ts`). Examples are not verified
against a live server.

## Public: GET /public/events
No token needed (a token, if sent, is ignored); not rate limited. **200**, only **upcoming** events
(`startsAt >= now`), sorted by `startsAt` **ascending** (then id). Empty list is `[]`.
```json
[{"id":"6f1c2b9e-0c58-4a8e-9d3f-2f7a1c0b5e11","title":"Youth Night","startsAt":"2031-05-01T10:00:00.000Z","location":"Main hall","description":"An evening together"}]
```
Exactly these five fields: no `createdBy`, `createdAt` or `updatedAt`. Render text as text, never
as HTML.

## Admin (ADMIN and PEMBINA only)
MEMBER and Ketua Bidang get 403, no token gets 401. A Ketua Bidang has no extra rights.

| Route | Result |
|---|---|
| `GET /admin/events` | **200**, array of **all** events (past too), **newest start first** (`startsAt` descending, then id) |
| `POST /admin/events` | **201**, the created event |
| `PATCH /admin/events/:id` | **200**, the updated event |
| `DELETE /admin/events/:id` | **204**, no body. **Hard delete**: the row is gone and cannot be restored. Always ask the user to confirm |

Event object (admin routes):
```json
{"id":"6f1c2b9e-0c58-4a8e-9d3f-2f7a1c0b5e11","title":"Youth Night","startsAt":"2031-05-01T10:00:00.000Z","location":"Main hall","description":"An evening together","createdBy":"a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb","createdAt":"2026-11-10T09:00:00.000Z","updatedAt":"2026-11-10T09:00:00.000Z"}
```
`createdBy` is the creating user's id, or `null` after that user was deleted (the event stays).

### Fields (POST required, PATCH optional)
| Field | Type | Rules |
|---|---|---|
| `title` | string | trimmed, 1-120 chars |
| `startsAt` | string | ISO 8601 **with an offset** (`Z` or `+07:00`); a value without an offset is 400. A time in the past is allowed |
| `location` | string | trimmed, 1-200 |
| `description` | string | trimmed, 1-2000 |

Whitespace-only text counts as empty (400). Unknown fields are dropped (`createdBy`, `id` and the
timestamps cannot be set). Output dates are UTC with milliseconds.

`PATCH` is partial: send only what changes. An **empty body is 400**
`{"message":"Provide at least one field to update",...}` (also for an unknown id). A successful PATCH
refreshes `updatedAt`.

### Errors
| Status | Condition |
|---|---|
| 400 | Missing, empty or too long field, invalid date or no offset (message array); empty PATCH body; `:id` is not a uuid (`Validation failed (uuid is expected)`) |
| 401 | No token |
| 403 | MEMBER or Ketua Bidang |
| 404 | Unknown id on PATCH or DELETE: `{"message":"Event not found","error":"Not Found","statusCode":404}` |
