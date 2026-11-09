# Users (admin)

All five routes are **ADMIN only**: PEMBINA, MEMBER and team leaders get `403 {"message":"Forbidden","statusCode":403}`;
no token gets 401. (A user whose `mustChangePassword` is true gets `PASSWORD_CHANGE_REQUIRED` first.)
Conventions: [README.md](README.md).

## User object
Returned by `POST /users`, `GET /users`, `PATCH /users/:id`. The password hash is never returned.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `email` | string | unique, case-insensitive; always returned in lowercase |
| `role` | `ADMIN` \| `PEMBINA` \| `MEMBER` | |
| `mustChangePassword` | boolean | `false` for new and reset accounts |
| `isActive` | boolean | `false` = cannot log in; existing tokens get 401 immediately |
| `createdAt` | ISO 8601 UTC | |

There are no memberships in this object. Get them from [`GET /teams/:id/members`](teams.md).

## POST /users
Create an account with the shared default password (`DEFAULT_USER_PASSWORD` from the server env;
the admin tells the person out of band). No forced change at first login.

| Body field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | not empty (not trimmed by the server) |
| `email` | string | yes | valid email, unique |
| `role` | enum | no | `ADMIN`/`PEMBINA`/`MEMBER`; default `MEMBER` |

`isActive`, `mustChangePassword`, `password` and any other property are ignored.

**201**
```json
{"id":"d50ed778-821b-47f1-8992-475f525b4097","name":"Docs Example Lead A","email":"docs-example-lead-a@echo.local","role":"MEMBER","mustChangePassword":false,"isActive":true,"createdAt":"2026-10-31T18:31:12.432Z"}
```

| Status | Condition | Body |
|---|---|---|
| 400 | Validation | `{"message":["name should not be empty","email must be an email","role must be one of the following values: ADMIN, PEMBINA, MEMBER"],"error":"Bad Request","statusCode":400}` |
| 401 / 403 | No token / not ADMIN | see README |
| 409 | Email already used | `{"message":"Email already in use","error":"Conflict","statusCode":409}` |

## GET /users
All users, ordered by name, no pagination. **200** array of User objects (inactive users included).

```json
[{"id":"3ba66b7e-9a5f-4a7f-be68-8b012feae3a7","name":"Admin","email":"admin@echo.local","role":"ADMIN","mustChangePassword":false,"isActive":true,"createdAt":"2026-10-30T13:29:15.792Z"}, ...]
```
Errors: 401, 403.

## PATCH /users/:id
Edit any subset of fields. Roles and deactivation apply on the user's next request.

| Param | Type | |
|---|---|---|
| `id` | uuid | 400 if malformed |

| Body field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | no | not empty |
| `email` | string | no | valid email, unique |
| `role` | enum | no | `ADMIN`/`PEMBINA`/`MEMBER` |
| `isActive` | boolean | no | |

An empty body `{}` is **not** an error: it returns the user unchanged (200).

**200** the updated User object:
```json
{"id":"85c483d5-d17f-495d-a088-78f652357e4d","name":"Docs Example Member 2","email":"docs-example-m2@echo.local","role":"MEMBER","mustChangePassword":false,"isActive":false,"createdAt":"2026-10-31T18:31:21.077Z"}
```

| Status | Condition | Body |
|---|---|---|
| 400 | Validation | standard validation body |
| 400 | **Admin editing themself** with `role` or `isActive` in the body (even if unchanged). Name/email of self are allowed | `{"message":"You cannot change your own role or active status","error":"Bad Request","statusCode":400}` |
| 400 | `role: "PEMBINA"` while the user is a team leader anywhere | `{"message":"A team leader cannot be PEMBINA. Remove the leader flag first","error":"Bad Request","statusCode":400}` |
| 401 / 403 | | |
| 404 | Unknown user id | `{"message":"Not Found","statusCode":404}` |
| 409 | Email already used | `{"message":"Email already in use","error":"Conflict","statusCode":409}` |

Deactivating a user does **not** remove them from teams or from existing assignments: they stay
visible on the schedule, are marked `isActive:false` in the team roster, and disappear from
candidate lists. Their open sessions get 401 on the next request.

## DELETE /users/:id
Hard delete: the row is gone for good. **ADMIN only.** **204**, empty body.

The database cascades the user's rows: team memberships, assignments (the user as the assigned
volunteer), unavailability marks, and absence records about the user. Attendance history of that
user is lost. Services, teams and other users are untouched. The deleted user's token stops
working (401 on the next request) and they cannot log in.

| Status | Condition | Body |
|---|---|---|
| 400 | Malformed id | standard |
| 400 | **Deleting yourself** (checked first) | `{"message":"You cannot delete yourself","error":"Bad Request","statusCode":400}` |
| 400 | Deleting the **last ADMIN** (counts every ADMIN row, active or not; concurrent deletes are serialized by a row lock) | `{"statusCode":400,"error":"Bad Request","code":"LAST_ADMIN","message":"The last ADMIN cannot be deleted"}` |
| 401 / 403 | | |
| 404 | Unknown user id | `{"message":"User not found","error":"Not Found","statusCode":404}` |
| 409 | The user **created a service** (soft-deleted ones count), **assigned someone** to a service, or **recorded an absence**. Nothing is deleted. Deactivate the user instead (`PATCH isActive:false`) | `{"statusCode":409,"error":"Conflict","code":"USER_HAS_CREATED_RECORDS","message":"This user created services, assigned people, or recorded absences, so they cannot be deleted"}` |

A user who was only assigned (by someone else) or only a member is deleted, with those rows.
An absence under the deleted user's assignment is removed even if another user recorded it.

## POST /users/:id/reset-password
Set the password back to the server's default and force a change at next login.

**204** empty body. Errors: 400 (malformed id), 401, 403, `404 {"message":"Not Found","statusCode":404}`.
The user's existing tokens keep working but every route except `/me` and `/auth/change-password`
now returns `PASSWORD_CHANGE_REQUIRED`.
