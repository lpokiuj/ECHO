# Admin: prayer requests and volunteer applications

Seven routes to read and handle what visitors send through the public site (see
[public.md](public.md)). **ADMIN and PEMBINA only.** A MEMBER and a team leader (Ketua Bidang,
`isLeader: true`; leaders have no extra rights here) get **403**; no token is **401**. Conventions:
[README.md](README.md). All keys are camelCase (`adminNote`, not `admin_note`). No pagination, no
bulk delete. Verified by e2e tests (`test/admin-*.e2e-spec.ts`).

| Route | Success |
|---|---|
| `GET /admin/prayer-requests?status=` | 200 array, newest first |
| `PATCH /admin/prayer-requests/:id` | 200 the updated item |
| `DELETE /admin/prayer-requests/:id` | 204, empty body |
| `GET /admin/volunteer-applications?status=` | 200 array, newest first |
| `PATCH /admin/volunteer-applications/:id` | 200 the updated item |
| `DELETE /admin/volunteer-applications/:id` | 204, empty body |
| `GET /admin/submissions/counts` | 200 `{prayerRequestsNew, volunteerApplicationsNew}` |

## Statuses
| Type | Values | New submissions start as |
|---|---|---|
| Prayer request | `NEW`, `IN_PROGRESS`, `DONE` | `NEW` |
| Volunteer application | `NEW`, `CONTACTED`, `ACCEPTED`, `DECLINED` | `NEW` |

Any value can be set from any other value (including back to `NEW`).

## GET lists
Optional `?status=` filter with one value of that type's enum. An unknown, empty (`?status=`),
lower-case or repeated value is **400**. Order: `createdAt` newest first. An empty list is `[]`.

Prayer request item:
```json
{"id":"...","name":"Budi","contact":"0812","wantsFollowUp":true,"content":"Please pray","consentAt":"2026-03-01T00:00:00.000Z","status":"NEW","adminNote":null,"handledBy":null,"handledAt":null,"createdAt":"2026-03-01T00:00:00.000Z"}
```
`name` and `contact` are `null` when the visitor left them out.

Volunteer application item (same `status`, `adminNote`, `handledBy`, `handledAt`, `consentAt`,
`createdAt` fields):
```json
{"id":"...","fullName":"Sari","whatsapp":"0813","email":null,"availability":"Sundays","message":null,"bidang":[{"id":"...","name":"Music"},{"id":"...","name":"Worship"}],"consentAt":"...","status":"NEW","adminNote":null,"handledBy":null,"handledAt":null,"createdAt":"..."}
```
`bidang` is the list of teams the applicant is interested in, sorted by name; `[]` when none.

`handledBy` is `{"id":"...","name":"..."}` for the last person who did a PATCH, or `null` if nobody
did yet or that user was deleted (see below). `handledAt` is the time of the last PATCH.
Example responses are shaped from the e2e tests, not captured from a live server.

## PATCH body
| Field | Type | Rules |
|---|---|---|
| `status` | enum | optional; the type's values only (`null`, `""` and other values are 400) |
| `adminNote` | string or null | optional; trimmed, max 1000 chars; `null` or a blank string **clears** the note; a non-string is 400 |

At least one of the two must be sent: `{}` (or a body with only unknown fields, which are dropped)
is **400** `{"message":"Provide status or adminNote","error":"Bad Request","statusCode":400}`.
Sending only `status` keeps the note; sending only `adminNote` keeps the status.

**Every successful PATCH sets `handledBy` to the caller and `handledAt` to now**, whether it
changes the status, the note or both, including a no-op and a reset to `NEW`. The response is the
updated item, same shape as a list item. The update is one atomic statement.

## DELETE
**Hard delete**: the row is gone for good, with no soft-delete flag and no undo. Deleting a
volunteer application also removes its `bidang` interest rows (the teams are untouched). A second
delete of the same id is 404. The UI should always ask for confirmation.

## GET /admin/submissions/counts
```json
{"prayerRequestsNew":3,"volunteerApplicationsNew":1}
```
The number of rows with status `NEW` per type (not the totals). Always numbers, `0` when none. Use
it for the NEW badge. It changes after a public submission, a status change (to or from `NEW`) and
a delete.

## Errors
| Status | Condition | Body |
|---|---|---|
| 400 | Bad `?status=`, invalid PATCH body, malformed id | standard validation bodies (see README) |
| 401 | No or invalid token | `{"message":"Unauthorized","statusCode":401}` |
| 403 | MEMBER or team leader | `{"message":"Forbidden","statusCode":403}` |
| 404 | Unknown id on PATCH or DELETE | `{"message":"Prayer request not found","error":"Not Found","statusCode":404}` or `Volunteer application not found` |

## Notes
- `adminNote` is internal: no public route returns it (the public routes return only `{ok:true}`
  and the bidang list). Also never show it to the visitor.
- Deleting a user (`DELETE /users/:id`) who handled a submission keeps the submission; its
  `handledBy` becomes `null`.
- Stored text is not sanitized: render it as text, never as HTML.
