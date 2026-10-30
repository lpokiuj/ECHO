# CLAUDE.md

Backend for the Echo Youth GLC volunteer portal. Read PLAN.md before any task.
PLAN.md is the source of truth for scope, rules, and data model.

## Stack
NestJS 12 (ESM, relative imports end in `.js`), TypeScript, TypeORM, PostgreSQL, Docker,
Vitest, oxlint. Developed in WSL (Ubuntu).
Keep the repo in the Linux filesystem (`~/code/echo`), not under `/mnt/c`.

## Layout
- This API lives in `apps/api`. Run npm commands from here; start Claude Code sessions here.
- `docker-compose.yml`, `docker/`, `.env`, `.env.test`, `.env.example` live at the repo root (`../..`).

## Commands (edit if scripts differ)
- Start DB (creates `echo_dev` and `echo_test`), from the repo root: `docker compose up -d --wait db`
- Migration scripts build first, then run TypeORM against `dist/` (so decorator metadata is emitted)
- Migrate the test DB: `npm run migration:run:test`
- Dev server: `npm run start:dev`
- Unit tests: `npm test`
- E2E tests: `npm run test:e2e` (needs the DB container running)
- Generate migration: `npm run migration:generate -- src/migrations/<Name>`
- Run migrations: `npm run migration:run`
- Seed dev data: `npm run seed` (dev only: refuses production and any DB other than `echo_dev`;
  insert-only, safe to re-run). Edit the people in `src/database/seed-data.ts`.
- New entity: add the class to `src/database/entities.ts` (explicit list, not a glob), then
  generate a migration, READ the SQL, run it. A second `migration:generate` must say "No changes".
- `npm run test:e2e` builds first (migrations load from `dist/`)
- Lint: `npm run lint`

## Structure
- One module per feature under `src/<feature>/`
  (controller, service, dto/, entities/ as needed)
- Controllers: routing, DTO validation, guards. No business logic.
- Services: business logic and all permission-scoping rules.
- DTOs use class-validator. ValidationPipe is global with `whitelist: true`.

## Ask first (most important rule)
- If a decision is needed that PLAN.md does not settle, STOP and ask the user before
  implementing. This covers behavior, permissions, data model, API shape, new
  dependencies, and anything under "Open questions" in PLAN.md.
- Do not pick a default silently, even a sensible one. Offer 2 or 3 options with a
  recommendation and the reason, then wait for the answer.
- If a feature has no acceptance criteria in PLAN.md, ask for them before implementing.
- If a task conflicts with a domain rule in PLAN.md, stop and ask.
- When the user answers, record the decision in PLAN.md in the same commit.

## Rules
- Database changes go through migrations only. Never `synchronize: true`, in any environment.
- Never edit a migration that has already been committed. Add a new one.
- Permission checks happen server-side in guards and services. Never trust the client.
- Use the database to enforce uniqueness and races (constraints, ON CONFLICT).
  Never check-then-insert.
- Two databases: `echo_dev` (development, `.env`) and `echo_test` (tests only, `.env.test`).
  Both env files are gitignored; commit `.env.example`.
- Tests use real PostgreSQL. Do not mock the database.
- Tests run only against a database whose name ends in `_test`. Test setup must abort otherwise.
- Never run migrations, truncate, drop, or seed against any database other than the
  one the current task requires. Never run destructive SQL on `echo_dev` unless asked.
- The seed script never runs when `NODE_ENV=production`.
- Never weaken, skip, or delete an existing test to make it pass. If a test seems wrong,
  stop and explain why.
- Every acceptance criterion in PLAN.md needs a test.
- Do not add features, endpoints, or fields that are not in PLAN.md.

## Workflow
- One feature per session. Start in plan mode and present the plan before editing.
- Keep diffs small enough to read in about 15 minutes. If it grows, split the task.
- Run build, lint, and tests yourself before saying a task is done.
  Report actual output. Do not claim success without running them.
- One commit per feature, message `feat(<module>): <what>`.
- When a decision changes, update PLAN.md in the same commit.
- Tick the feature in the PLAN.md Status checklist only after tests pass.

## Don't
- Don't install new dependencies without saying why first.
- Don't refactor code outside the current feature.
- Don't put secrets in code. Use env files. The dev seed password in `.env.example`
  is for local development only.