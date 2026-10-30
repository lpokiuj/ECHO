# Feature 4: User management

4. User management (admin)
   - Scope: users only. Teams and the leader flag are feature 5; services are feature 6.
   - All routes are ADMIN only (PEMBINA and MEMBER get 403, no token gets 401)
   - `POST /users` body `{ name, email, role? }`: 201, role defaults to MEMBER, password is
     `DEFAULT_USER_PASSWORD`, `mustChangePassword` true, never returns the hash.
     Duplicate email: 409 (from the unique constraint)
   - `GET /users`: all users ordered by name, no hash, no memberships
   - `PATCH /users/:id` any of `{ name, email, role, isActive }`: 200, 404 unknown id,
     409 duplicate email. An admin changing their own role or `isActive`: 400
     (own name and email are editable). Role and deactivation take effect on the next request.
   - `POST /users/:id/reset-password`: 204, password becomes `DEFAULT_USER_PASSWORD`,
     `mustChangePassword` true, old password stops working
   - `:id` must be a UUID (400 otherwise)

Addition (2026-10-31, after this feature shipped; code change pending):
- `PATCH /users/:id` with `role: PEMBINA` is 400 while the user has `is_leader = true` on any
  team (PEMBINA can never be a team leader). The admin removes the leader flag first (feature 5).
  Test: a leader cannot be set to PEMBINA; the same user can once the flag is removed.
