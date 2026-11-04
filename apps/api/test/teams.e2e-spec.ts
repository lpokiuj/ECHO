import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ServiceAssignment } from '../src/assignments/entities/service-assignment.entity.js';
import { Service } from '../src/services/entities/service.entity.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase } from './utils/test-app.js';

const PASSWORD = 'password123';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const DAY = 24 * 60 * 60 * 1000;

describe('Teams (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(overrides: Partial<User> = {}): Promise<User> {
    return dataSource.getRepository(User).save({
      name: 'Test User',
      email: `u${Math.random().toString(36).slice(2)}@echo.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: UserRole.MEMBER,
      mustChangePassword: false,
      isActive: true,
      ...overrides,
    });
  }

  async function tokenFor(user: User): Promise<string> {
    const res = await request(http())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function adminToken() {
    return bearer(await tokenFor(await createUser({ role: UserRole.ADMIN })));
  }

  const createTeam = (name = `Team ${Math.random().toString(36).slice(2)}`) =>
    dataSource.getRepository(Team).save({ name });

  const addMember = (teamId: string, userId: string, isLeader = false) =>
    dataSource.getRepository(TeamMember).save({ teamId, userId, isLeader });

  const memberRows = (teamId: string, userId: string) =>
    dataSource.getRepository(TeamMember).findBy({ teamId, userId });

  async function createService(
    createdBy: string,
    offsetMs: number,
    title = 'Service',
    deletedAt: Date | null = null,
  ): Promise<Service> {
    const startsAt = new Date(Date.now() + offsetMs);
    return dataSource.getRepository(Service).save({
      title,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
      createdBy,
      deletedAt,
    });
  }

  const assign = (
    serviceId: string,
    userId: string,
    teamId: string,
    assignedBy: string,
  ) =>
    dataSource
      .getRepository(ServiceAssignment)
      .save({ serviceId, userId, teamId, assignedBy });

  const assignmentsOf = (serviceId: string) =>
    dataSource.getRepository(ServiceAssignment).findBy({ serviceId });

  describe('access control', () => {
    const routes = (teamId: string, userId: string) =>
      [
        ['post', '/teams'],
        ['patch', `/teams/${teamId}`],
        ['put', `/teams/${teamId}/members/${userId}`],
        ['delete', `/teams/${teamId}/members/${userId}`],
      ] as const;

    it('returns 401 without a token', async () => {
      const team = await createTeam();
      const user = await createUser();
      for (const [method, path] of routes(team.id, user.id)) {
        await request(http())[method](path).send({ name: 'x' }).expect(401);
      }
    });

    it.each([UserRole.PEMBINA, UserRole.MEMBER])(
      'returns 403 for %s',
      async (role) => {
        const team = await createTeam();
        const user = await createUser();
        const headers = bearer(await tokenFor(await createUser({ role })));
        for (const [method, path] of routes(team.id, user.id)) {
          await request(http())
            [method](path)
            .set(headers)
            .send({ name: 'x' })
            .expect(403);
        }
      },
    );

    it('GET /teams: 200 for ADMIN and PEMBINA, 403 for MEMBER and a team leader', async () => {
      const team = await createTeam();
      const leader = await createUser();
      await addMember(team.id, leader.id, true);
      const pembina = await createUser({ role: UserRole.PEMBINA });
      const ok = [await adminToken(), bearer(await tokenFor(pembina))];
      for (const h of ok)
        await request(http()).get('/teams').set(h).expect(200);
      const no = [
        bearer(await tokenFor(await createUser())),
        bearer(await tokenFor(leader)),
      ];
      for (const h of no)
        await request(http()).get('/teams').set(h).expect(403);
    });

    it('returns 403 for a leader of that same team', async () => {
      const team = await createTeam();
      const leader = await createUser();
      await addMember(team.id, leader.id, true);
      const other = await createUser();
      const headers = bearer(await tokenFor(leader));
      for (const [method, path] of routes(team.id, other.id)) {
        await request(http())
          [method](path)
          .set(headers)
          .send({ name: 'x' })
          .expect(403);
      }
      expect(await memberRows(team.id, other.id)).toHaveLength(0);
    });

    it('returns 400 for ids that are not UUIDs', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const user = await createUser();
      await request(http())
        .patch('/teams/nope')
        .set(headers)
        .send({ name: 'x' })
        .expect(400);
      for (const method of ['put', 'delete'] as const) {
        await request(http())
          [method](`/teams/nope/members/${user.id}`)
          .set(headers)
          .expect(400);
        await request(http())
          [method](`/teams/${team.id}/members/nope`)
          .set(headers)
          .expect(400);
      }
    });
  });

  describe('teams', () => {
    it('creates a team and returns { id, name }', async () => {
      const headers = await adminToken();
      const res = await request(http())
        .post('/teams')
        .set(headers)
        .send({ name: 'Worship' })
        .expect(201);
      expect(res.body).toEqual({ id: expect.any(String), name: 'Worship' });
    });

    it('trims the name', async () => {
      const headers = await adminToken();
      const res = await request(http())
        .post('/teams')
        .set(headers)
        .send({ name: '  Music  ' })
        .expect(201);
      expect(res.body.name).toBe('Music');
      const patched = await request(http())
        .patch(`/teams/${res.body.id}`)
        .set(headers)
        .send({ name: '  Sound ' })
        .expect(200);
      expect(patched.body.name).toBe('Sound');
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['101 characters', 'a'.repeat(101)],
      ['missing', undefined],
      ['not a string', 5],
    ])('rejects a %s name with 400', async (_label, name) => {
      const headers = await adminToken();
      await request(http())
        .post('/teams')
        .set(headers)
        .send({ name })
        .expect(400);
      const team = await createTeam();
      await request(http())
        .patch(`/teams/${team.id}`)
        .set(headers)
        .send({ name })
        .expect(400);
    });

    it('accepts a 100-character name', async () => {
      const headers = await adminToken();
      await request(http())
        .post('/teams')
        .set(headers)
        .send({ name: 'a'.repeat(100) })
        .expect(201);
    });

    it('returns 409 for a duplicate name on POST and PATCH', async () => {
      const headers = await adminToken();
      await createTeam('Usher');
      const other = await createTeam('Stage');
      await request(http())
        .post('/teams')
        .set(headers)
        .send({ name: 'Usher' })
        .expect(409);
      await request(http())
        .patch(`/teams/${other.id}`)
        .set(headers)
        .send({ name: 'Usher' })
        .expect(409);
    });

    it('lists teams ordered by name', async () => {
      await createTeam('Sound');
      await createTeam('Audio');
      await createTeam('Multimedia');
      const headers = await adminToken();
      const res = await request(http()).get('/teams').set(headers).expect(200);
      expect(res.body.map((t: Team) => t.name)).toEqual([
        'Audio',
        'Multimedia',
        'Sound',
      ]);
      expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'name']);
    });

    it('renames a team', async () => {
      const team = await createTeam('Old');
      const headers = await adminToken();
      const res = await request(http())
        .patch(`/teams/${team.id}`)
        .set(headers)
        .send({ name: 'New' })
        .expect(200);
      expect(res.body).toEqual({ id: team.id, name: 'New' });
    });

    it('returns 404 when patching an unknown team', async () => {
      const headers = await adminToken();
      await request(http())
        .patch(`/teams/${UNKNOWN_ID}`)
        .set(headers)
        .send({ name: 'x' })
        .expect(404);
    });

    it('has no delete-team route', async () => {
      const team = await createTeam();
      const headers = await adminToken();
      await request(http())
        .delete(`/teams/${team.id}`)
        .set(headers)
        .expect(404);
    });
  });

  describe('PUT /teams/:id/members/:userId', () => {
    const put = (
      headers: Record<string, string>,
      teamId: string,
      userId: string,
      body?: object,
    ) =>
      request(http())
        .put(`/teams/${teamId}/members/${userId}`)
        .set(headers)
        .send(body);

    it('creates a member (200), isLeader defaults to false', async () => {
      const team = await createTeam();
      const user = await createUser();
      const res = await put(await adminToken(), team.id, user.id).expect(200);
      expect(res.body).toEqual({
        teamId: team.id,
        userId: user.id,
        isLeader: false,
      });
      expect(await memberRows(team.id, user.id)).toHaveLength(1);
    });

    it('updates isLeader and never creates a duplicate row', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const user = await createUser();
      await put(headers, team.id, user.id, { isLeader: true }).expect(200);
      await put(headers, team.id, user.id, { isLeader: true }).expect(200);
      let rows = await memberRows(team.id, user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].isLeader).toBe(true);

      const res = await put(headers, team.id, user.id, {
        isLeader: false,
      }).expect(200);
      expect(res.body.isLeader).toBe(false);
      rows = await memberRows(team.id, user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].isLeader).toBe(false);
    });

    it('returns 404 for an unknown team and an unknown user', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const user = await createUser();
      await put(headers, UNKNOWN_ID, user.id).expect(404);
      await put(headers, team.id, UNKNOWN_ID).expect(404);
    });

    it('returns 400 for an inactive user', async () => {
      const team = await createTeam();
      const user = await createUser({ isActive: false });
      await put(await adminToken(), team.id, user.id).expect(400);
      expect(await memberRows(team.id, user.id)).toHaveLength(0);
    });

    it('returns 400 for a non-boolean isLeader', async () => {
      const team = await createTeam();
      const user = await createUser();
      const headers = await adminToken();
      await put(headers, team.id, user.id, { isLeader: 'yes' }).expect(400);
      await put(headers, team.id, user.id, { isLeader: 1 }).expect(400);
    });

    it('rejects PEMBINA as leader (400) but allows a plain member (200)', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const pembina = await createUser({ role: UserRole.PEMBINA });
      await put(headers, team.id, pembina.id, { isLeader: true }).expect(400);
      expect(await memberRows(team.id, pembina.id)).toHaveLength(0);
      await put(headers, team.id, pembina.id, { isLeader: false }).expect(200);
      expect(await memberRows(team.id, pembina.id)).toHaveLength(1);
    });

    it('does not promote an existing PEMBINA member to leader', async () => {
      const team = await createTeam();
      const pembina = await createUser({ role: UserRole.PEMBINA });
      await addMember(team.id, pembina.id);
      await put(await adminToken(), team.id, pembina.id, {
        isLeader: true,
      }).expect(400);
      const [row] = await memberRows(team.id, pembina.id);
      expect(row.isLeader).toBe(false);
    });

    it('allows several leaders and no leader', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const a = await createUser();
      const b = await createUser();
      await put(headers, team.id, a.id, { isLeader: true }).expect(200);
      await put(headers, team.id, b.id, { isLeader: true }).expect(200);
      expect(
        await dataSource
          .getRepository(TeamMember)
          .countBy({ teamId: team.id, isLeader: true }),
      ).toBe(2);

      const empty = await createTeam();
      await put(headers, empty.id, a.id).expect(200);
      expect(
        await dataSource
          .getRepository(TeamMember)
          .countBy({ teamId: empty.id, isLeader: true }),
      ).toBe(0);
    });

    it('lets one person lead team A and be a plain member of team B', async () => {
      const headers = await adminToken();
      const a = await createTeam();
      const b = await createTeam();
      const user = await createUser();
      await put(headers, a.id, user.id, { isLeader: true }).expect(200);
      await put(headers, b.id, user.id, { isLeader: false }).expect(200);
      expect((await memberRows(a.id, user.id))[0].isLeader).toBe(true);
      expect((await memberRows(b.id, user.id))[0].isLeader).toBe(false);
    });
  });

  describe('DELETE /teams/:id/members/:userId (rule 9)', () => {
    const del = (
      headers: Record<string, string>,
      teamId: string,
      userId: string,
    ) =>
      request(http()).delete(`/teams/${teamId}/members/${userId}`).set(headers);

    it('removes the member and returns the empty list when nothing is assigned', async () => {
      const team = await createTeam();
      const user = await createUser();
      await addMember(team.id, user.id);
      const res = await del(await adminToken(), team.id, user.id).expect(200);
      expect(res.body).toEqual({ removedAssignments: [] });
      expect(await memberRows(team.id, user.id)).toHaveLength(0);
    });

    it('returns 404 for an unknown team, unknown user, and a non-member', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const user = await createUser();
      await del(headers, UNKNOWN_ID, user.id).expect(404);
      await del(headers, team.id, UNKNOWN_ID).expect(404);
      await del(headers, team.id, user.id).expect(404);
    });

    it('allows removing a leader and the last leader', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const a = await createUser();
      const b = await createUser();
      await addMember(team.id, a.id, true);
      await addMember(team.id, b.id, true);
      await del(headers, team.id, a.id).expect(200);
      await del(headers, team.id, b.id).expect(200);
      expect(
        await dataSource.getRepository(TeamMember).countBy({ teamId: team.id }),
      ).toBe(0);
    });

    it('deletes future assignments, keeps past ones, and reports the future ones sorted', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const headers = bearer(await tokenFor(admin));
      const team = await createTeam();
      const user = await createUser();
      await addMember(team.id, user.id);

      const later = await createService(admin.id, 9 * DAY, 'Later');
      const sooner = await createService(admin.id, 2 * DAY, 'Sooner');
      const past = await createService(admin.id, -2 * DAY, 'Past');
      for (const s of [later, sooner, past]) {
        await assign(s.id, user.id, team.id, admin.id);
      }

      const res = await del(headers, team.id, user.id).expect(200);
      expect(res.body.removedAssignments).toEqual([
        {
          serviceId: sooner.id,
          title: 'Sooner',
          startsAt: sooner.startsAt.toISOString(),
        },
        {
          serviceId: later.id,
          title: 'Later',
          startsAt: later.startsAt.toISOString(),
        },
      ]);
      expect(await assignmentsOf(sooner.id)).toHaveLength(0);
      expect(await assignmentsOf(later.id)).toHaveLength(0);
      expect(await assignmentsOf(past.id)).toHaveLength(1);
    });

    it("keeps the same user's assignments made by another team", async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const teamA = await createTeam();
      const teamB = await createTeam();
      const user = await createUser();
      await addMember(teamA.id, user.id);
      await addMember(teamB.id, user.id);
      const service = await createService(admin.id, 3 * DAY);
      await assign(service.id, user.id, teamB.id, admin.id);

      const res = await del(
        bearer(await tokenFor(admin)),
        teamA.id,
        user.id,
      ).expect(200);
      expect(res.body.removedAssignments).toEqual([]);
      const rows = await assignmentsOf(service.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].teamId).toBe(teamB.id);
    });

    it("keeps other users' assignments made by this team", async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam();
      const removed = await createUser();
      const stays = await createUser();
      await addMember(team.id, removed.id);
      await addMember(team.id, stays.id);
      const service = await createService(admin.id, 3 * DAY);
      await assign(service.id, removed.id, team.id, admin.id);
      await assign(service.id, stays.id, team.id, admin.id);

      await del(bearer(await tokenFor(admin)), team.id, removed.id).expect(200);
      const rows = await assignmentsOf(service.id);
      expect(rows.map((r) => r.userId)).toEqual([stays.id]);
    });

    it('deletes assignments on soft-deleted future services but does not report them', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam();
      const user = await createUser();
      await addMember(team.id, user.id);
      const gone = await createService(admin.id, 3 * DAY, 'Gone', new Date());
      await assign(gone.id, user.id, team.id, admin.id);

      const res = await del(
        bearer(await tokenFor(admin)),
        team.id,
        user.id,
      ).expect(200);
      expect(res.body.removedAssignments).toEqual([]);
      expect(await assignmentsOf(gone.id)).toHaveLength(0);
    });

    it('is one transaction: a failing assignment delete rolls back the member delete', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const headers = bearer(await tokenFor(admin));
      const team = await createTeam();
      const user = await createUser();
      await addMember(team.id, user.id, true);
      const service = await createService(admin.id, 3 * DAY);
      await assign(service.id, user.id, team.id, admin.id);

      // Make the second step fail inside the real database
      await dataSource.query(`
        CREATE FUNCTION test_block_assignment_delete() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'blocked for test'; END;
        $$ LANGUAGE plpgsql`);
      await dataSource.query(`
        CREATE TRIGGER test_block_assignment_delete
        BEFORE DELETE ON service_assignments
        FOR EACH ROW EXECUTE FUNCTION test_block_assignment_delete()`);
      try {
        await del(headers, team.id, user.id).expect(500);
      } finally {
        await dataSource.query(
          'DROP TRIGGER test_block_assignment_delete ON service_assignments',
        );
        await dataSource.query('DROP FUNCTION test_block_assignment_delete()');
      }

      expect(await memberRows(team.id, user.id)).toHaveLength(1);
      expect(await assignmentsOf(service.id)).toHaveLength(1);
    });
  });

  describe('GET /teams/:id/members', () => {
    const list = (headers: Record<string, string>, teamId: string) =>
      request(http()).get(`/teams/${teamId}/members`).set(headers);

    it('returns 401 without a token', async () => {
      const team = await createTeam();
      await request(http()).get(`/teams/${team.id}/members`).expect(401);
    });

    it.each([UserRole.PEMBINA, UserRole.MEMBER])(
      'returns 403 for %s',
      async (role) => {
        const team = await createTeam();
        const headers = bearer(await tokenFor(await createUser({ role })));
        await list(headers, team.id).expect(403);
      },
    );

    it('returns 403 for the leader of that very team', async () => {
      const team = await createTeam();
      const leader = await createUser();
      await addMember(team.id, leader.id, true);
      await list(bearer(await tokenFor(leader)), team.id).expect(403);
    });

    it('returns 404 for an unknown team and 400 for a non-UUID id', async () => {
      const headers = await adminToken();
      await list(headers, UNKNOWN_ID).expect(404);
      await list(headers, 'nope').expect(400);
    });

    it('lists members by name with isLeader and isActive, and nothing else', async () => {
      const headers = await adminToken();
      const team = await createTeam();
      const other = await createTeam();
      const zed = await createUser({ name: 'Zed' });
      const amy = await createUser({ name: 'Amy', isActive: false });
      const bob = await createUser({ name: 'Bob' });
      await addMember(team.id, zed.id, true);
      await addMember(team.id, amy.id);
      await addMember(team.id, bob.id);
      await addMember(other.id, bob.id);

      const res = await list(headers, team.id).expect(200);

      expect(res.body).toEqual([
        {
          userId: amy.id,
          name: 'Amy',
          email: amy.email,
          isLeader: false,
          isActive: false,
        },
        {
          userId: bob.id,
          name: 'Bob',
          email: bob.email,
          isLeader: false,
          isActive: true,
        },
        {
          userId: zed.id,
          name: 'Zed',
          email: zed.email,
          isLeader: true,
          isActive: true,
        },
      ]);
    });

    it('returns an empty list for a team with no members', async () => {
      const team = await createTeam();
      const res = await list(await adminToken(), team.id).expect(200);
      expect(res.body).toEqual([]);
    });
  });
});
