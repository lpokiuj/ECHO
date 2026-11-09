# Backend requests (web to API)

Open requests only. Delete an item once the API ships it.

## Machine-readable error codes for PATCH /users/:id 400s (feature 8)
- Two 400 responses have only a plain English `message` string and no field name or `code`: changing your own role/isActive, and making a team leader PEMBINA. The frontend can't tell them apart without parsing English text, so it shows one combined Indonesian sentence. Request: add an error `code` (like the other coded errors) to each. Priority: low.

## Error codes and role on team membership (feature 9)
- `PUT /teams/:id/members/:userId` 400s (PEMBINA as leader, inactive user) and `POST/PATCH /teams` 409 (duplicate name) have no `code` or field name; the roster has no `role` per member. The frontend maps by request context. Request: add error `code`s, and `role` to the roster rows. Priority: low.

## A way to get a user with mustChangePassword true (web e2e)
- Since commit 63bd3be, users created with `POST /users` and users reset with `POST /users/:id/reset-password` get `mustChangePassword: false`, seeded users are `false`, and `PATCH /users/:id` ignores the flag. Nothing can set it. The web app still has the forced change page (shown for any account with the flag, and on `PASSWORD_CHANGE_REQUIRED`), but it now has unit tests only: the Playwright test `routes.spec.ts` "forced password change page at every width" was deleted (approved by the user) because it could no longer reach the page. Request: a documented way to create or seed a user whose flag is true, for example a test-only option on `POST /users`, or a documented seed user, so the page can have end-to-end coverage again. Priority: low.

## Server-side pagination (later)
- Every list endpoint returns the whole collection and the web app paginates client-side (10 per page). If lists grow large, server pagination (page/limit plus a total) will be needed on `GET /users`, `/teams`, `/teams/:id/members`, `/services` and `/me/schedule`. Not needed now.
