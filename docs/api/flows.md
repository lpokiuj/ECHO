# Screen flows and gotchas

Calls in order for each screen. Request/response shapes are in the per-area files. Every
authenticated call below also returns a fresh `X-Access-Token`; store it each time (README).

Token handling in one place: keep one `accessToken` variable. After every authenticated response,
if the header `X-Access-Token` exists, overwrite the variable.

## 1. Login -> forced password change -> home

1. `POST /auth/login` `{email, password}` -> `200 {accessToken}`.
   - `401` -> "wrong email or password" (also deactivated accounts).
2. `GET /me` with the token -> read `mustChangePassword`, `role`, `memberships`.
3. If `mustChangePassword` is `true`: show the change-password screen only.
   `POST /auth/change-password` `{currentPassword, newPassword}`.
   - `204`: continue with the **same** token; call `GET /me` again (now `false`).
   - `400` "New password must differ..." / validation array (min 8 chars) -> show field errors.
   - `401` -> current password wrong (the token is valid; you just used it).
   If any other call returns `403` with `code: "PASSWORD_CHANGE_REQUIRED"` (for example after an
   admin reset while the user was logged in), redirect here.
4. Home: choose the UI from `/me`:
   - everyone: my schedule + full schedule;
   - any membership with `isLeader: true`: the assign screen for those teams;
   - `role` `ADMIN`: admin area; `role` `ADMIN` or `PEMBINA`: service management.

## 2. My schedule
`GET /me/schedule` -> list (default: not ended). `?includePast=true` for history.
Group/format `startsAt` in WIB on the client. Empty array = nothing assigned.

## 3. Full service schedule
`GET /services` (optionally `?includePast=true`) -> services each with `assignments`
(`userId, name, teamId, teamName, notes`). Group `assignments` by `teamName` for display (already sorted
by team then name). Available to every role; no emails are included.

## 3b. Availability (member)
`GET /services` gives `unavailable` per service for the caller. Toggle with
`PUT` / `DELETE /services/{id}/unavailability` (204). `409 ALREADY_ASSIGNED` means ask the leader to
unassign first; `409 SERVICE_ALREADY_STARTED` hides the toggle. `GET /me/unavailability` lists the
marked upcoming ids. On the leader screen, candidates with `unavailable: true` are shown but not
selectable; a batch containing one returns it in `skipped` with `reason: "UNAVAILABLE"`.

## 3c. Attendance
Leader: `PUT /services/{id}/teams/{teamId}/absent-taker {userId}` (pick from the assigned
candidates). Taker, after start: `PUT` / `DELETE .../absences/{userId}` per absent volunteer
(`SERVICE_NOT_STARTED` before). Member: `GET /me/absences` for `{count, items}`. Leader/ADMIN:
`GET /teams/{teamId}/absences` for each member's miss count. ADMIN can record for any past
service. See [attendance.md](attendance.md).

## 4. Leader assign screen
Inputs: a service (from `GET /services`) and a team where `/me` says `isLeader: true`.

1. `GET /services/{serviceId}/teams/{teamId}/candidates` -> list with `assigned` flags.
   Pre-tick `assigned: true` rows (already assigned by this team). Rows held by another team are
   not in the list.
2. User ticks names -> `POST /services/{serviceId}/teams/{teamId}/assignments`
   `{userIds: [...]}` containing only the **newly ticked, not yet assigned** ids (re-sending
   assigned ones is harmless but reported as skipped).
3. Handle the `200` body:
   - `assigned`: mark these as done.
   - `skipped` with `ALREADY_ASSIGNED_THIS_TEAM`: they were already yours; mark as assigned.
   - `skipped` with `ALREADY_ASSIGNED_OTHER_TEAM`: show "already serving with
     `heldByTeam.name`" for that user. This is partial success, not an error: the others in the
     batch were assigned.
   - **After any `skipped` of the OTHER_TEAM kind, re-fetch candidates (step 1)** so the list
     drops those people.
4. Unassign: `DELETE /services/{serviceId}/teams/{teamId}/assignments/{userId}` -> `204`;
   then update the row (`assigned: false`; the person is selectable again, and other teams can
   claim them). `404 Assignment not found` -> already removed (or held by another team): re-fetch.
5. Errors on this screen:

| Response | Meaning | UI |
|---|---|---|
| `409 SERVICE_ALREADY_STARTED` (assign or unassign) | the service began | lock the screen (read-only); candidates still load |
| `400 INVALID_USERS` + `invalidUserIds` | stale list: someone left the team or was deactivated | re-fetch candidates, nothing was inserted |
| `403` | not (or no longer) the leader of this team | leave the screen; refresh `/me` |
| `404 Service not found` | service deleted | back to the schedule |
| `400` body validation | sent empty/over 100/invalid ids | client bug |

6. ADMIN can open the same screen for any team. To remove someone held by another team, ADMIN uses
   that team's `teamId` (from `heldByTeam.id` or the `GET /services` assignment) in the DELETE path.

## 5. Admin flows (ADMIN)

**Create a user**: `POST /users {name, email, role?}` -> `201`. Tell the person the shared default
password out of band; they must change it at first login. `409` = email taken.

**Reset a password**: `POST /users/{id}/reset-password` -> `204`. The user's open sessions get
`PASSWORD_CHANGE_REQUIRED` on their next call.

**Edit / deactivate a user**: `PATCH /users/{id}` (any of name, email, role, isActive). An admin
cannot change their own role or `isActive` (400). Making a team leader a PEMBINA is 400: remove
the leader flag first (`PUT` with `isLeader:false`).

**Create a team**: `POST /teams {name}` -> `201`; `409` name taken. List with `GET /teams`;
rename with `PATCH /teams/{id}`.

**Add a member and set leader**: `PUT /teams/{teamId}/members/{userId}` with `{}` (plain member)
or `{"isLeader": true}`. Same call changes the flag later. Remember: **omitting `isLeader`
resets it to false**, so always send the intended value when editing. Roster:
`GET /teams/{teamId}/members`. Errors: inactive user 400; PEMBINA as leader 400; unknown 404.

**Remove a member**: `DELETE /teams/{teamId}/members/{userId}` -> `200 {removedAssignments:[...]}`.
Those are the **future** services this user lost **from this team**; show them to the admin
("Removed from 2 upcoming services: ..."). Past/started assignments stay; assignments made by
other teams stay.

**Services (ADMIN or PEMBINA)**:
- Create: `POST /services {title, startsAt, endsAt}` with offsets (e.g. `+07:00`). Must start in
  the future.
- Edit: `PATCH /services/{id}` with only the changed fields. Existing assignments are kept when the
  time changes. A started service can only have title/`endsAt` changed; do **not** resend its old
  `startsAt`.
- Delete: `DELETE /services/{id}` -> `204` (soft delete). Remove it from your local lists.
  Re-fetch `GET /services` afterwards.

## Gotchas

1. **Leader/role/active changes apply on the next request**, with the same token. After an admin
   demotes someone or removes their leader flag the next assign call is 403; after a deactivation
   it is 401. Refresh `GET /me` after any 403 on a leader screen.
2. **Soft-deleted services are 404** on `PATCH`, `DELETE`, and all three assignment routes, and
   vanish from `GET /services` (verified, also with `includePast=true`) and `/me/schedule` (code).
3. **401 on change-password can mean "wrong current password"**, not an expired session.
4. **PASSWORD_CHANGE_REQUIRED beats role checks**: a flagged non-admin hitting an admin route gets
   `PASSWORD_CHANGE_REQUIRED`, not a plain 403.
5. **`X-Access-Token` must be read from every authenticated response** (including errors), and the
   server needs CORS exposing it; CORS is not configured yet (see README).
6. **Timezones:** send `+07:00` or `Z`; never a bare local time. `2026-12-06T09:00:00+07:00` ->
   `2026-12-06T02:00:00.000Z`. Sunday 10:00 WIB is `03:00Z` (the seeded services). Format in
   `Asia/Jakarta` on the client; a service whose UTC date differs from its WIB date is possible
   for times before 07:00 WIB.
7. **"Started" vs "ended":** assign/unassign are blocked once `startsAt <= now` (409), but
   schedules keep showing a service until `endsAt` passes.
8. **`skipped` is not an error.** A fully-skipped assign is still `200`.
9. **Candidate list hides people held by another team**, and does not include inactive users. A
   user in two teams disappears from the second team's list once the first assigns them.
10. **Validation `message` can be an array or a string.** Normalise before displaying.
    `error` is sometimes absent; use the HTTP status.
11. **Unknown properties are silently ignored** (a typo in a field name does not fail).
12. **`PUT /teams/:id/members/:userId` without `isLeader` sets it to `false`.**
13. **Names are not trimmed** on users; titles and team names are.
14. Login email matching is case-insensitive (emails are stored lowercase); `Authorization` scheme must be exactly `Bearer`.
15. Tokens are not revoked: a password change or reset does not log out other devices.
16. `GET /services` items have `id`; `GET /me/schedule` items have `serviceId`.
17. Deleting users or teams is not possible; deactivate users instead.
18. **Unavailable users are skipped, not rejected**: `reason: "UNAVAILABLE"` in `skipped`, and the
    candidate keeps `unavailable: true` until they unmark themselves.
19. **Absences are history**: removing a member or unassigning someone with a recorded absence is
    `409 HAS_ATTENDANCE_RECORDS`.
