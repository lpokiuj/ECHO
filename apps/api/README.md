# Echo API

NestJS + TypeORM + Postgres backend for Echo, the volunteer scheduling app: auth, users,
teams, services, assignments and schedule views.

## Setup

From the repo root:

```
cp .env.example .env        # also create .env.test (see .env.example)
docker compose up -d --wait db
```

Then install once at the repo root (`npm install`, npm workspaces) and, in `apps/api`
(or from the root with `npm run <script> -w @echo/api`):

```
npm run migration:run
npm run seed                # dev only: creates the first ADMIN
npm run start:dev
```

## Scripts

- `npm run build` / `start:dev` / `start:prod`
- `npm run lint`, `npm run format`
- `npm test` (unit), `npm run test:e2e` (needs the DB container; run `npm run migration:run:test` first)
- `npm run migration:generate -- src/migrations/<Name>`, `migration:run`, `migration:revert`

## Docs

- [docs/api/README.md](../../docs/api/README.md): API guide for frontend developers
- [CLAUDE.md](CLAUDE.md): conventions and commands
- [PLAN.md](PLAN.md), [docs/archive/features/](../../docs/archive/features/): finished feature specs
