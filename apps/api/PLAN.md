# Echo Volunteer Portal: Backend PLAN.md

Scope: backend API only. The frontend gets its own plan later.

## Problem
Service schedules are announced in a WhatsApp group. Volunteers can't look up
their own schedule, and team leads assign people by message.

## Core action
A Ketua Bidang assigns volunteers from their bidang to a service.
The volunteer sees it when they log in.

## Roles

Global role on `users.role`:

| Role | Permissions |
|---|---|
| ADMIN | Everything: users, bidang, membership, services. Can unassign anyone. Held by the project owner and Ketua ECHO. |
| PEMBINA | Read-only: all schedules |
| MEMBER | Everyone else. Views own schedule. |

Ketua Bidang is NOT a global role. It is `is_leader = true` on a row in
`bidang_members`. A person can lead one bidang and be an ordinary member of another.

A leader of bidang B can:
- see the members of B only (not other bidang's members, even shared volunteers)
- see ALL services (they need to pick one), but only the assignments made by bidang B
- assign and unassign members of B to services, as bidang B
- create services, and edit or delete ANY service (not only their own)

## Domain rules (these are the hard part, test them)

1. A volunteer can be a member of several bidang.
2. Within ONE service, a volunteer can be assigned by only ONE bidang.
   First successful assignment wins.
3. Rule 2 is enforced by the database: `UNIQUE (service_id, user_id)` on
   `service_assignments`. Never check-then-insert (race condition).
4. Assign uses `INSERT ... ON CONFLICT (service_id, user_id) DO NOTHING RETURNING *`.
   Users missing from the returned rows are conflicts and are reported back.
   The rest of the batch still succeeds.
5. Conflict reporting: for each skipped user, look up the existing row and report
   - `ALREADY_ASSIGNED_THIS_BIDANG` if the same bidang already assigned them, or
   - `ALREADY_ASSIGNED_OTHER_BIDANG` if a different bidang did.
   Leaders do NOT see which other bidang holds them. ADMIN does.
6. Candidate list for (service, bidang) = members of that bidang minus anyone
   already assigned in that service by another bidang. The client refreshes this
   list after a conflict.
7. A bidang can only assign its own members. Enforced in the service layer, with tests.
8. No accept/decline, no status field, no capacity limit.
9. Removing a user from a bidang deletes that bidang's assignments for that user
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
- `bidang(id uuid, name unique)`
- `bidang_members(bidang_id, user_id, is_leader, created_at)` PK `(bidang_id, user_id)`
- `services(id uuid, title, starts_at, ends_at, created_by, created_at, deleted_at)`
  CHECK `(ends_at > starts_at)`
- `service_assignments(id uuid, service_id, user_id, bidang_id, assigned_by, created_at)`
  UNIQUE `(service_id, user_id)`

## API (draft)

Auth
- `POST /auth/login`
- `POST /auth/change-password`
- `GET /me` (profile, role, `must_change_password`, memberships with `is_leader`)

Admin (ADMIN)
- `POST /users`, `GET /users`, `PATCH /users/:id`, `POST /users/:id/reset-password`
- `POST /bidang`, `GET /bidang`, `PATCH /bidang/:id`
- `PUT /bidang/:id/members/:userId` (body: `is_leader`), `DELETE /bidang/:id/members/:userId`

Services (ADMIN or a leader of any bidang)
- `POST /services`, `PATCH /services/:id`, `DELETE /services/:id`

Assignments (leader of that bidang, or ADMIN)
- `GET /services/:id/bidang/:bidangId/candidates`
- `POST /services/:id/bidang/:bidangId/assignments` body `{ userIds: [] }`
- `DELETE /services/:id/bidang/:bidangId/assignments/:userId`

Views
- `GET /me/schedule` (any logged-in user)
- `GET /services`
  - ADMIN / PEMBINA: all services with all assignments
  - leaders: all services, only their own bidang's assignments
  - plain MEMBER: 403 (they use `/me/schedule`)
- `GET /bidang/:id/members` (leader of that bidang, or ADMIN)

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Stack | NestJS, TypeORM, PostgreSQL, Docker, WSL | Known tools |
| Layout | API in `apps/api` together with CLAUDE.md and PLAN.md. Compose, `docker/`, and env files at the repo root. | Docs are backend-only; frontend gets its own plan later |
| Test runner / linter | Vitest and oxlint (NestJS 12 scaffold defaults), ESM. `GET /health` is a plain controller running `SELECT 1` (200, or 503 if the DB is down). | Keep scaffold defaults; no extra dependency for health |
| Schema changes | Migrations only (details in CLAUDE.md) | Reproducible, reviewable |
| Auth | JWT carries the user id only. The auth guard loads the user from the DB on every request and checks `is_active`, `role`, and `must_change_password`. Lifetime from env `JWT_EXPIRES_IN`, default `1d`. No refresh tokens in v1. | Role, deactivation, and leadership changes take effect immediately |
| Passwords | Hashed (bcrypt). Minimum 8 characters. Admin creates accounts with a temp password, `must_change_password = true`. Admin resets. | No email service in v1 |
| IDs | uuid | No guessable ids |
| Databases | Two databases on one Postgres container: `echo_dev` and `echo_test` (rules in CLAUDE.md) | Tests wipe data, which must never touch dev data |
| Lists | No pagination in v1 | Small organization |
| Bidang membership | Only ADMIN (project owner and Ketua ECHO) can add or remove bidang members and set `is_leader`. A Ketua Bidang cannot add volunteers to their own bidang. | Membership is org-level structure, not a leader's call |
| Service management | ADMIN or a leader of any bidang can create, edit, and delete any service. | Leaders schedule their own services without waiting for ADMIN |
| Service time change | Allowed after assignments exist. No notification in v1 (planned for v2). | Notifications are out of scope for v1 |
| Candidate list | Users already assigned by this bidang are shown and marked as assigned. Users assigned by another bidang are excluded. | Leader sees their full roster for the service |
| Seed admin | `npm run seed` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env and creates one ADMIN with `must_change_password = true`. `.env.example` uses `ADMIN_EMAIL=admin@echo.local`, `ADMIN_PASSWORD=password` for local development only. The seed refuses to run when `NODE_ENV=production`. It targets `echo_dev` only; tests create their own fixtures. | A known password is acceptable on a local dev DB only if it can't reach production |

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
2. Entities + first migration + seed script (admin from env, a few sample bidang for dev)
3. Auth: login, JWT guard that loads the user per request, roles guard, `GET /me`,
   change-password, `must_change_password` and `is_active` enforcement
4. User management (admin)
5. Bidang + membership + leader flag
6. Services CRUD with soft delete (ADMIN or any bidang leader)
7. Assignments: candidates, assign (first-claim-wins), unassign, including the concurrency test
8. Schedule views: `/me/schedule`, `/services`, `/bidang/:id/members`

## Status
- [x] 1. Scaffold
- [ ] 2. Entities + migration + seed
- [ ] 3. Auth
- [ ] 4. User management
- [ ] 5. Bidang + membership
- [ ] 6. Services
- [ ] 7. Assignments
- [ ] 8. Schedule views