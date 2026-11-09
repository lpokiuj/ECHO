# Public site endpoints (no login)

Three routes for the public website. **No token is needed**; a token, if sent, is ignored. They never
return a `PASSWORD_CHANGE_REQUIRED` and never carry `X-Access-Token`. Conventions:
[README.md](README.md). All request keys are camelCase. Verified by e2e tests
(`test/public-*.e2e-spec.ts`).

## GET /public/bidang
The list of bidang (teams) for the volunteer form. **200**, ordered by name, not rate limited.
```json
[{"id":"a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb","name":"Multimedia"},{"id":"aba2c1ed-b318-467b-8388-e97b051dec22","name":"Music"}]
```
Only `id` and `name`: no members, leaders or emails. Empty list is `[]`. Example not verified
against a live server.

## POST /public/prayer-requests
| Field | Type | Required | Rules |
|---|---|---|---|
| `content` | string | yes | trimmed, 1-2000 chars (whitespace-only is rejected) |
| `consent` | boolean | yes | must be exactly `true` (missing, `false`, `"true"`, `1` -> 400) |
| `name` | string | no | trimmed, max 100 |
| `contact` | string | no, **required when `wantsFollowUp` is `true`** | trimmed, 1-100 (WhatsApp number or email; no format check) |
| `wantsFollowUp` | boolean | no | default `false` |
| `website` | any | no | **honeypot**, see below |

Blank (whitespace-only) optional strings count as not sent. Unknown fields (for example `status`,
`consentAt`, `adminNote`) are dropped. The server sets the consent time itself.

## POST /public/volunteer-applications
| Field | Type | Required | Rules |
|---|---|---|---|
| `fullName` | string | yes | trimmed, 1-100 |
| `whatsapp` | string | yes | trimmed, 1-30 (no format check) |
| `consent` | boolean | yes | must be exactly `true` |
| `email` | string | no | valid email, max 255; stored lowercase |
| `bidangIds` | uuid[] | no | 0-20 ids of existing bidang (`GET /public/bidang`); duplicates are ignored |
| `availability` | string | no | max 500 |
| `message` | string | no | max 1000 |
| `website` | any | no | **honeypot**, see below |

## Responses (both POSTs)
**201** `{"ok":true}`, always, and nothing else: stored data is never echoed back.

| Status | Condition | Body |
|---|---|---|
| 400 | Validation (missing consent, missing contact with follow-up, too long, bad uuid, more than 20 ids, ...) | `{"message":["consent must be true"],"error":"Bad Request","statusCode":400}` |
| 400 | A `bidangIds` entry is well-formed but no such bidang exists (nothing is stored) | `{"message":"One or more bidangIds do not exist","error":"Bad Request","statusCode":400}` |
| 429 | More than 5 requests in 10 minutes from the same IP to the same endpoint | `{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}` plus `Retry-After` and `X-RateLimit-*` headers |

## Honeypot
Add a hidden `website` field to the form (hidden from people, `tabindex="-1"`, `autocomplete="off"`).
If it arrives with a non-blank value the server answers the same **201** `{"ok":true}` but stores
nothing. Validation runs first: an invalid body is still 400 even when `website` is filled.

## Rate limit
5 requests per 10 minutes per IP address, counted **separately for each of the two POST
endpoints**. Every request counts, including 400s and honeypot hits. `GET /public/bidang`, login and
every other route are not limited by it. The IP is the direct socket address (no `trust proxy`
setting, `X-Forwarded-For` is ignored). **Behind a proxy or tunnel that hides the visitor IP (the
laptop POC hosting) all visitors share one bucket**, so 5 submissions per endpoint per 10 minutes
in total. Counters live in memory and reset when the API restarts.

## Admin side
Reading and handling these submissions (ADMIN and PEMBINA only) is in
[admin-submissions.md](admin-submissions.md). The internal `adminNote`, `status` and handler are
never returned by any public route.

## Notes for the frontend
- There is no CORS (see README); use a same-origin proxy.
- Stored text is not sanitized: render it as text, never as HTML.
- Deleting a bidang removes it from earlier applications' interests; the applications stay.
