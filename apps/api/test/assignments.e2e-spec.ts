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
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('Assignments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    // Listen on a real port: supertest otherwise opens and closes a temporary
    // listener per request, which breaks when a login runs mid-chain
    await app.listen(0);
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
  const headersFor = async (user: User) => bearer(await tokenFor(user));

  const createTeam = (name?: string) =>
    dataSource
      .getRepository(Team)
      .save({ name: name ?? `Team ${Math.random().toString(36).slice(2)}` });

  const addMember = (team: Team, user: User, isLeader = false) =>
    dataSource
      .getRepository(TeamMember)
      .save({ teamId: team.id, userId: user.id, isLeader });

  async function insertService(
    createdBy: string,
    startOffsetMs = 2 * DAY,
  ): Promise<Service> {
    const startsAt = new Date(Date.now() + startOffsetMs);
    return dataSource.getRepository(Service).save({
      title: 'Sunday Service',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * HOUR),
      createdBy,
    });
  }

  const insertAssignment = (
    service: Service,
    user: User,
    team: Team,
    assignedBy: User,
  ) =>
    dataSource.getRepository(ServiceAssignment).save({
      serviceId: service.id,
      userId: user.id,
      teamId: team.id,
      assignedBy: assignedBy.id,
    });

  const rowsFor = (serviceId: string) =>
    dataSource.getRepository(ServiceAssignment).findBy({ serviceId });

  // A world with an admin, a future service, and team A with a leader
  async function world() {
    const admin = await createUser({ role: UserRole.ADMIN, name: 'Admin' });
    const service = await insertService(admin.id);
    const teamA = await createTeam('Team A');
    const leaderA = await createUser({ name: 'Leader A' });
    await addMember(teamA, leaderA, true);
    return { admin, service, teamA, leaderA };
  }

  const candidatesPath = (s: string, t: string) =>
    `/services/${s}/teams/${t}/candidates`;
  const assignPath = (s: string, t: string) =>
    `/services/${s}/teams/${t}/assignments`;
  const unassignPath = (s: string, t: string, u: string) =>
    `/services/${s}/teams/${t}/assignments/${u}`;

  describe('access control', () => {
    const routes = (s: string, t: string, u: string) =>
      [
        ['get', candidatesPath(s, t)],
        ['post', assignPath(s, t)],
        ['delete', unassignPath(s, t, u)],
      ] as const;

    it('returns 401 without a token', async () => {
      for (const [method, path] of routes(UNKNOWN_ID, UNKNOWN_ID, UNKNOWN_ID)) {
        await request(http())[method](path).send({ userIds: [] }).expect(401);
      }
    });

    it('returns 403 for a leader of another team, a plain member and PEMBINA', async () => {
      const { service, teamA } = await world();
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      const member = await createUser();
      await addMember(teamA, member, false);
      const pembina = await createUser({ role: UserRole.PEMBINA });
      const volunteer = await createUser();

      for (const user of [leaderB, member, pembina]) {
        const headers = await headersFor(user);
        for (const [method, path] of routes(service.id, teamA.id, volunteer.id)) {
          await request(http())
            [method](path)
            .set(headers)
            .send({ userIds: [volunteer.id] })
            .expect(403);
        }
      }
    });

    it('reads leadership from the DB on every request', async () => {
      const { service, teamA, leaderA } = await world();
      const headers = await headersFor(leaderA);
      await request(http())
        .get(candidatesPath(service.id, teamA.id))
        .set(headers)
        .expect(200);
      await dataSource
        .getRepository(TeamMember)
        .update({ teamId: teamA.id, userId: leaderA.id }, { isLeader: false });
      await request(http())
        .get(candidatesPath(service.id, teamA.id))
        .set(headers)
        .expect(403);
    });

    it('gives 404 for an unknown team to ADMIN and 403 to others', async () => {
      const { admin, service, leaderA } = await world();
      const adminHeaders = await headersFor(admin);
      const leaderHeaders = await headersFor(leaderA);
      await request(http())
        .get(candidatesPath(service.id, UNKNOWN_ID))
        .set(adminHeaders)
        .expect(404);
      await request(http())
        .get(candidatesPath(service.id, UNKNOWN_ID))
        .set(leaderHeaders)
        .expect(403);
    });

    it('gives 404 for an unknown or soft-deleted service on all routes', async () => {
      const { admin, service, teamA } = await world();
      const volunteer = await createUser();
      await addMember(teamA, volunteer);
      await dataSource.getRepository(Service).softDelete({ id: service.id });
      const headers = await headersFor(admin);

      for (const id of [service.id, UNKNOWN_ID]) {
        await request(http())
          .get(candidatesPath(id, teamA.id))
          .set(headers)
          .expect(404);
        await request(http())
          .post(assignPath(id, teamA.id))
          .set(headers)
          .send({ userIds: [volunteer.id] })
          .expect(404);
        await request(http())
          .delete(unassignPath(id, teamA.id, volunteer.id))
          .set(headers)
          .expect(404);
      }
    });

    it('returns 400 for non-UUID path params as ADMIN, and 403 for a non-admin', async () => {
      const { admin, service, teamA, leaderA } = await world();
      const adminHeaders = await headersFor(admin);
      const leaderHeaders = await headersFor(leaderA);
      const volunteer = await createUser();
      const bad = 'not-a-uuid';

      const cases: [string, string, string][] = [
        [bad, teamA.id, volunteer.id],
        [service.id, bad, volunteer.id],
        [service.id, teamA.id, bad],
      ];
      for (const [s, t, u] of cases) {
        await request(http())
          .get(candidatesPath(s, t))
          .set(adminHeaders)
          .expect(s === bad || t === bad ? 400 : 200);
        await request(http())
          .delete(unassignPath(s, t, u))
          .set(adminHeaders)
          .expect(400);
      }
      await request(http())
        .post(assignPath(bad, teamA.id))
        .set(adminHeaders)
        .send({ userIds: [volunteer.id] })
        .expect(400);

      // Forbidden AND malformed: 403 wins for a non-leader of that team
      await request(http())
        .get(candidatesPath(service.id, bad))
        .set(leaderHeaders)
        .expect(403);
      // A leader of the team with a malformed service id gets 400
      await request(http())
        .get(candidatesPath(bad, teamA.id))
        .set(leaderHeaders)
        .expect(400);
    });
  });

  describe('GET candidates', () => {
    it('lists active team members ordered by name, excluding inactive users', async () => {
      const { service, teamA, leaderA } = await world();
      const zed = await createUser({ name: 'Zed' });
      const amy = await createUser({ name: 'Amy' });
      const gone = await createUser({ name: 'Bob', isActive: false });
      for (const u of [zed, amy, gone]) await addMember(teamA, u);

      const res = await request(http())
        .get(candidatesPath(service.id, teamA.id))
        .set(await headersFor(leaderA))
        .expect(200);
      expect(res.body).toEqual([
        { userId: amy.id, name: 'Amy', assigned: false },
        { userId: leaderA.id, name: 'Leader A', assigned: false },
        { userId: zed.id, name: 'Zed', assigned: false },
      ]);
    });

    it('excludes users held by another team and marks this team’s own', async () => {
      const { service, teamA, leaderA } = await world();
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      const x = await createUser({ name: 'X' });
      await addMember(teamA, x);
      await addMember(teamB, x);

      await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(await headersFor(leaderA))
        .send({ userIds: [x.id] })
        .expect(200);

      const forB = await request(http())
        .get(candidatesPath(service.id, teamB.id))
        .set(await headersFor(leaderB))
        .expect(200);
      expect(forB.body.map((c: { userId: string }) => c.userId)).not.toContain(
        x.id,
      );

      const forA = await request(http())
        .get(candidatesPath(service.id, teamA.id))
        .set(await headersFor(leaderA))
        .expect(200);
      expect(forA.body).toContainEqual({
        userId: x.id,
        name: 'X',
        assigned: true,
      });
      expect(
        forA.body.find((c: { userId: string }) => c.userId === leaderA.id)
          .assigned,
      ).toBe(false);
    });

    it('works on a past service', async () => {
      const { admin, teamA, leaderA } = await world();
      const past = await insertService(admin.id, -2 * DAY);
      await request(http())
        .get(candidatesPath(past.id, teamA.id))
        .set(await headersFor(leaderA))
        .expect(200);
    });
  });

  describe('POST assignments', () => {
    it('validates the body', async () => {
      const { service, teamA, leaderA } = await world();
      const headers = await headersFor(leaderA);
      const ids = Array.from({ length: 101 }, (_, i) =>
        `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      const bodies: unknown[] = [
        { userIds: [] },
        { userIds: 'x' },
        {},
        { userIds: ['nope'] },
        { userIds: ids },
      ];
      for (const body of bodies) {
        await request(http())
          .post(assignPath(service.id, teamA.id))
          .set(headers)
          .send(body as object)
          .expect(400);
      }
    });

    it('assigns, recording the path team and the caller, and removes duplicate ids', async () => {
      const { service, teamA, leaderA } = await world();
      const v = await createUser();
      await addMember(teamA, v);

      const res = await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(await headersFor(leaderA))
        .send({ userIds: [v.id, v.id] })
        .expect(200);
      expect(res.body).toEqual({ assigned: [v.id], skipped: [] });

      const rows = await rowsFor(service.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: v.id,
        teamId: teamA.id,
        assignedBy: leaderA.id,
      });
    });

    it('rejects non-members and inactive members with INVALID_USERS and inserts nothing', async () => {
      const { service, teamA, leaderA } = await world();
      const ok = await createUser();
      const outsider = await createUser();
      const inactive = await createUser({ isActive: false });
      await addMember(teamA, ok);
      await addMember(teamA, inactive);

      const res = await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(await headersFor(leaderA))
        .send({ userIds: [ok.id, outsider.id, inactive.id] })
        .expect(400);
      expect(res.body.code).toBe('INVALID_USERS');
      const byId = (a: string, b: string) => a.localeCompare(b);
      expect([...(res.body.invalidUserIds as string[])].sort(byId)).toEqual(
        [outsider.id, inactive.id].sort(byId),
      );
      expect(await rowsFor(service.id)).toHaveLength(0);
    });

    it('is idempotent for this team’s own assignment', async () => {
      const { service, teamA, leaderA } = await world();
      const v = await createUser();
      await addMember(teamA, v);
      const headers = await headersFor(leaderA);
      await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(headers)
        .send({ userIds: [v.id] })
        .expect(200);
      const res = await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(headers)
        .send({ userIds: [v.id] })
        .expect(200);
      expect(res.body).toEqual({
        assigned: [],
        skipped: [{ userId: v.id, reason: 'ALREADY_ASSIGNED_THIS_TEAM' }],
      });
      expect(res.body.skipped[0]).not.toHaveProperty('heldByTeam');
      expect(await rowsFor(service.id)).toHaveLength(1);
    });

    it('skips a user held by another team, reports heldByTeam to leaders and ADMIN, and keeps the rest', async () => {
      const { admin, service, teamA, leaderA } = await world();
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      const held = await createUser();
      const free = await createUser();
      for (const u of [held, free]) await addMember(teamA, u);
      await addMember(teamB, held);
      await request(http())
        .post(assignPath(service.id, teamB.id))
        .set(await headersFor(leaderB))
        .send({ userIds: [held.id] })
        .expect(200);

      const expected = {
        userId: held.id,
        reason: 'ALREADY_ASSIGNED_OTHER_TEAM',
        heldByTeam: { id: teamB.id, name: 'Team B' },
      };
      const asLeader = await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(await headersFor(leaderA))
        .send({ userIds: [free.id, held.id] })
        .expect(200);
      expect(asLeader.body).toEqual({
        assigned: [free.id],
        skipped: [expected],
      });

      const asAdmin = await request(http())
        .post(assignPath(service.id, teamA.id))
        .set(await headersFor(admin))
        .send({ userIds: [held.id] })
        .expect(200);
      expect(asAdmin.body).toEqual({ assigned: [], skipped: [expected] });
      expect(await rowsFor(service.id)).toHaveLength(2);
    });

    it('returns 409 SERVICE_ALREADY_STARTED for a started service', async () => {
      const { admin, teamA, leaderA } = await world();
      const past = await insertService(admin.id, -HOUR);
      const v = await createUser();
      await addMember(teamA, v);
      const res = await request(http())
        .post(assignPath(past.id, teamA.id))
        .set(await headersFor(leaderA))
        .send({ userIds: [v.id] })
        .expect(409);
      expect(res.body.code).toBe('SERVICE_ALREADY_STARTED');
      expect(await rowsFor(past.id)).toHaveLength(0);
    });
  });

  describe('DELETE assignment', () => {
    it('deletes this team’s assignment (204) and frees the user for another team', async () => {
      const { service, teamA, leaderA } = await world();
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      const x = await createUser({ name: 'X' });
      await addMember(teamA, x);
      await addMember(teamB, x);
      await insertAssignment(service, x, teamA, leaderA);

      await request(http())
        .delete(unassignPath(service.id, teamA.id, x.id))
        .set(await headersFor(leaderA))
        .expect(204);
      expect(await rowsFor(service.id)).toHaveLength(0);

      const candidates = await request(http())
        .get(candidatesPath(service.id, teamB.id))
        .set(await headersFor(leaderB))
        .expect(200);
      expect(candidates.body).toContainEqual({
        userId: x.id,
        name: 'X',
        assigned: false,
      });
      const claim = await request(http())
        .post(assignPath(service.id, teamB.id))
        .set(await headersFor(leaderB))
        .send({ userIds: [x.id] })
        .expect(200);
      expect(claim.body.assigned).toEqual([x.id]);
    });

    it('returns 404 when this team has no assignment, even if another team holds the user', async () => {
      const { service, teamA, leaderA } = await world();
      const teamB = await createTeam('Team B');
      const x = await createUser();
      await addMember(teamB, x);
      await insertAssignment(service, x, teamB, leaderA);

      const res = await request(http())
        .delete(unassignPath(service.id, teamA.id, x.id))
        .set(await headersFor(leaderA))
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain(teamB.id);
      expect(JSON.stringify(res.body)).not.toContain('Team B');
      expect(await rowsFor(service.id)).toHaveLength(1);
    });

    it('lets ADMIN remove another team’s assignment via the holding team id', async () => {
      const { admin, service } = await world();
      const teamB = await createTeam('Team B');
      const x = await createUser();
      await addMember(teamB, x);
      await insertAssignment(service, x, teamB, admin);
      await request(http())
        .delete(unassignPath(service.id, teamB.id, x.id))
        .set(await headersFor(admin))
        .expect(204);
      expect(await rowsFor(service.id)).toHaveLength(0);
    });

    it('works for a deactivated user', async () => {
      const { service, teamA, leaderA } = await world();
      const x = await createUser({ isActive: false });
      await addMember(teamA, x);
      await insertAssignment(service, x, teamA, leaderA);
      await request(http())
        .delete(unassignPath(service.id, teamA.id, x.id))
        .set(await headersFor(leaderA))
        .expect(204);
    });

    it('returns 409 SERVICE_ALREADY_STARTED and keeps the row for a started service', async () => {
      const { admin, teamA, leaderA } = await world();
      const past = await insertService(admin.id, -HOUR);
      const x = await createUser();
      await addMember(teamA, x);
      await insertAssignment(past, x, teamA, leaderA);
      const res = await request(http())
        .delete(unassignPath(past.id, teamA.id, x.id))
        .set(await headersFor(leaderA))
        .expect(409);
      expect(res.body.code).toBe('SERVICE_ALREADY_STARTED');
      expect(await rowsFor(past.id)).toHaveLength(1);
    });
  });

  describe('concurrency (rule 2 and 3)', () => {
    it('lets exactly one of two parallel teams claim the same user, 25 times', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const service = await insertService(admin.id);
      const teamA = await createTeam('Team A');
      const teamB = await createTeam('Team B');
      const leaderA = await createUser();
      const leaderB = await createUser();
      await addMember(teamA, leaderA, true);
      await addMember(teamB, leaderB, true);
      const x = await createUser();
      await addMember(teamA, x);
      await addMember(teamB, x);
      const headersA = await headersFor(leaderA);
      const headersB = await headersFor(leaderB);

      for (let i = 0; i < 25; i++) {
        await dataSource.query('DELETE FROM service_assignments');
        const [resA, resB] = await Promise.all([
          request(http())
            .post(assignPath(service.id, teamA.id))
            .set(headersA)
            .send({ userIds: [x.id] }),
          request(http())
            .post(assignPath(service.id, teamB.id))
            .set(headersB)
            .send({ userIds: [x.id] }),
        ]);
        expect(resA.status).toBe(200);
        expect(resB.status).toBe(200);

        const rows = await rowsFor(service.id);
        expect(rows).toHaveLength(1);
        const winner = rows[0].teamId;
        const [won, lost] =
          winner === teamA.id ? [resA, resB] : [resB, resA];
        expect(won.body.assigned).toEqual([x.id]);
        expect(lost.body.assigned).toEqual([]);
        expect(lost.body.skipped).toEqual([
          expect.objectContaining({
            userId: x.id,
            reason: 'ALREADY_ASSIGNED_OTHER_TEAM',
          }),
        ]);
      }
    });
  });
});
