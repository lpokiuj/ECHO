# Echo Volunteer Portal: Backend PLAN.md

Scope: backend API only. The frontend gets its own plan later.

## Problem
Service schedules are announced in a WhatsApp group. Volunteers can't look up
their own schedule, and team leads assign people by message.

## Core action
A team leader assigns volunteers from their team to a service.
The volunteer sees it when they log in.

## Roles

Global role on `users.role`:

| Role | Permissions |
|---|---|
| ADMIN | Everything: users, teams, membership, services. Can unassign anyone. Held by the project owner and Ketua ECHO. |
| PEMBINA | Read all schedules. Can also create, edit, and delete services. Cannot be a team leader. Nothing else. |
| MEMBER | Everyone else. Views the full service schedule (all teams' assignments). |

Team leader is NOT a global role. It is `is_leader = true` on a row in
`team_members`. A person can lead one team and be an ordinary member of another.

A leader of team B can:
- see only their own team's members when assigning (the candidates list); they cannot read any team roster
- see all services with every team's assignments (the schedule is open to all logged-in users)
- assign and unassign members of B to services, as team B

## Domain rules (these are the hard part, test them)

1. A volunteer can be a member of several teams.
2. Within ONE service, a volunteer can be assigned by only ONE team.
   First successful assignment wins.
3. Rule 2 is enforced by the database: `UNIQUE (service_id, user_id)` on
   `service_assignments`. Never check-then-insert (race condition).
4. Assign uses `INSERT ... ON CONFLICT (service_id, user_id) DO NOTHING RETURNING *`.
   Users missing from the returned rows are conflicts and are reported back.
   The rest of the batch still succeeds.
5. Conflict reporting: for each skipped user, look up the existing row and report
   - `ALREADY_ASSIGNED_THIS_TEAM` if the same team already assigned them, or
   - `ALREADY_ASSIGNED_OTHER_TEAM` if a different team did.
   Skipped `ALREADY_ASSIGNED_OTHER_TEAM` entries include `heldByTeam: { id, name }` for every caller.
6. Candidate list for (service, team) = members of that team minus anyone
   already assigned in that service by another team. The client refreshes this
   list after a conflict.
7. A team can only assign its own members. Enforced in the service layer, with tests.
8. No accept/decline, no status field, no capacity limit.
9. Removing a user from a team deletes that team's assignments for that user
   on future services (`starts_at > now`). Past assignments are kept.
10. Services are soft deleted (`deleted_at`).
11. Timestamps are `timestamptz`, stored UTC. Display in WIB is the frontend's job.
12. While `must_change_password` is true, every endpoint except
    `POST /auth/change-password` and `GET /me` returns 403.
13. Inactive users (`is_active = false`) cannot log in, and their requests are rejected
    even with a previously issued token. Users are deactivated, never deleted, in v1.
14. Changing a service's time after assignments exist is allowed. Assignments are kept.
    No notification in v1.

## Data model

- `users(id uuid, name, email unique, password_hash, role, must_change_password, is_active, created_at)`
- `teams(id uuid, name unique)`
- `team_members(team_id, user_id, is_leader, created_at)` PK `(team_id, user_id)`
- `services(id uuid, title, starts_at, ends_at, created_by, created_at, deleted_at)`
  CHECK `(ends_at > starts_at)`
- `service_assignments(id uuid, service_id, user_id, team_id, assigned_by, created_at)`
  UNIQUE `(service_id, user_id)`

## API (draft)

Auth
- `POST /auth/login`
- `POST /auth/change-password`
- `GET /me` (profile, role, `must_change_password`, memberships with `is_leader`)

Admin (ADMIN)
- `POST /users`, `GET /users`, `PATCH /users/:id`, `POST /users/:id/reset-password`
- `POST /teams`, `GET /teams`, `PATCH /teams/:id`
- `PUT /teams/:id/members/:userId` (body: `is_leader`), `DELETE /teams/:id/members/:userId`
- `GET /teams/:id/members`

Services (ADMIN, PEMBINA)
- `POST /services`, `PATCH /services/:id`, `DELETE /services/:id`

Assignments (leader of that team, or ADMIN)
- `GET /services/:id/teams/:teamId/candidates`
- `POST /services/:id/teams/:teamId/assignments` body `{ userIds: [] }`
- `DELETE /services/:id/teams/:teamId/assignments/:userId`

Views
- `GET /me/schedule` (any logged-in user)
- `GET /services` (any logged-in user: all services with all teams' assignments, names only, no emails)

## Frontend notes
- Read `X-Access-Token` from every authenticated response and store it; it renews the
  15-minute idle window. If CORS is enabled, the server must expose that header.
- A 401 from `POST /auth/change-password` means the current password was wrong, not that
  the session expired.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Stack | NestJS, TypeORM, PostgreSQL, Docker, WSL | Known tools |
| Layout | API in `apps/api` together with CLAUDE.md and PLAN.md. Compose, `docker/`, and env files at the repo root. | Docs are backend-only; frontend gets its own plan later |
| Test runner / linter | Vitest and oxlint (NestJS 12 scaffold defaults), ESM. `GET /health` is a plain controller running `SELECT 1` (200, or 503 if the DB is down). | Keep scaffold defaults; no extra dependency for health |
| Schema changes | Migrations only (details in CLAUDE.md) | Reproducible, reviewable |
| Auth | JWT carries the user id only. The auth guard loads the user from the DB on every request and checks `is_active`, `role`, and `must_change_password`. Lifetime from env `JWT_EXPIRES_IN`, default `15m`, renewed on every request via the `X-Access-Token` response header (sliding idle timeout). No refresh tokens in v1. | Role, deactivation, and leadership changes take effect immediately |
| Passwords | Hashed (bcrypt). Minimum 8 characters. Admin creates accounts with a temp password, `must_change_password = true`. Admin resets. | No email service in v1 |
| IDs | uuid | No guessable ids |
| Databases | Two databases on one Postgres container: `echo_dev` and `echo_test` (rules in CLAUDE.md) | Tests wipe data, which must never touch dev data |
| Lists | No pagination in v1 | Small organization |
| Team membership | Only ADMIN (project owner and Ketua ECHO) can add or remove team members and set `is_leader`. A team leader cannot add volunteers to their own team. | Membership is org-level structure, not a leader's call |
| Service management | ADMIN and PEMBINA can create, edit, and delete services. Team leaders cannot. | Service creation is org-level scheduling, not a team leader's call. |
| Service time change | Allowed after assignments exist. No notification in v1 (planned for v2). | Notifications are out of scope for v1 |
| Schedule visibility | Every logged-in user sees every service with all teams' assignments (names only). | Schedules were already visible to the whole WhatsApp group. |
| Team roster | `GET /teams/:id/members` is ADMIN only, for the future admin team-management page. | Leaders see their own team's people through the candidates list. |
| Service start time | A service cannot be created with `starts_at` in the past, and PATCH cannot move `starts_at` into the past (400). Past services stay readable. | Past schedules are history; assignments are already locked for started services |
| PEMBINA and leadership | PEMBINA can never have `is_leader = true`: `PUT /teams/:id/members/:userId` with `isLeader: true` for a PEMBINA is 400, and `PATCH /users/:id` setting role PEMBINA is 400 while the user leads any team. PEMBINA can be a plain member. | PEMBINA is an oversight role, not a team role |
| Started services | Assigning and unassigning are blocked once `starts_at <= now` (409 `SERVICE_ALREADY_STARTED`). The candidate list still works. | Past schedules are history |
| Assign batch validation | 1 to 100 unique user ids. If any id is not an active member of the path team, the whole request is 400 `INVALID_USERS` and nothing is inserted. Conflicts with other teams are not errors: they are skipped and reported (rule 4). Candidates exclude inactive users. | A non-member id is a client bug; a conflict is a race |
| Schedule window | `GET /services` and `GET /me/schedule` list only services with `ends_at > now` by default; `?includePast=true` lists all. Note this differs from "started" above, which uses `starts_at`. | Volunteers care about what is current or upcoming |
| ADMIN unassign | ADMIN removes another team's assignment through the same DELETE route, using the holding team's id (visible as `heldByTeam`). No separate admin endpoint. | Keeps one code path |
| Candidate list | Users already assigned by this team are shown and marked as assigned. Users assigned by another team are excluded. | Leader sees their full roster for the service |
| Seed admin | `npm run seed` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env and creates one ADMIN with `must_change_password = true`. `.env.example` uses `ADMIN_EMAIL=admin@echo.local`, `ADMIN_PASSWORD=password` for local development only. The seed refuses to run when `NODE_ENV=production`. It targets `echo_dev` only; tests create their own fixtures. | A known password is acceptable on a local dev DB only if it can't reach production |
| Terminology | English "team" (not the Indonesian "bidang"); "team leader" (not "Ketua Bidang"). "Ketua ECHO" stays as a title. | Avoids confusion in code and docs |
| Roles storage | `users.role` is a Postgres enum named `user_role` (ADMIN, PEMBINA, MEMBER). | The DB rejects unknown roles |
| Foreign keys | Plain FKs with `ON DELETE RESTRICT`. "A team assigns only its own members" (rule 7) is checked in the service layer, not by a composite FK. | A composite FK to `team_members` would conflict with rule 9 (past assignments are kept after removal) |
| Seed data | Teams: Worship, Music, Sound, Multimedia, Usher, Stage Manager. People and assignments live in `src/database/seed-data.ts`, edited by hand (ships with marked examples). Insert-only, dev DB only (`echo_dev`). Fake users share `SEED_USER_PASSWORD` and have `must_change_password = false`. Hashing uses `bcryptjs` (pure JS, no native build). | Try assignment conflicts by hand before the admin endpoints exist |
| Default password | Env `DEFAULT_USER_PASSWORD` (required, min 8 chars, app refuses to start without it) is the password for every account the admin creates or resets. `.env.example` uses `changeme123` for local development only. | No email service in v1; admin hands the password over out of band and the user must change it at first login |
| User admin safety | An admin cannot change their own role or `isActive` (400). | Prevents leaving the system with no active admin |
| Member removal response | `DELETE /teams/:id/members/:userId` returns 200 `{ removedAssignments: [{ serviceId, title, startsAt }] }` (the future services the member was unassigned from, sorted by `startsAt`; soft-deleted services are not listed), so the admin UI can tell the admin. No push notification in v1. PEMBINA cannot remove members and sees the change in the schedule views. | Admin sees the impact of a removal without a notification system |
| Service responses | `POST` and `PATCH /services` return `{ id, title, startsAt, endsAt, createdBy, createdAt }` (no `deletedAt`). `PATCH` rejects any `startsAt` in the body that is at or before now (400), even if unchanged; clients send only the fields they change. Title and `endsAt` edits on a started service still work. | Literal reading of the "Service start time" rule; one response shape |
| Assignment errors | `INVALID_USERS` is 400 `{ statusCode, error, code, message, invalidUserIds }`; `SERVICE_ALREADY_STARTED` is 409 with the same shape minus `invalidUserIds`. | Same body shape as `PASSWORD_CHANGE_REQUIRED` |
| Assignment check order | Body validation (global ValidationPipe) runs before the handler, so a malformed assign body is 400 even for an unknown or deleted service. Guard (403) still comes first; path-param UUIDs are checked after it (a non-UUID `:teamId` is 403 for non-admins, 400 for ADMIN). | Standard NestJS pipe order, consistent with other modules |

## Out of scope (Later)
- Email or WhatsApp notifications, including a notice when a service time changes (v2)
- Self-registration and self-service password reset
- Overlapping-service warnings for the same volunteer
- Availability, swap requests, attendance, reports
- Extra Pembina / Ketua ECHO capabilities (splitting ADMIN into two roles)
- Frontend, public site
- Service notes (a notes field on services)
- Login rate limiting and brute-force lockout
- Token revocation: changing a password does not log out other devices, and a leaked
  token works until it expires (15 minutes after last use)

## Open questions (agent: ask the user BEFORE implementing; do not pick a default)
None at the moment.

## Feature order (one Claude Code session per item)
Acceptance criteria for each feature are added to docs/features/NN-*.md before its session
starts. If a feature has none, ask the user for them before implementing.

1. Scaffold (done). Criteria: docs/features/01-scaffold.md
2. Entities + seed (done). Criteria: docs/features/02-entities-seed.md
3. Auth (done). Criteria: docs/features/03-auth.md
4. User management (done). Criteria: docs/features/04-users.md
5. Teams + membership + leader flag (done). Criteria: docs/features/05-teams.md
6. Services CRUD with soft delete (ADMIN, PEMBINA) (done). Criteria: docs/features/06-services.md
7. Assignments (done). Criteria: docs/features/07-assignments.md
8. Schedule views: `/me/schedule`, `/services`, `/teams/:id/members` (ADMIN only) (done). Criteria: docs/features/08-schedule-views.md

## Status
- [x] 1. Scaffold
- [x] 2. Entities + migration + seed
- [x] 3. Auth
- [x] 4. User management
- [x] 5. Teams + membership
- [x] 6. Services
- [x] 7. Assignments
- [x] 8. Schedule views