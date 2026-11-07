# Feature 9: Availability (member marks upcoming services unavailable)

Status: planned. Build in its own session. Read `apps/api/CLAUDE.md` and `apps/api/PLAN.md` first.

## Goal
A member can mark an upcoming service as unavailable so no team leader can assign them to it.
Default for every service (including newly created ones) is AVAILABLE: no row means available.

## Decisions (confirmed)
- Marking unavailable while already assigned: 409 `ALREADY_ASSIGNED`. The member must ask the
  leader to unassign first. No silent schedule changes.
- Candidates list still shows unavailable members, flagged `unavailable: true`, not selectable.
  Assign skips them with reason `UNAVAILABLE`.
- Only upcoming services: a started service gives 409 `SERVICE_ALREADY_STARTED`.

## Data
- New entity `ServiceUnavailability`: `service_id`, `user_id`, `created_at (timestamptz)`.
  Primary key / unique `(service_id, user_id)`. FKs `ON DELETE RESTRICT`.
- Add it to `ENTITIES` in `apps/api/src/database/entities.ts`.
- Migration via `npm run migration:generate -- src/migrations/AddServiceUnavailability`.
  Read the SQL; a second generate must say "No changes". Never edit a committed migration.

## Endpoints (any logged-in active user, acting on themselves)
- `PUT /services/:id/unavailability`: idempotent, 204. `INSERT ... ON CONFLICT DO NOTHING`,
  and the insert itself includes `WHERE NOT EXISTS (assignment for this service+user)`
  (no check-then-insert).
- `DELETE /services/:id/unavailability`: 204, idempotent (deleting a missing row is fine).
- `GET /me/unavailability`: ids of upcoming services the caller marked unavailable.
- Errors: 404 unknown or soft-deleted service; 400 non-UUID `:id`; 409 `SERVICE_ALREADY_STARTED`;
  409 `ALREADY_ASSIGNED`. Check order: 401, 403, 404, 400/409.

## Changes to existing behaviour
- `assignments.service.ts` `assign()`: add `AND NOT EXISTS (unavailability)` to the single
  INSERT ... SELECT. Leftover users are reported in `skipped` with reason `UNAVAILABLE`
  (extend `SkipReason`). Do not SELECT first to decide.
- `candidates()` raw SQL: LEFT JOIN unavailability, return `unavailable: boolean`.
- `GET /services` and `GET /me/schedule` (`schedule.service.ts`): include `unavailable` for the
  caller on each service.

## Tests (real Postgres, `apps/api/test/availability.e2e-spec.ts`)
- 401 on every route; PUT/DELETE idempotent; 404 deleted/unknown service; 400 non-UUID.
- Started service: 409 `SERVICE_ALREADY_STARTED`. Already assigned: 409 `ALREADY_ASSIGNED`.
- Candidates show `unavailable: true`; assign of an unavailable user is skipped `UNAVAILABLE`
  while the rest of the batch succeeds. New services default to available.
- Concurrency: parallel "leader assigns X" vs "X marks unavailable", 20+ iterations; never both
  an assignment row and an unavailability row for (service, X).

## Docs to update
`docs/api/assignments.md`, `schedule.md`, new `availability.md`, `permissions.md`, `flows.md`,
`docs/api/README.md` (index, route count, coded-error list), `apps/api/PLAN.md` (rules, status).
Web needs go in `docs/backend-requests.md`: schedule toggle, `CandidateList`/`ResultPanel`
messages (Indonesian text in `apps/web/src/lib/messages.ts`).

Commit: `feat(availability): ...` (only when the user asks).
