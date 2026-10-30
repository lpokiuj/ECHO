# Feature 6: Services CRUD with soft delete (ADMIN, PEMBINA)

Scope: create, edit, and delete services only. No listing endpoint (feature 8) and no
assignment endpoints (feature 7). Tests insert assignment rows directly as fixtures.
Team leaders can read services (feature 8) but cannot create, edit, or delete them.

## Access
- `POST /services`, `PATCH /services/:id`, `DELETE /services/:id` are ADMIN or PEMBINA.
- Everyone else gets 403: MEMBER, and team leaders (a leader of any team,
  including a leader who created nothing). No token: 401.
- `:id` must be a UUID (400 otherwise).

## POST /services
- Body `{ title, startsAt, endsAt }`. `title` is trimmed, 1 to 150 characters.
- `startsAt` and `endsAt` must be ISO 8601 with an explicit offset or `Z`. A value without
  a timezone is 400.
- `endsAt` must be after `startsAt`, else 400 (validated in code; the CHECK constraint is
  the backstop and must never surface as a 500).
- `startsAt` must be after now, else 400. A service cannot be created in the past. Reading
  past services is unaffected (feature 8).
- 201 `{ id, title, startsAt, endsAt, createdBy, createdAt }`, `createdBy` is the caller.
- Timezone: input `2026-11-01T09:00:00+07:00` is stored as the same instant and returned
  as `2026-11-01T02:00:00.000Z`. Test it.

## PATCH /services/:id
- Body is any non-empty subset of `{ title, startsAt, endsAt }`. Empty body: 400.
- 200 with the updated service. Unknown or deleted id: 404.
- The merged result is validated: patching only `endsAt` to a value at or before the
  existing `startsAt` is 400.
- `createdBy` and `createdAt` never change.
- Setting `startsAt` to a time at or before now is 400. Editing only the title (or only
  `endsAt`) of a service that has already started still works.
- Rule 14: changing times keeps all existing assignments. Test it.

## DELETE /services/:id
- 204. Sets `deleted_at`. The row is never physically deleted.
- Deleting again: 404. A deleted service cannot be PATCHed (404).
- Its assignment rows are untouched (no cascade).

## Schema
- No schema change expected: `services.deleted_at` already exists from feature 2.
  If the entity or migration turns out to lack something this feature needs, stop and ask.

## Tests that must exist
- Every route: 401 without a token; 403 for MEMBER and a team leader.
- ADMIN and PEMBINA each succeed on all three routes, including editing and deleting a
  service created by someone else (admin or PEMBINA).
- Validation: missing timezone, `endsAt <= startsAt`, empty title, 151-character title,
  empty PATCH body, PATCH making the merged range invalid.
- Delete sets `deleted_at`; second delete is 404; assignment rows still exist afterward.
- Time change keeps assignments.
- `POST` with `startsAt` in the past is 400. `PATCH` moving `startsAt` into the past is 400.
  `PATCH` of only the title on a started service (inserted directly as a fixture) is 200.