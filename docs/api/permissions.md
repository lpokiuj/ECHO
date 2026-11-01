# Permission matrix

Verified by calling a running server (current code) with real accounts, using requests that make
the handler fail with a harmless 4xx *after* the guards (unknown id or empty body), so "allowed"
means "passed all guards". Accounts used: no token; MEMBER = `giana@echo.local` (plain Worship
member); leader = `livana@echo.local` (leader of Worship only); PEMBINA = `petrus@echo.local`;
ADMIN = the seeded admin. All had `mustChangePassword: false`.
Script used: a curl loop over the 22 routes (status codes only). Where an e2e test also proves
the cell it is named.

Legend: **ok** = allowed (guards pass); 401; 403. A user with `mustChangePassword: true` gets 403
`PASSWORD_CHANGE_REQUIRED` on everything except `GET /me` and `POST /auth/change-password`,
regardless of role.

## Routes with a fixed rule

| # | Endpoint | No token | MEMBER | Leader | PEMBINA | ADMIN |
|---|---|---|---|---|---|---|
| 1 | `GET /health` | ok | ok | ok | ok | ok |
| 2 | `POST /auth/login` | ok | ok | ok | ok | ok |
| 3 | `POST /auth/change-password` | 401 | ok | ok | ok | ok |
| 4 | `GET /me` | 401 | ok | ok | ok | ok |
| 5 | `GET /services` | 401 | ok | ok | ok | ok |
| 6 | `GET /me/schedule` | 401 | ok | ok | ok | ok |
| 7 | `POST /services` | 401 | 403 | 403 | ok | ok |
| 8 | `PATCH /services/:id` | 401 | 403 | 403 | ok | ok |
| 9 | `DELETE /services/:id` | 401 | 403 | 403 | ok | ok |
| 10 | `POST /users` | 401 | 403 | 403 | 403 | ok |
| 11 | `GET /users` | 401 | 403 | 403 | 403 | ok |
| 12 | `PATCH /users/:id` | 401 | 403 | 403 | 403 | ok |
| 13 | `POST /users/:id/reset-password` | 401 | 403 | 403 | 403 | ok |
| 14 | `POST /teams` | 401 | 403 | 403 | 403 | ok |
| 15 | `GET /teams` | 401 | 403 | 403 | 403 | ok |
| 16 | `GET /teams/:id/members` | 401 | 403 | 403 | 403 | ok |
| 17 | `PATCH /teams/:id` | 401 | 403 | 403 | 403 | ok |
| 18 | `PUT /teams/:id/members/:userId` | 401 | 403 | 403 | 403 | ok |
| 19 | `DELETE /teams/:id/members/:userId` | 401 | 403 | 403 | 403 | ok |

"Leader" here means a leader of any team: leaders have no extra rights on routes 1-19 (a leader of
a team still gets 403 on `GET /teams/:id/members` for their own team; e2e `test/teams.e2e-spec.ts`
"returns 403 for the leader of that very team"). PEMBINA can never be a leader.

## Assignment routes (team-scoped)

Applies identically to routes 20 `GET .../candidates`, 21 `POST .../assignments`,
22 `DELETE .../assignments/:userId`. The "Leader of this team" and "Leader of another team"
columns are the same account (`livana`, leader of Worship) calling Worship or Usher.

| Caller | `:teamId` is | Result |
|---|---|---|
| No token | any | 401 |
| MEMBER (plain, also a plain member of that team) | any | 403 |
| Leader of **this** team | the team | ok (verified) |
| Leader of **another** team | other team | 403 |
| Any non-admin | unknown or malformed uuid | 403 |
| PEMBINA | any | 403 |
| ADMIN | any existing team | ok |
| ADMIN | unknown team | 404 `Team not found` (after service lookup) |
| ADMIN | malformed uuid | 400 |

Leadership is read from the database on every request. Demoting a leader (verified live):
the next call is 403 even with the same token.

## Cells not verified
None of the cells above is unverified. Not covered by this matrix: behaviour after the
15-minute idle expiry (e2e `test/auth.e2e-spec.ts` "rejects missing, malformed, tampered and
expired tokens with 401" proves 401; not reproduced live) and a leader who is also ADMIN (not a
case the data model prevents; ADMIN rules win, **code**).
