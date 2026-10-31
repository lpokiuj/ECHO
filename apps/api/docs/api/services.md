# Services (create, edit, delete)

A "service" is a church service people are scheduled for. Reading services is in
[schedule.md](schedule.md) (`GET /services`). Conventions: [README.md](README.md).

All three routes: **ADMIN or PEMBINA**. MEMBER and team leaders get
`403 {"message":"Forbidden","statusCode":403}`; no token is 401.

## Service object (create/edit responses)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `title` | string | trimmed |
| `startsAt`, `endsAt` | ISO 8601 UTC | e.g. `2026-12-06T02:00:00.000Z` |
| `createdBy` | uuid | user who created it |
| `createdAt` | ISO 8601 UTC | |

`deletedAt` is never returned.

## POST /services

| Body field | Type | Required | Rules |
|---|---|---|---|
| `title` | string | yes | trimmed, 1-150 chars |
| `startsAt` | string | yes | ISO 8601 **with offset** (`Z` or `+07:00`); must be in the future |
| `endsAt` | string | yes | ISO 8601 with offset; must be after `startsAt` |

Request (WIB input) and **201** response (UTC output), same instant:
```json
{"title":"  docs-example Service 1  ","startsAt":"2026-12-06T09:00:00+07:00","endsAt":"2026-12-06T11:00:00+07:00"}
```
```json
{"id":"f13c4b91-112d-44ae-8c63-4ed9400ad52f","title":"docs-example Service 1","startsAt":"2026-12-06T02:00:00.000Z","endsAt":"2026-12-06T04:00:00.000Z","createdBy":"4febc500-191d-4f5e-9929-b4e7eea31995","createdAt":"2026-10-31T18:32:07.099Z"}
```

| Status | Condition | Body |
|---|---|---|
| 400 | No offset on a date | `{"message":["startsAt must include a timezone offset (Z or +HH:MM)"],"error":"Bad Request","statusCode":400}` |
| 400 | Invalid / missing fields (messages for each failed rule are listed) | `{"message":["title must be longer than or equal to 1 characters","startsAt must include a timezone offset (Z or +HH:MM)","startsAt must be a valid ISO 8601 date string", ...],"error":"Bad Request","statusCode":400}` |
| 400 | Title > 150 chars | `{"message":["title must be shorter than or equal to 150 characters"],"error":"Bad Request","statusCode":400}` |
| 400 | `endsAt` <= `startsAt` | `{"message":"endsAt must be after startsAt","error":"Bad Request","statusCode":400}` |
| 400 | `startsAt` not in the future | `{"message":"startsAt must be in the future","error":"Bad Request","statusCode":400}` |
| 401 / 403 | | |

## PATCH /services/:id
Edit any non-empty subset of `title`, `startsAt`, `endsAt` (same field rules). The merged result is
validated. Existing assignments are kept when times change (no notification is sent).

| Param | Type | |
|---|---|---|
| `id` | uuid | 400 if malformed |

**200** the updated Service object:
```json
{"id":"c570c017-5e63-41b7-8290-6d9da522b837","title":"docs-example Service 2 (renamed)","startsAt":"2026-12-13T02:00:00.000Z","endsAt":"2026-12-13T04:00:00.000Z","createdBy":"3ba66b7e-9a5f-4a7f-be68-8b012feae3a7","createdAt":"2026-10-31T18:32:07.140Z"}
```

| Status | Condition | Body |
|---|---|---|
| 400 | Empty body | `{"message":"Provide at least one field to update","error":"Bad Request","statusCode":400}` |
| 400 | Validation / no offset | as in POST |
| 400 | Merged range invalid (e.g. new `endsAt` before existing `startsAt`) | `{"message":"endsAt must be after startsAt","error":"Bad Request","statusCode":400}` |
| 400 | Any `startsAt` in the body that is now or earlier (even unchanged) | `{"message":"startsAt must be in the future","error":"Bad Request","statusCode":400}` |
| 401 / 403 | | |
| 404 | Unknown or soft-deleted service | `{"message":"Service not found","error":"Not Found","statusCode":404}` |

A service that **has already started** can still have its `title` or `endsAt` edited (verified live).
Send only the fields you change: re-sending an unchanged past `startsAt` is rejected. Moving
`startsAt` of any service later than its current `endsAt` also needs a new `endsAt` in the same
request.

## DELETE /services/:id
Soft delete. **204**, empty body. The service disappears from every list and every
assignment route returns 404 for it; assignment rows are kept in the database.

| Status | Condition | Body |
|---|---|---|
| 400 | Malformed id | standard |
| 401 / 403 | | |
| 404 | Unknown or already deleted | `{"message":"Service not found","error":"Not Found","statusCode":404}` |

There is no restore endpoint.
