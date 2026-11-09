# CLAUDE.md (Echo monorepo)

npm workspaces monorepo: `apps/api` (NestJS) and `apps/web` (Vite/React). Each app has its own
CLAUDE.md and PLAN.md. Read the ones for the app you work in before any task.

- API: `apps/api/CLAUDE.md`, `apps/api/PLAN.md`
- Web: `apps/web/CLAUDE.md`, `apps/web/PLAN.md`

## Conventions
- Install once at the repo root: `npm install`. There is one lockfile (root
  `package-lock.json`); do not run `npm install` inside an app.
- Run app scripts from the app directory, or with `npm run <script> -w @echo/api|@echo/web`.
- Root scripts: `dev:api`, `dev:web`, `build`, `lint`, `test`, `test:e2e`, `check`, `db:up`,
  `db:down`.
- One `.gitignore`, at the root. Env files (`.env`, `.env.test`, from `.env.example`),
  `docker-compose.yml` and `docker/` live at the root and stay there (moving them would rename
  the compose project and orphan the `echo_pgdata` volume).
- The web app never edits `apps/api`. Backend changes it needs go in
  `docs/backend-requests.md`.
- Do not commit unless the user asks.

## Where docs live
- `docs/api/`: API contract, the source of truth for the frontend. Update it in the same
  commit as any endpoint change.
- `docs/features/`: specs and acceptance criteria for features not built yet (`NN-*.md`)
- `docs/audit-2026-11-07.md`: project audit with prioritized fixes and feature ideas
- `docs/backend-requests.md`: open requests from web to API
- `docs/archive/`: finished build logs (web DECISIONS, RUN_LOG, FINAL_REPORT) and the finished API feature specs (`archive/features/01-10`); do not edit
- `docs/README.md` indexes all of it

## Gotchas
- The web app needs vitest 5 (pinned in the root and in `apps/web`); `apps/api` still uses
  vitest 4. `npm ls` therefore reports ELSPROBLEMS for vitest 4's optional peer `msw ^2.4.9`
  against the hoisted `msw 3.x`. It is cosmetic; the real fix is moving the API to vitest 5.
- A bare `vitest` in `apps/api` runs both the `unit` and `e2e` projects (e2e needs
  `NODE_ENV=test` and the test database). Use `npm test` and `npm run test:e2e`.

## Laptop POC hosting
`./scripts/poc-up.sh` serves the app publicly from this laptop: db, migrations, API (`:3000`),
built web via `vite preview` (`:5173`, proxies `/api`) and a Cloudflare quick tunnel. It prints
the portal URL (random `*.trycloudflare.com`, changes every run, ending in `/volunteer-portal/`) and
stays in the foreground; Ctrl+C
stops everything except the db. Logs go to `.poc-logs/`. Needs Docker Desktop (WSL integration)
and `cloudflared`. Before a rerun, kill old instances: `pkill -f "dist/main"; pkill -f "vite
preview"; pkill cloudflared`. It does not seed; run `npm run seed -w @echo/api` only on a fresh
db. `preview.allowedHosts` in `apps/web/vite.config.ts` only allows `.trycloudflare.com`.
