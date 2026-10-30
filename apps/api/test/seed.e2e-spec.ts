import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { nextSundayServices, runSeed } from '../src/database/run-seed.js';
import { SEED_DATA, SeedData } from '../src/database/seed-data.js';
import { UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

const options = {
  adminEmail: 'admin@echo.test',
  adminPassword: 'admin-password',
  userPassword: 'user-password',
  now: new Date('2030-01-02T00:00:00Z'), // a Wednesday
};

// Small fixture of its own, so these tests do not depend on what is typed in seed-data.ts
const fixture: SeedData = {
  teams: ['Worship', 'Music', 'Usher'],
  users: [
    {
      name: 'Leader',
      email: 'leader@echo.test',
      teams: [{ team: 'Worship', isLeader: true }, { team: 'Music' }],
    },
    {
      name: 'Shared',
      email: 'shared@echo.test',
      teams: [{ team: 'Worship' }, { team: 'Music' }],
    },
    {
      name: 'Gone',
      email: 'gone@echo.test',
      isActive: false,
      teams: [{ team: 'Usher' }],
    },
    {
      name: 'Pembina',
      email: 'pembina@echo.test',
      role: UserRole.PEMBINA,
      teams: [],
    },
  ],
  assignments: [
    { serviceIndex: 0, userEmail: 'shared@echo.test', team: 'Worship' },
  ],
};

describe('seed (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  const counts = async () => {
    const tables = [
      'users',
      'teams',
      'team_members',
      'services',
      'service_assignments',
    ];
    const result: Record<string, number> = {};
    for (const t of tables) {
      const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM ${t}`);
      result[t] = n;
    }
    return result;
  };

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

  it('runs without error and creates the expected rows', async () => {
    await runSeed(ds, fixture, options);
    expect(await counts()).toEqual({
      users: 5, // admin + 4
      teams: 3,
      team_members: 5,
      services: 2,
      service_assignments: 1,
    });
  });

  it('creates the admin with must_change_password and a bcrypt hash', async () => {
    await runSeed(ds, fixture, options);
    const [admin] = await ds.query(
      `SELECT role, must_change_password, password_hash FROM users WHERE email = $1`,
      [options.adminEmail],
    );
    expect(admin.role).toBe('ADMIN');
    expect(admin.must_change_password).toBe(true);
    expect(
      await bcrypt.compare(options.adminPassword, admin.password_hash),
    ).toBe(true);
  });

  it('gives fake users the shared password without forcing a change', async () => {
    await runSeed(ds, fixture, options);
    const [u] = await ds.query(
      `SELECT must_change_password, password_hash FROM users WHERE email = 'leader@echo.test'`,
    );
    expect(u.must_change_password).toBe(false);
    expect(await bcrypt.compare(options.userPassword, u.password_hash)).toBe(
      true,
    );
  });

  it('covers the domain-rule scenarios', async () => {
    await runSeed(ds, fixture, options);
    const rows = (sql: string) => ds.query(sql);
    // a leader of one team who is an ordinary member of another
    expect(
      await rows(`SELECT t.name, tm.is_leader FROM team_members tm
        JOIN teams t ON t.id = tm.team_id JOIN users u ON u.id = tm.user_id
        WHERE u.email = 'leader@echo.test' ORDER BY t.name`),
    ).toEqual([
      { name: 'Music', is_leader: false },
      { name: 'Worship', is_leader: true },
    ]);
    // a volunteer in two teams
    const [{ n }] = await rows(`SELECT count(*)::int AS n FROM team_members tm
      JOIN users u ON u.id = tm.user_id WHERE u.email = 'shared@echo.test'`);
    expect(n).toBe(2);
    // inactive user and a pembina
    const [gone] = await rows(
      `SELECT is_active FROM users WHERE email = 'gone@echo.test'`,
    );
    expect(gone.is_active).toBe(false);
    const [pembina] = await rows(
      `SELECT role FROM users WHERE email = 'pembina@echo.test'`,
    );
    expect(pembina.role).toBe('PEMBINA');
    // assigned_by is the team's leader
    const [a] = await rows(`SELECT u.email FROM service_assignments sa
      JOIN users u ON u.id = sa.assigned_by`);
    expect(a.email).toBe('leader@echo.test');
  });

  it('running twice adds no rows', async () => {
    await runSeed(ds, fixture, options);
    const first = await counts();
    await runSeed(ds, fixture, options);
    expect(await counts()).toEqual(first);
  });

  it('never overwrites an existing user', async () => {
    await runSeed(ds, fixture, options);
    await ds.query(
      `UPDATE users SET name = 'Renamed' WHERE email = 'leader@echo.test'`,
    );
    await runSeed(ds, fixture, options);
    const [u] = await ds.query(
      `SELECT name FROM users WHERE email = 'leader@echo.test'`,
    );
    expect(u.name).toBe('Renamed');
  });

  it('adds the new Sunday on a later run and keeps the old ones', async () => {
    await runSeed(ds, fixture, options);
    await runSeed(ds, fixture, {
      ...options,
      now: new Date('2030-01-09T00:00:00Z'),
    });
    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM services`);
    expect(n).toBe(3);
  });

  it('rejects data that names an unknown team', async () => {
    const bad: SeedData = {
      ...fixture,
      users: [{ name: 'X', email: 'x@echo.test', teams: [{ team: 'Nope' }] }],
      assignments: [],
    };
    await expect(runSeed(ds, bad, options)).rejects.toThrow(
      'unknown team "Nope"',
    );
  });

  it('runs the real seed-data.ts without error', async () => {
    await expect(runSeed(ds, SEED_DATA, options)).resolves.toBeUndefined();
    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM teams`);
    expect(n).toBe(SEED_DATA.teams.length);
  });
});

describe('nextSundayServices', () => {
  it('returns Sundays 10:00 WIB (03:00Z), two hours long, a week apart', () => {
    const [first, second] = nextSundayServices(
      2,
      new Date('2030-01-02T00:00:00Z'),
    );
    expect(first.startsAt.toISOString()).toBe('2030-01-06T03:00:00.000Z');
    expect(first.endsAt.toISOString()).toBe('2030-01-06T05:00:00.000Z');
    expect(second.startsAt.toISOString()).toBe('2030-01-13T03:00:00.000Z');
  });

  it('skips a Sunday whose 10:00 service has already started', () => {
    const [first] = nextSundayServices(1, new Date('2030-01-06T04:00:00Z'));
    expect(first.startsAt.toISOString()).toBe('2030-01-13T03:00:00.000Z');
  });
});
