# Echo

Echo is the volunteer scheduling portal for Echo Youth GLC. Service schedules used to be
announced in a WhatsApp group: volunteers could not look up their own schedule and team leads
assigned people by message. In Echo, a team leader assigns volunteers from their team to a
service, and the volunteer sees it when they log in.

Global roles are ADMIN, PEMBINA (reads all schedules and manages services) and MEMBER. "Team
leader" is not a role: it is a flag on a person's membership of a team.

## Repository layout

| Path | What |
| --- | --- |
| `apps/api` | NestJS + TypeORM + Postgres backend ([README](apps/api/README.md)) |
| `apps/web` | Vite + React volunteer portal, Indonesian UI, served under `/volunteer-portal/` ([README](apps/web/README.md)) |
| `apps/public` | Vite + React public website (home, `/doa`, `/relawan`), Indonesian UI, no login ([README](apps/public/README.md)) |
| `docs/` | API contract, feature specs, backend requests, archive ([index](docs/README.md)) |
| `docker-compose.yml`, `docker/` | Postgres for dev and tests (creates `echo_dev` and `echo_test`) |
| `.env.example` | Template for `.env` and `.env.test` (both gitignored) |

This is an npm workspaces monorepo with a single root `package-lock.json`.

## Prerequisites

- Node.js and npm
- Docker with the Compose plugin
- Developed on WSL (Ubuntu). Keep the repo in the Linux filesystem (`~/code/echo`), not under
  `/mnt/c`.

## Setup

```bash
cp .env.example .env          # development, database echo_dev
cp .env.example .env.test     # then set DB_NAME=echo_test in it (tests only)
npm install                   # once, at the repo root; installs all apps
npm run db:up                 # Postgres; creates echo_dev and echo_test
npm run migration:run -w @echo/api   # first time only
npm run seed -w @echo/api     # dev data; insert-only, safe to re-run; refuses production
                              # and any database other than echo_dev
npm run dev:api               # http://localhost:3000 (PORT overrides)
npm run dev:web               # http://localhost:5173/volunteer-portal/, proxies /api to the API
npm run dev -w @echo/public   # http://localhost:5174/, proxies /api to the API
```

The browser tests of the portal and of the public site also need `npx playwright install chromium`
once and some `E2E_*` variables; see [apps/web/README.md](apps/web/README.md) and
[apps/public/README.md](apps/public/README.md).

## Running locally

Start in this order; each step needs the one before it.

| # | What | Command (repo root) | Dev URL |
| --- | --- | --- | --- |
| 1 | Database (Postgres in Docker) | `npm run db:up`, then once `npm run migration:run -w @echo/api` | `localhost:5432` (internal) |
| 2 | Backend (apps/api) | `npm run dev:api` | http://localhost:3000 |
| 3 | Portal (apps/web) | `npm run dev:web` | http://localhost:5173/volunteer-portal/ |
| 4 | Public site (apps/public) | `npm run dev -w @echo/public` | http://localhost:5174/ |

Env files (copy from the template, names only; values are never in this README):

- `.env` at the repo root, copied from `.env.example`: the database and the backend (step 1 and 2).
  `.env.test`, also copied from `.env.example`, is used only by the API tests.
- `apps/web/.env.example`: the portal's variables (copy to a local env file in `apps/web` only if
  you need to override a default).
- `apps/public/.env.example`: the public site's variables (the API proxy target, the portal URL the
  footer links to, and the `E2E_*` names for its browser tests). `apps/public/.env.development`
  is checked in and points the footer link at the portal's dev server.

Both frontends run on their own Vite port and proxy `/api` to the backend, so the browser stays
same-origin. The public site's link to the portal comes from `VITE_PORTAL_URL` (default
`/volunteer-portal/`).

### Production route map (not yet configured)

Nothing below is configured: there is no production reverse proxy in this repository yet. This is the
planned routing:

| Path | Served by |
| --- | --- |
| `/` | apps/public (home) |
| `/doa` | apps/public |
| `/relawan` | apps/public |
| `/volunteer-portal/*` | apps/web |
| `/api/*` | apps/api |

Also not done: the backend does not yet trust the proxy, so behind a reverse proxy the rate limit on
the public forms would see the proxy's IP address instead of the visitor's.

## Root scripts

| Command | What it does |
| --- | --- |
| `npm run dev:api` | API in watch mode |
| `npm run dev:web` | Portal dev server |
| `npm run build` | Build the API, then the web app |
| `npm run lint` | Lint both apps |
| `npm test` | Unit tests of both apps |
| `npm run test:e2e` | API e2e tests (needs `npm run db:up`; builds first and applies pending migrations to the test DB) |
| `npm run check` | API lint and unit tests, plus the web check; run before a commit |
| `npm run db:up` / `npm run db:down` | Start / stop the Postgres container |

The root scripts cover `apps/api` and `apps/web` only: `build`, `lint`, `test` and `check` do not
run anything for `apps/public`, and there is no root `dev` script for it. Run its scripts with
`npm run <script> -w @echo/public` (for example `check`, `build`, `e2e`) or from `apps/public`.
Any app script can likewise be run with `-w @echo/api` or `-w @echo/web`, or from inside the app
directory.

## Documentation

Start at [docs/README.md](docs/README.md). The API contract used by the frontend is
[docs/api/README.md](docs/api/README.md).
