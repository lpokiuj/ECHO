# Echo API: frontend guide

Backend for the Echo Youth GLC volunteer portal. This folder is written for a frontend developer
who cannot read the NestJS code. Everything here was checked against the code, the e2e tests, and
a running server. Where a behaviour is read from code or an e2e test but was not reproduced
against a live server, it is marked **(code)** or **(e2e)**. Examples marked
`example not verified` were not captured from a real response.

## Index

| File | Contents |
|---|---|
| [auth.md](auth.md) | `POST /auth/login`, `POST /auth/change-password`, `GET /me` |
| [users.md](users.md) | Admin user management |
| [teams.md](teams.md) | Teams, membership, leader flag |
| [services.md](services.md) | Create / edit / soft-delete services |
| [assignments.md](assignments.md) | Candidates, assign, unassign (leader screen) |
| [schedule.md](schedule.md) | `GET /services` (full schedule), `GET /me/schedule` |
| [flows.md](flows.md) | Exact call order for each screen, plus **Gotchas** |
| [permissions.md](permissions.md) | Endpoint x role matrix |

22 routes in total (see the count per file in `permissions.md`).

## Run the API locally

Install once at the repo root (`~/code/echo`): `npm install` (npm workspaces). Then, from the root and then `apps/api` (root aliases exist: `npm run db:up`, `npm run dev:api`):

```bash
docker compose up -d --wait db          # Postgres; creates echo_dev and echo_test
cd apps/api
npm run migration:run                   # first time only
npm run seed                            # dev data; insert-only, safe to re-run
npm run start:dev                       # http://localhost:3000  (PORT env overrides)
```

Env files live at the repo root (`.env`, gitignored; template `.env.example`). Passwords are
**dev-only values from env**; never hard-code them in the frontend.

| Account | Email | Password comes from |
|---|---|---|
| Admin | `ADMIN_EMAIL` (`.env.example`: `admin@echo.local`) | `ADMIN_PASSWORD` |
| Every seeded user below | listed below | `SEED_USER_PASSWORD` |
| Any user created or reset through the API | whatever the admin entered | `DEFAULT_USER_PASSWORD` (user must change it at first login) |

Seeded users (`apps/api/src/database/seed-data.ts`; they have `mustChangePassword: false`):

| Email | Role | Teams |
|---|---|---|
| `petrus@echo.local`, `jimmy@echo.local` | PEMBINA | none |
| `livana@echo.local` | MEMBER | Worship (leader) |
| `giana@echo.local`, `lukas@echo.local` | MEMBER | Worship |
| `daniel@echo.local` | MEMBER | Music (leader) |
| `osteen@echo.local`, `geofend@echo.local` | MEMBER | Music |
| `ruben@echo.local` | MEMBER | Sound (leader) |
| `sam@echo.local` | MEMBER | Sound |
| `nadia@echo.local` | MEMBER | Usher (leader) |
| `agner@echo.local` | MEMBER | Usher (leader) and Sound (plain member) |
| `alin@echo.local` | MEMBER | Usher |
| `ms@echo.local` | MEMBER | Stage Manager (leader) |
| `enat@echo.local` | MEMBER | Stage Manager |
| `enji@echo.local` | MEMBER | Worship and Stage Manager (conflict demo) |
| `dhena@echo.local` | MEMBER, **inactive** (cannot log in) | Worship |

Teams: Worship, Music, Sound, Multimedia, Usher, Stage Manager. The seed also creates two
Sunday services. Ids are random per database; fetch them with the API.

## Conventions

### Base URL and format
JSON in, JSON out (`Content-Type: application/json`). No version prefix, no pagination (every
list returns the whole array). There is no `/api` prefix.

### Authentication header
```
Authorization: Bearer <accessToken>
```
The scheme is case-sensitive: `bearer <token>` gives 401. Everything is protected except
`GET /health` and `POST /auth/login`.

### Token renewal: `X-Access-Token`
- The token lifetime is an **idle window of 15 minutes** (`JWT_EXPIRES_IN`, default `15m`).
- **Every response to an authenticated request** carries a fresh token in the response header
  `X-Access-Token`. Replace your stored token with it every time, including on 4xx responses
  that came from an authenticated user (403, 404, 400, 409 all carry it).
- It is **not** sent on `POST /auth/login`, `GET /health`, or any 401.
- If the user is idle for more than 15 minutes the next request is 401: send them to login.
- The token holds only the user id. Role, active status, leader status and
  `mustChangePassword` are read from the database on **every** request, so changes apply on the
  very next call even with an old token.
- **CORS:** the server currently enables no CORS at all (no `Access-Control-*` headers; a
  preflight `OPTIONS` gets 404). A browser app on another origin cannot call it until CORS is
  added. When it is, it must `exposedHeaders: ['X-Access-Token']` or the browser hides the header.
  Until then use a dev proxy on the same origin.

### 401 vs 403
| Status | Meaning | Frontend action |
|---|---|---|
| 401 | Not authenticated: missing/malformed/expired token, deactivated user, wrong login. **Also** a wrong `currentPassword` on `POST /auth/change-password` | Go to login (except on change-password: show "wrong current password") |
| 403 | Authenticated but not allowed: wrong role, not leader of that team, or password change required | Read `code`: `PASSWORD_CHANGE_REQUIRED` -> change-password screen; otherwise show "not allowed" |

### `PASSWORD_CHANGE_REQUIRED`
While `mustChangePassword` is `true` (new accounts, after an admin reset) every authenticated
route returns:
```json
{"statusCode":403,"error":"Forbidden","code":"PASSWORD_CHANGE_REQUIRED","message":"You must change your password first"}
```
Exempt routes: `POST /auth/change-password`, `GET /me` (and the public `GET /health`,
`POST /auth/login`). This check runs **before** role checks, so such a user gets this error even
on admin routes.

### Error body shape
There is no custom exception filter; errors are NestJS defaults. Always branch on the HTTP
status first, then on `code` when present. `message` is **a string or an array of strings**.

| Kind | Example body (real) |
|---|---|
| Validation (DTO) | `{"message":["email must be an email","password must be longer than or equal to 1 characters"],"error":"Bad Request","statusCode":400}` |
| Bad UUID in path | `{"message":"Validation failed (uuid is expected)","error":"Bad Request","statusCode":400}` |
| Malformed JSON | `{"message":"Expected property name or '}' in JSON at position 1 (line 1 column 2)","error":"Bad Request","statusCode":400}` |
| Business rule | `{"message":"endsAt must be after startsAt","error":"Bad Request","statusCode":400}` |
| 401 | `{"message":"Unauthorized","statusCode":401}` (no `error` key) |
| 403 (role/leader) | `{"message":"Forbidden","statusCode":403}` (no `error` key) |
| 403 password change | see above (has `code`) |
| 404 with text | `{"message":"Service not found","error":"Not Found","statusCode":404}` |
| 404 bare | `{"message":"Not Found","statusCode":404}` (no `error` key) |
| Unknown route | `{"message":"Cannot GET /nope","error":"Not Found","statusCode":404}` |
| 409 | `{"message":"Email already in use","error":"Conflict","statusCode":409}` |
| Coded errors (only 3 exist) | `PASSWORD_CHANGE_REQUIRED` (403), `INVALID_USERS` (400, adds `invalidUserIds`), `SERVICE_ALREADY_STARTED` (409) |

Because keys differ (`error` is sometimes missing), read `statusCode` / HTTP status, not `error`.
Unhandled server errors would be a 500 `{"statusCode":500,"message":"Internal server error"}`
(Nest default; example not verified).

Unknown JSON properties in a request body are **silently dropped**, not rejected (for example
`isActive` sent to `POST /users` is ignored). Form-encoded bodies are also parsed.

### Dates
- **Input:** ISO 8601 **with an offset** (`Z` or `+07:00`). `2026-12-06T09:00:00` (no offset) is
  rejected with 400 `startsAt must include a timezone offset (Z or +HH:MM)`.
- **Output:** always UTC, with milliseconds: `2026-12-06T02:00:00.000Z`.
- Showing times in WIB (UTC+7) is the frontend's job. `2026-12-06T09:00:00+07:00` in
  becomes `2026-12-06T02:00:00.000Z` out.
- `createdAt` (users) and `createdAt` (services) are UTC the same way.

### Ids
All ids are UUIDs. A malformed UUID in a path is **400** `Validation failed (uuid is expected)`,
except `:teamId` on the assignment routes for a non-admin, which is **403** (the permission check
runs first, see [assignments.md](assignments.md)). Unknown (well-formed) ids are 404.

### Lists and pagination
No pagination anywhere. Orders: `/users` by name; `/teams` by name; team members by name;
`/services` by `startsAt` then `title`; `/me/schedule` by `startsAt` then `title`; candidates by
name.

### Enums
| Name | Values | Used in |
|---|---|---|
| `UserRole` | `ADMIN`, `PEMBINA`, `MEMBER` | `role` on users, `/me` |
| Skip reason | `ALREADY_ASSIGNED_THIS_TEAM`, `ALREADY_ASSIGNED_OTHER_TEAM` | `skipped[].reason` |
| Error `code` | `PASSWORD_CHANGE_REQUIRED`, `INVALID_USERS`, `SERVICE_ALREADY_STARTED` | error bodies |

"Team leader" is **not** a role: it is `isLeader: true` on a team membership (see `GET /me` ->
`memberships`). A person can lead one team and be a plain member of another. A PEMBINA can never
be a leader.

## GET /health
`GET /health` (public) -> `200 {"status":"ok"}`. If the database is down it returns
`503 {"status":"error","db":"down"}` **(code; example not verified)**.
