# Web task: use the new attendance read endpoint

Start Claude Code in `apps/web` (read its CLAUDE.md and PLAN.md first). Do not edit `apps/api`.
Delete this file when done.

The API now ships `GET /services/:id/teams/:teamId/absences` (committed on branch `ci-workflow`,
see `docs/api/attendance.md`). It returns `{ "userIds": ["..."] }`: the users that team already
recorded absent for that service. Access: that team's absent-taker, its leader, ADMIN (403 otherwise).
Works before and after the service starts.

## Do
1. `src/api/types.ts`: add the `{ userIds: string[] }` response type.
2. `src/api/client.ts`: add `getServiceTeamAbsences(serviceId, teamId)` next to `recordAbsence`/`clearAbsence`.
3. `src/features/attendance/useAttendance.ts`: add a `useQuery` hook for it. Make the record/clear
   mutation (`useRecordAbsence`) update or invalidate that query.
4. `src/features/attendance/RecordAbsences.tsx` (~line 62): replace the session-local
   `useState` set with the query data as the source of truth. Remove the "session-local" comment
   and the on-screen warning that says switches reset after reload.
5. Update `src/features/attendance/attendance.test.tsx` for the new call, and run the web checks
   (`npm run check -w @echo/web` or the app's own scripts).
6. Delete the "Attendance read for the taker screen" item from `docs/backend-requests.md` if it
   still appears (the API commit already removed it).

Do not commit unless asked.
