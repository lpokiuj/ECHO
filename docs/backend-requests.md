
## Machine-readable error codes for PATCH /users/:id 400s (feature 8)
- Two 400 responses have only a plain English `message` string and no field name or `code`: changing your own role/isActive, and making a team leader PEMBINA. The frontend can't tell them apart without parsing English text, so it shows one combined Indonesian sentence. Request: add an error `code` (like the other coded errors) to each. Priority: low.

## Error codes and role on team membership (feature 9)
- `PUT /teams/:id/members/:userId` 400s (PEMBINA as leader, inactive user) and `POST/PATCH /teams` 409 (duplicate name) have no `code` or field name; the roster has no `role` per member. The frontend maps by request context. Request: add error `code`s, and `role` to the roster rows. Priority: low.


## Server-side pagination (later)
- Every list endpoint returns the whole collection and the web app paginates client-side (10 per page). If lists grow large, server pagination (page/limit plus a total) will be needed on `GET /users`, `/teams`, `/teams/:id/members`, `/services` and `/me/schedule`. Not needed now.

## Availability and attendance (features 9 and 10, shipped in the API)
Web work, no API change needed, using `docs/api/availability.md` and `attendance.md`:
- Schedule: availability toggle per service (`PUT/DELETE /services/:id/unavailability`, `unavailable` flag on `GET /services`, `GET /me/unavailability`). Handle `409 ALREADY_ASSIGNED` and `SERVICE_ALREADY_STARTED`.
- `CandidateList`: show `unavailable: true` members as not selectable. `ResultPanel`: a `skipped[].reason` of `UNAVAILABLE`. New Indonesian texts for these and the new error codes go in `apps/web/src/lib/messages.ts`.
- Attendance: leader picks the absent-taker; the taker records absences after start; member sees `GET /me/absences`; leader/ADMIN see `GET /teams/:teamId/absences`. New error codes: `SERVICE_NOT_STARTED`, `CANNOT_MARK_SELF`, `HAS_ATTENDANCE_RECORDS`.

## Attendance read for the taker screen (feature 12, web)
- The taker cannot see which absences are already recorded for a service: only `GET /me/absences` and `GET /teams/:teamId/absences` (counts) exist. After a reload the Kehadiran switches start off even if absences were recorded; the web keeps them session-local and says so. Request: `GET /services/:id/teams/:teamId/absences` returning the recorded user ids (taker, leader and ADMIN). Priority: medium.

## Docs mismatch: `/me/schedule` fields (schedule.md)
- The field table of `GET /me/schedule` lists `unavailable` (always false) but the example JSON omits it, and the example has `isAbsentTaker` while the table does not. The web types both as optional and reads `isAbsentTaker` only from `GET /services`. Please make example and table agree (and confirm the real response).
