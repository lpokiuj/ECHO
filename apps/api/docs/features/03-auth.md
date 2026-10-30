# Feature 3: Auth

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
