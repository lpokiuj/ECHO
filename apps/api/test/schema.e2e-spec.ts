import { DataSource } from 'typeorm';
import { cleanDatabase, createTestApp } from './utils/test-app.js';
import { INestApplication } from '@nestjs/common';

describe('database schema (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(ds);
  });

  afterAll(async () => {
    await app.close();
  });

  async function insertUser(email: string, role = 'MEMBER') {
    const [row] = await ds.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('n', $1, 'x', $2) RETURNING id`,
      [email, role],
    );
    return row.id as string;
  }

  async function insertService(createdBy: string) {
    const [row] = await ds.query(
      `INSERT INTO services (title, starts_at, ends_at, created_by)
       VALUES ('s', '2030-01-06T03:00:00Z', '2030-01-06T05:00:00Z', $1) RETURNING id`,
      [createdBy],
    );
    return row.id as string;
  }

  it('entities match the migrations (no schema drift)', async () => {
    const sql = await ds.driver.createSchemaBuilder().log();
    expect(sql.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('rejects a duplicate email', async () => {
    await insertUser('a@echo.test');
    await expect(insertUser('a@echo.test')).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('rejects an unknown role', async () => {
    await expect(insertUser('b@echo.test', 'SUPERUSER')).rejects.toMatchObject({
      code: '22P02',
    });
  });

  it('rejects a duplicate team name', async () => {
    await ds.query(`INSERT INTO teams (name) VALUES ('Worship')`);
    await expect(
      ds.query(`INSERT INTO teams (name) VALUES ('Worship')`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects a service that ends before or when it starts', async () => {
    const admin = await insertUser('c@echo.test');
    await expect(
      ds.query(
        `INSERT INTO services (title, starts_at, ends_at, created_by)
         VALUES ('s', '2030-01-06T05:00:00Z', '2030-01-06T05:00:00Z', $1)`,
        [admin],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('lets only one team assign a user to a service', async () => {
    const admin = await insertUser('d@echo.test');
    const volunteer = await insertUser('e@echo.test');
    const service = await insertService(admin);
    const [{ id: teamA }] = await ds.query(
      `INSERT INTO teams (name) VALUES ('A') RETURNING id`,
    );
    const [{ id: teamB }] = await ds.query(
      `INSERT INTO teams (name) VALUES ('B') RETURNING id`,
    );
    const assign = (team: string) =>
      ds.query(
        `INSERT INTO service_assignments (service_id, user_id, team_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [service, volunteer, team, admin],
      );
    await assign(teamA);
    await expect(assign(teamB)).rejects.toMatchObject({ code: '23505' });
  });

  it('deleting a user cascades their team membership', async () => {
    const user = await insertUser('f@echo.test');
    const [{ id: team }] = await ds.query(
      `INSERT INTO teams (name) VALUES ('T') RETURNING id`,
    );
    await ds.query(
      `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`,
      [team, user],
    );
    await ds.query(`DELETE FROM users WHERE id = $1`, [user]);
    const rows = await ds.query(`SELECT 1 FROM team_members WHERE team_id = $1`, [
      team,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('refuses to delete a user who created a service (RESTRICT)', async () => {
    const admin = await insertUser('g@echo.test');
    await insertService(admin);
    await expect(
      ds.query(`DELETE FROM users WHERE id = $1`, [admin]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('refuses to delete an assignment that has a recorded absence', async () => {
    const admin = await insertUser('h@echo.test');
    const volunteer = await insertUser('i@echo.test');
    const service = await insertService(admin);
    const [{ id: team }] = await ds.query(
      `INSERT INTO teams (name) VALUES ('T2') RETURNING id`,
    );
    await ds.query(
      `INSERT INTO service_assignments (service_id, user_id, team_id, assigned_by)
       VALUES ($1, $2, $3, $4)`,
      [service, volunteer, team, admin],
    );
    await ds.query(
      `INSERT INTO service_absences (service_id, user_id, team_id, recorded_by)
       VALUES ($1, $2, $3, $4)`,
      [service, volunteer, team, admin],
    );
    await expect(
      ds.query(`DELETE FROM service_assignments WHERE service_id = $1`, [
        service,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
