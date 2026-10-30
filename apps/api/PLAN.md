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
| PEMBINA | Read-only: all schedules |
| MEMBER | Everyone else. Views own schedule. |

Team leader is NOT a global role. It is `is_leader = true` on a row in
`team_members`. A person can lead one team and be an ordinary member of another.

A leader of team B can:
- see the members of B only (not other teams' members, even shared volunteers)
- see ALL services (they need to pick one), but only the assignments made by team B
- assign and unassign members of B to services, as team B
- create services, and edit or delete ANY service (not only their own)

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
   Leaders do NOT see which other team holds them. ADMIN does.
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

Services (ADMIN or a leader of any team)
- `POST /services`, `PATCH /services/:id`, `DELETE /services/:id`

Assignments (leader of that team, or ADMIN)
- `GET /services/:id/teams/:teamId/candidates`
- `POST /services/:id/teams/:teamId/assignments` body `{ userIds: [] }`
- `DELETE /services/:id/teams/:teamId/assignments/:userId`

Views
- `GET /me/schedule` (any logged-in user)
- `GET /services`
  - ADMIN / PEMBINA: all services with all assignments
  - leaders: all services, only their own team's assignments
  - plain MEMBER: 403 (they use `/me/schedule`)
- `GET /teams/:id/members` (leader of that team, or ADMIN)

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
| Service management | ADMIN or a leader of any team can create, edit, and delete any service. | Leaders schedule their own services without waiting for ADMIN |
| Service time change | Allowed after assignments exist. No notification in v1 (planned for v2). | Notifications are out of scope for v1 |
| Candidate list | Users already assigned by this team are shown and marked as assigned. Users assigned by another team are excluded. | Leader sees their full roster for the service |
| Seed admin | `npm run seed` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env and creates one ADMIN with `must_change_password = true`. `.env.example` uses `ADMIN_EMAIL=admin@echo.local`, `ADMIN_PASSWORD=password` for local development only. The seed refuses to run when `NODE_ENV=production`. It targets `echo_dev` only; tests create their own fixtures. | A known password is acceptable on a local dev DB only if it can't reach production |
| Terminology | English "team" (not the Indonesian "bidang"); "team leader" (not "Ketua Bidang"). "Ketua ECHO" stays as a title. | Avoids confusion in code and docs |
| Roles storage | `users.role` is a Postgres enum named `user_role` (ADMIN, PEMBINA, MEMBER). | The DB rejects unknown roles |
| Foreign keys | Plain FKs with `ON DELETE RESTRICT`. "A team assigns only its own members" (rule 7) is checked in the service layer, not by a composite FK. | A composite FK to `team_members` would conflict with rule 9 (past assignments are kept after removal) |
| Seed data | Teams: Worship, Music, Sound, Multimedia, Usher, Stage Manager. People and assignments live in `src/database/seed-data.ts`, edited by hand (ships with marked examples). Insert-only, dev DB only (`echo_dev`). Fake users share `SEED_USER_PASSWORD` and have `must_change_password = false`. Hashing uses `bcryptjs` (pure JS, no native build). | Try assignment conflicts by hand before the admin endpoints exist |

## Out of scope (Later)
- Email or WhatsApp notifications, including a notice when a service time changes (v2)
- Self-registration and self-service password reset
- Overlapping-service warnings for the same volunteer
- Availability, swap requests, attendance, reports
- Extra Pembina / Ketua ECHO capabilities (splitting ADMIN into two roles)
- Frontend, public site

## Open questions (agent: ask the user BEFORE implementing; do not pick a default)
None at the moment.

## Feature order (one Claude Code session per item)
Acceptance criteria for features 2 to 8 are added to this file before their session
starts. If a feature has none, ask the user for them before implementing.

1. Scaffold: NestJS, TypeORM, Postgres in Docker, migrations setup, config, health check + e2e test
   - `docker-compose.yml` runs one Postgres container. `POSTGRES_DB=echo_dev` creates the dev DB.
   - `docker/init-test-db.sql` (mounted into `/docker-entrypoint-initdb.d/`) creates `echo_test`.
     Note: init scripts only run when the data volume is first created. If the volume
     already exists, create `echo_test` manually or recreate the volume.
   - `.env` points at `echo_dev`, `.env.test` points at `echo_test`. Both are gitignored.
     Commit `.env.example` covering both.
   - Test setup: abort unless the DB name ends in `_test`; run migrations on `echo_test`
     before e2e tests; clean tables between tests.
   - Acceptance criteria:
     - `docker compose up -d` gives two databases, `echo_dev` and `echo_test`
     - `npm run migration:run` migrates `echo_dev`; the test equivalent migrates `echo_test`
     - `GET /health` returns 200 and the e2e test for it passes against `echo_test`
     - Pointing the test setup at `echo_dev` makes it abort with the guard's own
       error message (the user verifies this by hand)
2. Entities + first migration + seed script (admin from env, the 6 teams and example people for dev)
   - Make sure Entities and migration match each other and running migration has no error
   - Make sure the seed throws no error and would accomodate for testing  
3. Auth: login, JWT guard that loads the user per request, roles guard, `GET /me`,
   change-password, `must_change_password` and `is_active` enforcement
   - Decisions: `@nestjs/jwt` only (no Passport); global default-deny guard with
     `@Public()` opt-out; 401 = not authenticated, 403 = authenticated but not allowed.
   - Login and token
     - `POST /auth/login` returns 200 `{ accessToken }`
     - Payload is `sub` (user id), `iat`, `exp` only: no role, email, or hash
     - Wrong password, unknown email, and inactive user all give the same 401
   - Access control
     - Only `/health` and `/auth/login` are public; every other route without a valid
       token (missing, malformed, expired, tampered) gives 401
     - A deactivated user's old token gives 401
     - A role change in the DB applies on the next request with the same token
     - `@Roles(ADMIN)` route: 403 for PEMBINA and MEMBER, 200 for ADMIN
   - Idle session (15 minutes)
     - `JWT_EXPIRES_IN` defaults to `15m`
     - Each authenticated response carries a fresh token in `X-Access-Token`
     - A token older than 15 minutes gives 401
   - `must_change_password`
     - Every route except `POST /auth/change-password` and `GET /me` gives 403 with
       code `PASSWORD_CHANGE_REQUIRED`
   - `GET /me`
     - Returns id, name, email, role, `must_change_password`, memberships
       `[{ teamId, teamName, isLeader }]`; never the password hash
   - `POST /auth/change-password` body `{ currentPassword, newPassword }`
     - Wrong current password: 401
     - New password under 8 characters, or same as current: 400
     - Success: 204, `must_change_password` becomes false, the old password stops working
4. User management (admin)
5. Teams + membership + leader flag
6. Services CRUD with soft delete (ADMIN or any team leader)
7. Assignments: candidates, assign (first-claim-wins), unassign, including the concurrency test
8. Schedule views: `/me/schedule`, `/services`, `/teams/:id/members`

## Status
- [x] 1. Scaffold
- [x] 2. Entities + migration + seed
- [x] 3. Auth
- [ ] 4. User management
- [ ] 5. Teams + membership
- [ ] 6. Services
- [ ] 7. Assignments
- [ ] 8. Schedule views