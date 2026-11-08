import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ServiceAssignment } from '../src/assignments/entities/service-assignment.entity.js';
import { ServiceAbsence } from '../src/attendance/entities/service-absence.entity.js';
import { Service } from '../src/services/entities/service.entity.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase } from './utils/test-app.js';

const PASSWORD = 'password123';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('Attendance (e2e)', () => {
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

  const absenceRows = (serviceId: string) =>
    dataSource.getRepository(ServiceAbsence).findBy({ serviceId });
  const takerPath = (s: string, t: string) =>
    `/services/${s}/teams/${t}/absent-taker`;
  const absencePath = (s: string, t: string, u: string) =>
    `/services/${s}/teams/${t}/absences/${u}`;
  const setTaker = (s: Service, t: Team, u: User, h: Record<string, string>) =>
    request(http()).put(takerPath(s.id, t.id)).set(h).send({ userId: u.id });

  // Team A: leader, taker, two volunteers. The service started an hour ago.
  async function world(startOffsetMs = -HOUR) {
    const admin = await createUser({ role: UserRole.ADMIN, name: 'Admin' });
    const service = await insertService(admin.id, startOffsetMs);
    const team = await createTeam('Team A');
    const leader = await createUser({ name: 'Leader A' });
    await addMember(team, leader, true);
    const taker = await createUser({ name: 'Taker' });
    const amy = await createUser({ name: 'Amy' });
    const bob = await createUser({ name: 'Bob' });
    for (const u of [taker, amy, bob]) {
      await addMember(team, u);
      await insertAssignment(service, u, team, leader);
    }
    await dataSource
      .getRepository(ServiceAssignment)
      .update(
        { serviceId: service.id, userId: taker.id },
        { isAbsentTaker: true },
      );
    return { admin, service, team, leader, taker, amy, bob };
  }

  describe('access control', () => {
    it('returns 401 without a token on every route', async () => {
      const s = UNKNOWN_ID;
      await request(http())
        .put(takerPath(s, s))
        .send({ userId: s })
        .expect(401);
      await request(http())
        .put(absencePath(s, s, s))
        .expect(401);
      await request(http())
        .delete(absencePath(s, s, s))
        .expect(401);
      await request(http()).get('/me/absences').expect(401);
      await request(http()).get(`/teams/${s}/absences`).expect(401);
    });

    it('designation: 403 for non-leaders, taker, member and PEMBINA; leader and ADMIN allowed', async () => {
      const { admin, service, team, leader, taker, amy } = await world();
      const pembina = await createUser({ role: UserRole.PEMBINA });
      const otherLeader = await createUser();
      const teamB = await createTeam('Team B');
      await addMember(teamB, otherLeader, true);
      for (const u of [taker, amy, pembina, otherLeader]) {
        await setTaker(service, team, amy, await headersFor(u)).expect(403);
      }
      await setTaker(service, team, amy, await headersFor(leader)).expect(204);
      await setTaker(service, team, taker, await headersFor(admin)).expect(204);
    });

    it('recording: 403 for a plain member and PEMBINA', async () => {
      const { service, team, amy, bob } = await world();
      const pembina = await createUser({ role: UserRole.PEMBINA });
      for (const u of [amy, pembina]) {
        const h = await headersFor(u);
        await request(http())
          .put(absencePath(service.id, team.id, bob.id))
          .set(h)
          .expect(403);
        await request(http())
          .delete(absencePath(service.id, team.id, bob.id))
          .set(h)
          .expect(403);
      }
    });

    it('recording: the taker of another team gets 403', async () => {
      const { admin, service, team, amy } = await world();
      const teamB = await createTeam('Team B');
      const takerB = await createUser();
      await addMember(teamB, takerB);
      await insertAssignment(service, takerB, teamB, admin);
      await dataSource
        .getRepository(ServiceAssignment)
        .update(
          { serviceId: service.id, userId: takerB.id },
          { isAbsentTaker: true },
        );
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(takerB))
        .expect(403);
    });

    it('recording: the leader of another team gets 403', async () => {
      const { service, team, bob } = await world();
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      const h = await headersFor(leaderB);
      await request(http())
        .put(absencePath(service.id, team.id, bob.id))
        .set(h)
        .expect(403);
      await request(http())
        .delete(absencePath(service.id, team.id, bob.id))
        .set(h)
        .expect(403);
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('unknown team: 403 for non-admins, 404 for ADMIN; unknown service 404 for ADMIN', async () => {
      const { admin, service, team, leader } = await world();
      const h = await headersFor(leader);
      await setTaker(service, { id: UNKNOWN_ID } as Team, leader, h).expect(
        403,
      );
      const ah = await headersFor(admin);
      await request(http())
        .put(absencePath(service.id, UNKNOWN_ID, leader.id))
        .set(ah)
        .expect(404);
      await request(http())
        .put(absencePath(UNKNOWN_ID, team.id, leader.id))
        .set(ah)
        .expect(404);
      await setTaker({ id: UNKNOWN_ID } as Service, team, leader, ah).expect(
        404,
      );
    });

    it('400 for non-UUID ids and bad bodies', async () => {
      const { admin, service, team } = await world();
      const ah = await headersFor(admin);
      await request(http())
        .put(absencePath('x', team.id, UNKNOWN_ID))
        .set(ah)
        .expect(400);
      await request(http())
        .put(absencePath(service.id, team.id, 'x'))
        .set(ah)
        .expect(400);
      await request(http())
        .put(takerPath(service.id, team.id))
        .set(ah)
        .send({})
        .expect(400);
      await request(http())
        .put(takerPath(service.id, team.id))
        .set(ah)
        .send({ userId: 'x' })
        .expect(400);
    });
  });

  describe('absent-taker designation', () => {
    it('replaces the previous taker, leaving exactly one', async () => {
      const { service, team, leader, taker, amy } = await world();
      const h = await headersFor(leader);
      await setTaker(service, team, amy, h).expect(204);
      await setTaker(service, team, amy, h).expect(204); // idempotent
      const rows = await rowsFor(service.id);
      expect(rows.filter((r) => r.isAbsentTaker).map((r) => r.userId)).toEqual([
        amy.id,
      ]);
      expect(rows.find((r) => r.userId === taker.id)?.isAbsentTaker).toBe(
        false,
      );
    });

    it('rejects a user not assigned by that team and keeps the old taker', async () => {
      const { service, team, leader, taker } = await world();
      const stranger = await createUser();
      await addMember(team, stranger);
      const res = await setTaker(
        service,
        team,
        stranger,
        await headersFor(leader),
      ).expect(400);
      expect(res.body.code).toBe('INVALID_USERS');
      const rows = await rowsFor(service.id);
      expect(rows.filter((r) => r.isAbsentTaker).map((r) => r.userId)).toEqual([
        taker.id,
      ]);
    });

    it('works before the service starts', async () => {
      const { service, team, leader, amy } = await world(2 * DAY);
      await setTaker(service, team, amy, await headersFor(leader)).expect(204);
    });

    it('two simultaneous designations leave exactly one taker', async () => {
      const { service, team, leader, amy, bob } = await world();
      const h = await headersFor(leader);
      for (let i = 0; i < 10; i++) {
        const [a, b] = await Promise.all([
          setTaker(service, team, amy, h),
          setTaker(service, team, bob, h),
        ]);
        expect([a.status, b.status]).toEqual([204, 204]);
        const takers = (await rowsFor(service.id)).filter(
          (r) => r.isAbsentTaker,
        );
        expect(takers).toHaveLength(1);
      }
    });

    it('the database refuses a second taker for the same team and service', async () => {
      const { service, amy } = await world();
      await expect(
        dataSource
          .getRepository(ServiceAssignment)
          .update(
            { serviceId: service.id, userId: amy.id },
            { isAbsentTaker: true },
          ),
      ).rejects.toThrow();
    });

    it('the schedule shows isAbsentTaker', async () => {
      const { service, taker, amy } = await world();
      const res = await request(http())
        .get('/services?includePast=true')
        .set(await headersFor(amy))
        .expect(200);
      const flags = Object.fromEntries(
        res.body
          .find((s: { id: string }) => s.id === service.id)
          .assignments.map((a: { userId: string; isAbsentTaker: boolean }) => [
            a.userId,
            a.isAbsentTaker,
          ]),
      );
      expect(flags[taker.id]).toBe(true);
      expect(flags[amy.id]).toBe(false);
    });
  });

  describe('recording absences', () => {
    it('the taker records and removes an absence; PUT and DELETE are idempotent', async () => {
      const { service, team, taker, amy } = await world();
      const h = await headersFor(taker);
      const path = absencePath(service.id, team.id, amy.id);
      await request(http()).put(path).set(h).expect(204);
      await request(http()).put(path).set(h).expect(204);
      const rows = await absenceRows(service.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: amy.id,
        teamId: team.id,
        recordedBy: taker.id,
      });
      await request(http()).delete(path).set(h).expect(204);
      await request(http()).delete(path).set(h).expect(204);
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('ADMIN can record on a past service that has no taker', async () => {
      const { admin, service, team, amy } = await world();
      await dataSource
        .getRepository(ServiceAssignment)
        .update({ serviceId: service.id }, { isAbsentTaker: false });
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(admin))
        .expect(204);
      expect(await absenceRows(service.id)).toHaveLength(1);
    });

    it('a leader who is not the taker records and removes an absence', async () => {
      const { service, team, leader, amy } = await world();
      const h = await headersFor(leader);
      const path = absencePath(service.id, team.id, amy.id);
      await request(http()).put(path).set(h).expect(204);
      await request(http()).put(path).set(h).expect(204);
      const rows = await absenceRows(service.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: amy.id,
        teamId: team.id,
        recordedBy: leader.id,
      });
      await request(http()).delete(path).set(h).expect(204);
      await request(http()).delete(path).set(h).expect(204);
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('a leader can record on a past service that has no taker', async () => {
      const { service, team, leader, amy } = await world();
      await dataSource
        .getRepository(ServiceAssignment)
        .update({ serviceId: service.id }, { isAbsentTaker: false });
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(leader))
        .expect(204);
      expect(await absenceRows(service.id)).toHaveLength(1);
    });

    it('a leader gets 409 SERVICE_NOT_STARTED before the start', async () => {
      const { service, team, leader, amy } = await world(2 * DAY);
      const h = await headersFor(leader);
      for (const m of ['put', 'delete'] as const) {
        const res = await request(http())
          [m](absencePath(service.id, team.id, amy.id))
          .set(h)
          .expect(409);
        expect(res.body.code).toBe('SERVICE_NOT_STARTED');
      }
    });

    it('a leader gets INVALID_USERS for a user not assigned by the team', async () => {
      const { service, team, leader } = await world();
      const loner = await createUser();
      const res = await request(http())
        .put(absencePath(service.id, team.id, loner.id))
        .set(await headersFor(leader))
        .expect(400);
      expect(res.body.code).toBe('INVALID_USERS');
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('400 CANNOT_MARK_SELF when an assigned leader targets themselves', async () => {
      const { service, team, leader } = await world();
      await insertAssignment(service, leader, team, leader);
      const res = await request(http())
        .put(absencePath(service.id, team.id, leader.id))
        .set(await headersFor(leader))
        .expect(400);
      expect(res.body.code).toBe('CANNOT_MARK_SELF');
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('409 SERVICE_NOT_STARTED before the start, for PUT and DELETE', async () => {
      const { service, team, taker, amy } = await world(2 * DAY);
      const h = await headersFor(taker);
      for (const m of ['put', 'delete'] as const) {
        const res = await request(http())
          [m](absencePath(service.id, team.id, amy.id))
          .set(h)
          .expect(409);
        expect(res.body.code).toBe('SERVICE_NOT_STARTED');
      }
    });

    it('400 CANNOT_MARK_SELF when the taker targets themselves', async () => {
      const { service, team, taker } = await world();
      const res = await request(http())
        .put(absencePath(service.id, team.id, taker.id))
        .set(await headersFor(taker))
        .expect(400);
      expect(res.body.code).toBe('CANNOT_MARK_SELF');
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('rejects a target not assigned by that team (other team, unassigned)', async () => {
      const { admin, service, team, taker } = await world();
      const teamB = await createTeam('Team B');
      const other = await createUser();
      await addMember(teamB, other);
      await insertAssignment(service, other, teamB, admin);
      const loner = await createUser();
      const h = await headersFor(taker);
      for (const u of [other, loner]) {
        const res = await request(http())
          .put(absencePath(service.id, team.id, u.id))
          .set(h)
          .expect(400);
        expect(res.body.code).toBe('INVALID_USERS');
        expect(res.body.invalidUserIds).toEqual([u.id]);
        await request(http())
          .delete(absencePath(service.id, team.id, u.id))
          .set(h)
          .expect(400);
      }
      expect(await absenceRows(service.id)).toHaveLength(0);
    });

    it('404 for a soft-deleted service', async () => {
      const { admin, service, team, amy } = await world();
      await dataSource.getRepository(Service).softDelete(service.id);
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(admin))
        .expect(404);
    });
  });

  describe('recorded absences for a service and team', () => {
    const readPath = (s: string, t: string) =>
      `/services/${s}/teams/${t}/absences`;

    it('returns the recorded user ids to the taker, the leader and ADMIN', async () => {
      const { admin, service, team, leader, taker, amy, bob } = await world();
      const h = await headersFor(taker);
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(h)
        .expect(204);
      for (const u of [taker, leader, admin]) {
        const res = await request(http())
          .get(readPath(service.id, team.id))
          .set(await headersFor(u))
          .expect(200);
        expect(res.body).toEqual({ userIds: [amy.id] });
      }
      await request(http())
        .put(absencePath(service.id, team.id, bob.id))
        .set(h)
        .expect(204);
      const res = await request(http())
        .get(readPath(service.id, team.id))
        .set(h)
        .expect(200);
      expect(new Set<string>(res.body.userIds)).toEqual(new Set([amy.id, bob.id]));
    });

    it('returns an empty list when nothing is recorded, and works before the start', async () => {
      const { service, team, taker } = await world(2 * DAY);
      const res = await request(http())
        .get(readPath(service.id, team.id))
        .set(await headersFor(taker))
        .expect(200);
      expect(res.body).toEqual({ userIds: [] });
    });

    it("only lists that team's absences", async () => {
      const { admin, service, team, taker } = await world();
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      const other = await createUser();
      await addMember(teamB, other);
      await insertAssignment(service, other, teamB, leaderB);
      await dataSource.getRepository(ServiceAbsence).save({
        serviceId: service.id,
        userId: other.id,
        teamId: teamB.id,
        recordedBy: admin.id,
      });
      const res = await request(http())
        .get(readPath(service.id, team.id))
        .set(await headersFor(taker))
        .expect(200);
      expect(res.body).toEqual({ userIds: [] });
    });

    it('403 for everyone else: members, PEMBINA, another team, no token is 401', async () => {
      const { service, team, amy } = await world();
      const pembina = await createUser({ role: UserRole.PEMBINA });
      const teamB = await createTeam('Team B');
      const leaderB = await createUser();
      await addMember(teamB, leaderB, true);
      for (const u of [amy, pembina, leaderB]) {
        await request(http())
          .get(readPath(service.id, team.id))
          .set(await headersFor(u))
          .expect(403);
      }
      await request(http()).get(readPath(service.id, team.id)).expect(401);
    });

    it('400 for a malformed id; 404 for an unknown or soft-deleted service, unknown team (ADMIN)', async () => {
      const { admin, service, team } = await world();
      const h = await headersFor(admin);
      await request(http()).get(readPath('nope', team.id)).set(h).expect(400);
      await request(http()).get(readPath(service.id, 'nope')).set(h).expect(400);
      await request(http()).get(readPath(UNKNOWN_ID, team.id)).set(h).expect(404);
      await request(http())
        .get(readPath(service.id, UNKNOWN_ID))
        .set(h)
        .expect(404);
      await dataSource.getRepository(Service).softDelete(service.id);
      await request(http()).get(readPath(service.id, team.id)).set(h).expect(404);
    });
  });

  describe('counts', () => {
    it('GET /me/absences derives the count, newest first, including deleted services', async () => {
      const { admin, service, team, leader, taker, amy } = await world();
      const older = await insertService(admin.id, -3 * DAY);
      await insertAssignment(older, amy, team, leader);
      await insertAssignment(older, taker, team, leader);
      await dataSource
        .getRepository(ServiceAssignment)
        .update(
          { serviceId: older.id, userId: taker.id },
          { isAbsentTaker: true },
        );
      const h = await headersFor(taker);
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(h)
        .expect(204);
      await request(http())
        .put(absencePath(older.id, team.id, amy.id))
        .set(h)
        .expect(204);
      await dataSource.getRepository(Service).softDelete(older.id);

      const res = await request(http())
        .get('/me/absences')
        .set(await headersFor(amy))
        .expect(200);
      expect(res.body.count).toBe(2);
      expect(
        res.body.items.map((i: { serviceId: string }) => i.serviceId),
      ).toEqual([service.id, older.id]);
      expect(res.body.items[0]).toEqual({
        serviceId: service.id,
        title: 'Sunday Service',
        startsAt: service.startsAt.toISOString(),
      });
      const none = await request(http())
        .get('/me/absences')
        .set(await headersFor(taker))
        .expect(200);
      expect(none.body).toEqual({ count: 0, items: [] });

      await request(http())
        .delete(absencePath(service.id, team.id, amy.id))
        .set(h)
        .expect(204);
      const after = await request(http())
        .get('/me/absences')
        .set(await headersFor(amy))
        .expect(200);
      expect(after.body.count).toBe(1);
    });

    it('GET /teams/:teamId/absences lists active members with counts; leader, ADMIN and PEMBINA only', async () => {
      const { admin, service, team, leader, taker, amy, bob } = await world();
      const gone = await createUser({ name: 'Gone', isActive: false });
      await addMember(team, gone);
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(taker))
        .expect(204);
      const lh = await headersFor(leader);
      const res = await request(http())
        .get(`/teams/${team.id}/absences`)
        .set(lh)
        .expect(200);
      expect(res.body).toEqual([
        { userId: amy.id, name: 'Amy', count: 1 },
        { userId: bob.id, name: 'Bob', count: 0 },
        { userId: leader.id, name: 'Leader A', count: 0 },
        { userId: taker.id, name: 'Taker', count: 0 },
      ]);
      await request(http())
        .get(`/teams/${team.id}/absences`)
        .set(await headersFor(admin))
        .expect(200);
      const pembina = await createUser({ role: UserRole.PEMBINA });
      await request(http())
        .get(`/teams/${team.id}/absences`)
        .set(await headersFor(pembina))
        .expect(200);
      await request(http())
        .get(`/teams/${team.id}/absences`)
        .set(await headersFor(taker))
        .expect(403);
      await request(http())
        .get(`/teams/${UNKNOWN_ID}/absences`)
        .set(lh)
        .expect(403);
      await request(http())
        .get(`/teams/${UNKNOWN_ID}/absences`)
        .set(await headersFor(admin))
        .expect(404);
    });

    it('GET /teams/:teamId/absences/:userId lists the services a member missed', async () => {
      const { admin, service, team, leader, taker, amy, bob } = await world();
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(taker))
        .expect(204);
      const lh = await headersFor(leader);
      const res = await request(http())
        .get(`/teams/${team.id}/absences/${amy.id}`)
        .set(lh)
        .expect(200);
      expect(res.body.count).toBe(1);
      expect(res.body.items[0]).toMatchObject({ serviceId: service.id });
      const none = await request(http())
        .get(`/teams/${team.id}/absences/${bob.id}`)
        .set(await headersFor(admin))
        .expect(200);
      expect(none.body).toEqual({ count: 0, items: [] });
      await request(http())
        .get(`/teams/${team.id}/absences/${amy.id}`)
        .set(await headersFor(taker))
        .expect(403);
      await request(http())
        .get(`/teams/${team.id}/absences/${UNKNOWN_ID}`)
        .set(lh)
        .expect(404);
    });

    it("counts a member's absences from every team", async () => {
      const { admin, service, team, taker, amy } = await world();
      await request(http())
        .put(absencePath(service.id, team.id, amy.id))
        .set(await headersFor(taker))
        .expect(204);
      const teamB = await createTeam('Team B');
      await addMember(teamB, amy);
      const res = await request(http())
        .get(`/teams/${teamB.id}/absences`)
        .set(await headersFor(admin))
        .expect(200);
      expect(res.body).toEqual([{ userId: amy.id, name: 'Amy', count: 1 }]);
    });
  });

  describe('assignments with recorded absences', () => {
    // Only reachable if a started service is moved back into the future
    async function withAbsence() {
      const w = await world();
      await request(http())
        .put(absencePath(w.service.id, w.team.id, w.amy.id))
        .set(await headersFor(w.taker))
        .expect(204);
      await dataSource.getRepository(Service).update(w.service.id, {
        startsAt: new Date(Date.now() + DAY),
        endsAt: new Date(Date.now() + DAY + 2 * HOUR),
      });
      return w;
    }

    it('unassign answers 409 HAS_ATTENDANCE_RECORDS and keeps everything', async () => {
      const { service, team, leader, amy } = await withAbsence();
      const res = await request(http())
        .delete(
          `/services/${service.id}/teams/${team.id}/assignments/${amy.id}`,
        )
        .set(await headersFor(leader))
        .expect(409);
      expect(res.body.code).toBe('HAS_ATTENDANCE_RECORDS');
      expect(await rowsFor(service.id)).toHaveLength(3);
    });

    it('removing the member from the team answers 409 and rolls back', async () => {
      const { admin, team, amy } = await withAbsence();
      const res = await request(http())
        .delete(`/teams/${team.id}/members/${amy.id}`)
        .set(await headersFor(admin))
        .expect(409);
      expect(res.body.code).toBe('HAS_ATTENDANCE_RECORDS');
      const still = await dataSource
        .getRepository(TeamMember)
        .countBy({ teamId: team.id, userId: amy.id });
      expect(still).toBe(1);
    });

    it('unassigning the taker clears the role (no absences yet)', async () => {
      const { service, team, leader, taker } = await world(2 * DAY);
      await request(http())
        .delete(
          `/services/${service.id}/teams/${team.id}/assignments/${taker.id}`,
        )
        .set(await headersFor(leader))
        .expect(204);
      const rows = await rowsFor(service.id);
      expect(rows.some((r) => r.isAbsentTaker)).toBe(false);
    });
  });
});
