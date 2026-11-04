import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ServiceAssignment } from '../src/assignments/entities/service-assignment.entity.js';
import { ServiceUnavailability } from '../src/availability/entities/service-unavailability.entity.js';
import { Service } from '../src/services/entities/service.entity.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase } from './utils/test-app.js';

const PASSWORD = 'password123';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('Availability (e2e)', () => {
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

  const unavailRows = (serviceId: string) =>
    dataSource.getRepository(ServiceUnavailability).findBy({ serviceId });
  const unavailPath = (s: string) => `/services/${s}/unavailability`;

  async function world() {
    const admin = await createUser({ role: UserRole.ADMIN, name: 'Admin' });
    const service = await insertService(admin.id);
    const team = await createTeam('Team A');
    const leader = await createUser({ name: 'Leader A' });
    await addMember(team, leader, true);
    const member = await createUser({ name: 'Member' });
    await addMember(team, member);
    return { admin, service, team, leader, member };
  }

  describe('access and validation', () => {
    it('returns 401 without a token on every route', async () => {
      await request(http()).put(unavailPath(UNKNOWN_ID)).expect(401);
      await request(http()).delete(unavailPath(UNKNOWN_ID)).expect(401);
      await request(http()).get('/me/unavailability').expect(401);
    });

    it('returns 404 for unknown and soft-deleted services', async () => {
      const { admin, member, service } = await world();
      const h = await headersFor(member);
      await request(http()).put(unavailPath(UNKNOWN_ID)).set(h).expect(404);
      await request(http()).delete(unavailPath(UNKNOWN_ID)).set(h).expect(404);
      await dataSource.getRepository(Service).softDelete(service.id);
      await request(http()).put(unavailPath(service.id)).set(h).expect(404);
      await request(http()).delete(unavailPath(service.id)).set(h).expect(404);
      expect(admin).toBeDefined();
    });

    it('returns 400 for a non-UUID id', async () => {
      const { member } = await world();
      const h = await headersFor(member);
      await request(http()).put(unavailPath('nope')).set(h).expect(400);
      await request(http()).delete(unavailPath('nope')).set(h).expect(400);
    });
  });

  describe('mark and unmark', () => {
    it('PUT and DELETE are idempotent (204)', async () => {
      const { service, member } = await world();
      const h = await headersFor(member);
      await request(http()).put(unavailPath(service.id)).set(h).expect(204);
      await request(http()).put(unavailPath(service.id)).set(h).expect(204);
      expect(await unavailRows(service.id)).toHaveLength(1);
      await request(http()).delete(unavailPath(service.id)).set(h).expect(204);
      await request(http()).delete(unavailPath(service.id)).set(h).expect(204);
      expect(await unavailRows(service.id)).toHaveLength(0);
    });

    it('works for any role, including ADMIN and PEMBINA', async () => {
      const { service, admin } = await world();
      const pembina = await createUser({ role: UserRole.PEMBINA });
      for (const u of [admin, pembina]) {
        await request(http())
          .put(unavailPath(service.id))
          .set(await headersFor(u))
          .expect(204);
      }
      expect(await unavailRows(service.id)).toHaveLength(2);
    });

    it('409 SERVICE_ALREADY_STARTED on a started service', async () => {
      const { admin, member } = await world();
      const started = await insertService(admin.id, -HOUR);
      const h = await headersFor(member);
      for (const m of ['put', 'delete'] as const) {
        const res = await request(http())
          [m](unavailPath(started.id))
          .set(h)
          .expect(409);
        expect(res.body.code).toBe('SERVICE_ALREADY_STARTED');
      }
    });

    it('409 ALREADY_ASSIGNED when the member is assigned', async () => {
      const { service, team, leader, member } = await world();
      await insertAssignment(service, member, team, leader);
      const res = await request(http())
        .put(unavailPath(service.id))
        .set(await headersFor(member))
        .expect(409);
      expect(res.body.code).toBe('ALREADY_ASSIGNED');
      expect(await unavailRows(service.id)).toHaveLength(0);
    });

    it('GET /me/unavailability lists only upcoming, live services of the caller', async () => {
      const { admin, service, member } = await world();
      const other = await insertService(admin.id, 3 * DAY);
      const deleted = await insertService(admin.id, 4 * DAY);
      const past = await insertService(admin.id, 5 * DAY);
      const repo = dataSource.getRepository(ServiceUnavailability);
      const rows = [service, other, deleted, past].map((s) => ({
        serviceId: s.id,
        userId: member.id,
      }));
      await repo.save(rows);
      await dataSource.getRepository(Service).softDelete(deleted.id);
      await dataSource.getRepository(Service).update(past.id, {
        startsAt: new Date(Date.now() - 3 * HOUR),
        endsAt: new Date(Date.now() - HOUR),
      });
      const res = await request(http())
        .get('/me/unavailability')
        .set(await headersFor(member))
        .expect(200);
      expect(res.body).toEqual([service.id, other.id]);
      const none = await request(http())
        .get('/me/unavailability')
        .set(await headersFor(admin))
        .expect(200);
      expect(none.body).toEqual([]);
    });
  });

  describe('interaction with assignments and schedule', () => {
    it('new services default to available', async () => {
      const { member, service } = await world();
      const res = await request(http())
        .get('/services')
        .set(await headersFor(member))
        .expect(200);
      expect(
        res.body.find((s: { id: string }) => s.id === service.id).unavailable,
      ).toBe(false);
    });

    it('GET /services flags the caller as unavailable', async () => {
      const { member, leader, service } = await world();
      await request(http())
        .put(unavailPath(service.id))
        .set(await headersFor(member))
        .expect(204);
      const mine = await request(http())
        .get('/services')
        .set(await headersFor(member))
        .expect(200);
      expect(mine.body[0].unavailable).toBe(true);
      const theirs = await request(http())
        .get('/services')
        .set(await headersFor(leader))
        .expect(200);
      expect(theirs.body[0].unavailable).toBe(false);
    });

    it('candidates flag unavailable members', async () => {
      const { service, team, leader, member } = await world();
      await request(http())
        .put(unavailPath(service.id))
        .set(await headersFor(member))
        .expect(204);
      const res = await request(http())
        .get(`/services/${service.id}/teams/${team.id}/candidates`)
        .set(await headersFor(leader))
        .expect(200);
      const byName = Object.fromEntries(
        res.body.map((c: { name: string; unavailable: boolean }) => [
          c.name,
          c.unavailable,
        ]),
      );
      expect(byName).toEqual({ 'Leader A': false, Member: true });
    });

    it('assign skips an unavailable user with reason UNAVAILABLE and assigns the rest', async () => {
      const { service, team, leader, member } = await world();
      const other = await createUser({ name: 'Other' });
      await addMember(team, other);
      await request(http())
        .put(unavailPath(service.id))
        .set(await headersFor(member))
        .expect(204);
      const res = await request(http())
        .post(`/services/${service.id}/teams/${team.id}/assignments`)
        .set(await headersFor(leader))
        .send({ userIds: [member.id, other.id] })
        .expect(200);
      expect(res.body.assigned).toEqual([other.id]);
      expect(res.body.skipped).toEqual([
        { userId: member.id, reason: 'UNAVAILABLE' },
      ]);
      const rows = await dataSource
        .getRepository(ServiceAssignment)
        .findBy({ serviceId: service.id });
      expect(rows.map((r) => r.userId)).toEqual([other.id]);
    });

    it('unmarking makes the user assignable again', async () => {
      const { service, team, leader, member } = await world();
      const h = await headersFor(member);
      await request(http()).put(unavailPath(service.id)).set(h).expect(204);
      await request(http()).delete(unavailPath(service.id)).set(h).expect(204);
      const res = await request(http())
        .post(`/services/${service.id}/teams/${team.id}/assignments`)
        .set(await headersFor(leader))
        .send({ userIds: [member.id] })
        .expect(200);
      expect(res.body.assigned).toEqual([member.id]);
    });
  });

  describe('concurrency', () => {
    it('never leaves both an assignment and an unavailability row', async () => {
      const { admin, team, leader, member } = await world();
      const lh = await headersFor(leader);
      const mh = await headersFor(member);
      let assignedCount = 0;
      let unavailableCount = 0;
      for (let i = 0; i < 24; i++) {
        const svc = await insertService(admin.id, (3 + i) * DAY);
        const [a, u] = await Promise.all([
          request(http())
            .post(`/services/${svc.id}/teams/${team.id}/assignments`)
            .set(lh)
            .send({ userIds: [member.id] }),
          request(http()).put(unavailPath(svc.id)).set(mh),
        ]);
        expect([200]).toContain(a.status);
        expect([204, 409]).toContain(u.status);
        const assigned = await rowsFor(svc.id);
        const unavailable = await unavailRows(svc.id);
        expect(assigned.length + unavailable.length).toBe(1);
        if (assigned.length) assignedCount++;
        else unavailableCount++;
      }
      expect(assignedCount + unavailableCount).toBe(24);
    });
  });
});
