# Auth

Conventions (error bodies, token renewal, dates) are in [README.md](README.md).

## POST /auth/login
Exchange email + password for an access token.

- **Who:** public (no token).
- **Body:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | yes | valid email; **case-insensitive match** (`ADMIN@echo.local` logs in as `admin@echo.local`) |
| `password` | string | yes | length >= 1 |

- **Success:** `200`. No `X-Access-Token` header on this response; use `accessToken` from the body.
```json
{"accessToken":"<accessToken>"}
```
- **Errors:**

| Status | Condition | Body |
|---|---|---|
| 400 | Missing/invalid fields | `{"message":["email must be an email","password must be longer than or equal to 1 characters"],"error":"Bad Request","statusCode":400}` |
| 400 | Malformed JSON | see README |
| 429 | Too many attempts: more than 5 (`LOGIN_RATE_LIMIT`) on the same email from the same IP within 15 minutes. Wait 15 minutes from the first attempt | `{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}` (plus a `Retry-After` header) |
| 401 | Unknown email, wrong password, **or deactivated user** (indistinguishable on purpose) | `{"message":"Unauthorized","statusCode":401}` |

Login succeeds even when `mustChangePassword` is true; call `GET /me` next to find out.

## GET /me
Profile of the logged-in user: role, whether a password change is pending, and team memberships
(this is how the frontend knows who is a team leader).

- **Who:** any authenticated user, **even while a password change is required**.
- **Success:** `200`
```json
{
  "id": "d50ed778-821b-47f1-8992-475f525b4097",
  "name": "Docs Example Lead A",
  "email": "docs-example-lead-a@echo.local",
  "role": "MEMBER",
  "mustChangePassword": false,
  "memberships": [
    { "teamId": "d582b5a4-4814-4e8b-9f2a-f21c8a956e35", "teamName": "docs-example-team-a", "isLeader": true }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name`, `email` | string | |
| `role` | `ADMIN` \| `PEMBINA` \| `MEMBER` | |
| `mustChangePassword` | boolean | `true` -> force the change-password screen |
| `memberships` | array | ordered by `teamName`; `[]` for ADMIN/PEMBINA with no teams |
| `memberships[].teamId`, `teamName` | uuid, string | |
| `memberships[].isLeader` | boolean | show the assign screen for teams where this is `true` |

The password hash is never returned. Example for a user in two teams (real, `agner@echo.local`):
`"memberships":[{"teamId":"77256f56-...","teamName":"Sound","isLeader":false},{"teamId":"0f48fdb4-...","teamName":"Usher","isLeader":true}]`.

- **Errors:** `401` (missing, malformed, expired token or deactivated user).

## POST /auth/change-password
Change the caller's own password. Clears `mustChangePassword`.

- **Who:** any authenticated user, **even while a password change is required**.
- **Body:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `currentPassword` | string | yes | length >= 1 |
| `newPassword` | string | yes | length >= 8; must differ from `currentPassword` |

- **Success:** `204`, empty body. Response carries `X-Access-Token`.
  The same token keeps working (the token does not encode the password), so you can continue
  without logging in again. Other devices' tokens also keep working until they expire.
- **Errors:**

| Status | Condition | Body |
|---|---|---|
| 400 | Validation (missing fields, `newPassword` < 8) | `{"message":["newPassword must be longer than or equal to 8 characters"],"error":"Bad Request","statusCode":400}` |
| 400 | New equals current | `{"message":"New password must differ from the current password","error":"Bad Request","statusCode":400}` |
| 401 | **Wrong `currentPassword`** | `{"message":"Unauthorized","statusCode":401}` |
| 401 | Missing/expired token | same body |

**The two 401 causes look identical.** Treat a 401 here as "wrong current password" only if you
just held a valid token (you did a request moments ago); otherwise go to login.
