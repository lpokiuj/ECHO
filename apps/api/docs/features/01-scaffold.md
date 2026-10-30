# Feature 1: Scaffold

1. Scaffold: NestJS, TypeORM, Postgres in Docker, migrations setup, config, health check + e2e test
   - `docker-compose.yml` runs one Postgres container. `POSTGRES_DB=echo_dev` creates the dev DB.
   - `docker/init-test-db.sql` (mounted into `/docker-entrypoint-initdb.d/`) creates `echo_test`.
     Note: init scripts only run when the data volume is first created. If the volume
     already exists, create `echo_test` manually or recreate the volume.
   - `.env` points at `echo_dev`, `.env.test` points at `echo_test`. Both are gitignored.
     Commit `.env.example` covering both.
   - Test setup: abort unless the DB name ends in `_test`; run migrations on `echo_test`
     before e2e tests; clean tables between tests.
   - Acceptance criteria:
     - `docker compose up -d` gives two databases, `echo_dev` and `echo_test`
     - `npm run migration:run` migrates `echo_dev`; the test equivalent migrates `echo_test`
     - `GET /health` returns 200 and the e2e test for it passes against `echo_test`
     - Pointing the test setup at `echo_dev` makes it abort with the guard's own
       error message (the user verifies this by hand)
