# Feature 10: Attendance (absent-taker and miss counter)

Status: planned. Build in its own session, after Feature 9. Read `apps/api/CLAUDE.md` and
`apps/api/PLAN.md` first.

## Goal
For each service, each team leader picks ONE volunteer assigned (by that team) to the service as
the "absent-taker". That volunteer records which of their team's volunteers did not attend.
The system keeps a per-member count of missed services.

## Decisions (confirmed)
- One absent-taker per team per service. ADMIN can override.
- Recording opens only after the service has started (`starts_at <= now`); before that,
  409 `SERVICE_NOT_STARTED`.
- Miss counter is DERIVED: `COUNT(*)` over absence rows. No stored counter, no drift.
- Only recorded absences count. If the taker never submits, nothing is counted.

## Data
- `service_assignments.is_absent_taker boolean NOT NULL DEFAULT false`, with a partial unique
  index `(service_id, team_id) WHERE is_absent_taker`.
- New entity `ServiceAbsence`: `service_id`, `user_id`, `team_id`, `recorded_by`,
  `created_at`. Unique `(service_id, user_id)`; FK to the assignment row. Register in `ENTITIES`.
- Migration via `migration:generate`; check SQL; second generate says "No changes".

## Endpoints
- `PUT /services/:id/teams/:teamId/absent-taker` body `{ userId }`: ADMIN or leader of
  `:teamId` (existing `TeamLeaderGuard`). Target must be assigned by that team. Replaces the
  previous taker in a single statement (no check-then-insert).
- `PUT /services/:id/teams/:teamId/absences/:userId` and `DELETE` same path: caller is that
  team's absent-taker or ADMIN. Target must be assigned by that team. 409 `SERVICE_NOT_STARTED`
  before start. PUT idempotent.
- `GET /me/absences`: `{ count, items: [{ serviceId, title, startsAt }] }`.
- Leaders and ADMIN can read the count per member of their team (shape to settle in the spec
  pass; likely extend candidates or add `GET /teams/:teamId/absences`).
- Errors: 404 unknown service/team (403 for non-admin on unknown team, existing convention),
  400 non-UUID ids, 403 for non-taker. Check order: 401, 403, 404, 400/409.

## Edge cases to settle when writing the final spec
- Can the taker mark themselves absent? (suggest: no, 400).
- Unassigning a taker clears the role and any absences they recorded stay.
- Past services where no taker was designated: ADMIN can still record.
- Soft-deleted services: suggest still counted.

## Tests
`apps/api/test/attendance.e2e-spec.ts`: 401/403 matrix, taker uniqueness and replacement
(including a concurrency test for two simultaneous designations), recording before/after start,
non-assigned target rejected, derived count correct, idempotent PUT.

## Docs to update
`docs/api/` new `attendance.md`, `schedule.md`, `permissions.md`, `flows.md`, README index,
`apps/api/PLAN.md`. Web requests in `docs/backend-requests.md`.

Commit: `feat(attendance): ...` (only when the user asks).
