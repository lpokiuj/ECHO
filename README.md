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
| `apps/web` | Vite + React web app, Indonesian UI ([README](apps/web/README.md)) |
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
npm install                   # once, at the repo root; installs both apps
npm run db:up                 # Postgres; creates echo_dev and echo_test
npm run migration:run -w @echo/api   # first time only
npm run seed -w @echo/api     # dev data; insert-only, safe to re-run; refuses production
                              # and any database other than echo_dev
npm run dev:api               # http://localhost:3000 (PORT overrides)
npm run dev:web               # http://localhost:5173, proxies /api to the API
```

The web browser tests also need `npx playwright install chromium` once and some `E2E_*`
variables; see [apps/web/README.md](apps/web/README.md).

## Root scripts

| Command | What it does |
| --- | --- |
| `npm run dev:api` | API in watch mode |
| `npm run dev:web` | Web dev server |
| `npm run build` | Build the API, then the web app |
| `npm run lint` | Lint both apps |
| `npm test` | Unit tests of both apps |
| `npm run test:e2e` | API e2e tests (needs `npm run db:up`; builds first and applies pending migrations to the test DB) |
| `npm run check` | API lint and unit tests, plus the web check; run before a commit |
| `npm run db:up` / `npm run db:down` | Start / stop the Postgres container |

Any app script can also be run with `npm run <script> -w @echo/api` (or `-w @echo/web`), or
from inside the app directory.

## Documentation

Start at [docs/README.md](docs/README.md). The API contract used by the frontend is
[docs/api/README.md](docs/api/README.md).
