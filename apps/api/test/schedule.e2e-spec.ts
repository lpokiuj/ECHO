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
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('Schedule views (e2e)', () => {
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
  const headersFor = async (user: User) => bearer(await tokenFor(user));

  const createTeam = (name = `Team ${Math.random().toString(36).slice(2)}`) =>
    dataSource.getRepository(Team).save({ name });

  const addMember = (teamId: string, userId: string, isLeader = false) =>
    dataSource.getRepository(TeamMember).save({ teamId, userId, isLeader });

  // offsetMs is the start; the service lasts durationMs
  function createService(
    createdBy: string,
    offsetMs: number,
    title = 'Service',
    opts: { durationMs?: number; deletedAt?: Date | null } = {},
  ): Promise<Service> {
    const startsAt = new Date(Date.now() + offsetMs);
    return dataSource.getRepository(Service).save({
      title,
      startsAt,
      endsAt: new Date(startsAt.getTime() + (opts.durationMs ?? 2 * HOUR)),
      createdBy,
      deletedAt: opts.deletedAt ?? null,
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

  describe('GET /services', () => {
    it('returns 401 without a token', async () => {
      await request(http()).get('/services').expect(401);
    });

    it('returns 403 while must_change_password is true', async () => {
      const user = await createUser({ mustChangePassword: true });
      const h1 = await headersFor(user);
      await request(http())
        .get('/services')
        .set(h1)
        .expect(403);
    });

    it('returns the same body for ADMIN, PEMBINA, a leader, and a plain MEMBER', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const pembina = await createUser({ role: UserRole.PEMBINA });
      const leader = await createUser();
      const member = await createUser();
      const team = await createTeam();
      await addMember(team.id, leader.id, true);
      await addMember(team.id, member.id);
      const service = await createService(admin.id, DAY);
      await assign(service.id, member.id, team.id, leader.id);

      const bodies: unknown[] = [];
      for (const user of [admin, pembina, leader, member]) {
        const h2 = await headersFor(user);
        const res = await request(http())
          .get('/services')
          .set(h2)
          .expect(200);
        bodies.push(res.body);
      }

      expect((bodies[0] as unknown[]).length).toBe(1);
      for (const body of bodies) expect(body).toEqual(bodies[0]);
    });

    it('shows assignments from every team, ordered by team name then name', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const music = await createTeam('Music');
      const sound = await createTeam('Sound');
      const zed = await createUser({ name: 'Zed' });
      const amy = await createUser({ name: 'Amy' });
      const bob = await createUser({ name: 'Bob' });
      for (const [team, user] of [
        [sound, amy],
        [music, zed],
        [music, bob],
      ] as const) {
        await addMember(team.id, user.id);
      }
      const service = await createService(admin.id, DAY, 'Sunday');
      await assign(service.id, amy.id, sound.id, admin.id);
      await assign(service.id, zed.id, music.id, admin.id);
      await assign(service.id, bob.id, music.id, admin.id);

      const h3 = await headersFor(bob);
      const res = await request(http())
        .get('/services')
        .set(h3)
        .expect(200);

      expect(res.body).toEqual([
        {
          id: service.id,
          title: 'Sunday',
          startsAt: service.startsAt.toISOString(),
          endsAt: service.endsAt.toISOString(),
          assignments: [
            { userId: bob.id, name: 'Bob', teamId: music.id, teamName: 'Music', notes: '' },
            { userId: zed.id, name: 'Zed', teamId: music.id, teamName: 'Music', notes: '' },
            { userId: amy.id, name: 'Amy', teamId: sound.id, teamName: 'Sound', notes: '' },
          ],
        },
      ]);
    });

    it('orders services by startsAt then title and shows empty assignments', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const later = await createService(admin.id, 3 * DAY, 'A later');
      const tieB = await createService(admin.id, DAY, 'B');
      const tieA = await dataSource.getRepository(Service).save({
        title: 'A',
        startsAt: tieB.startsAt,
        endsAt: tieB.endsAt,
        createdBy: admin.id,
      });

      const h4 = await headersFor(admin);
      const res = await request(http())
        .get('/services')
        .set(h4)
        .expect(200);

      expect(res.body.map((s: { id: string }) => s.id)).toEqual([
        tieA.id,
        tieB.id,
        later.id,
      ]);
      for (const s of res.body) expect(s.assignments).toEqual([]);
    });

    it('hides deleted services', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      await createService(admin.id, DAY, 'Gone', { deletedAt: new Date() });
      const kept = await createService(admin.id, 2 * DAY, 'Kept');

      const h5 = await headersFor(admin);
      const res = await request(http())
        .get('/services')
        .set(h5)
        .expect(200);

      expect(res.body.map((s: { id: string }) => s.id)).toEqual([kept.id]);
    });

    it('excludes ended services by default and includes them with includePast=true', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const headers = await headersFor(admin);
      const ended = await createService(admin.id, -3 * DAY, 'Ended');
      // Started but not yet ended: still listed (ends_at > now)
      const running = await createService(admin.id, -HOUR, 'Running');
      const upcoming = await createService(admin.id, DAY, 'Upcoming');

      const byDefault = await request(http())
        .get('/services')
        .set(headers)
        .expect(200);
      expect(byDefault.body.map((s: { id: string }) => s.id)).toEqual([
        running.id,
        upcoming.id,
      ]);

      const all = await request(http())
        .get('/services?includePast=true')
        .set(headers)
        .expect(200);
      expect(all.body.map((s: { id: string }) => s.id)).toEqual([
        ended.id,
        running.id,
        upcoming.id,
      ]);

      const explicitFalse = await request(http())
        .get('/services?includePast=false')
        .set(headers)
        .expect(200);
      expect(explicitFalse.body).toEqual(byDefault.body);
    });

    it('returns 400 when includePast is not true or false', async () => {
      const headers = await headersFor(await createUser());
      await request(http())
        .get('/services?includePast=maybe')
        .set(headers)
        .expect(400);
    });

    it('never exposes emails, password hashes, or isActive', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam();
      const volunteer = await createUser({ name: 'Vol' });
      await addMember(team.id, volunteer.id);
      const service = await createService(admin.id, DAY);
      await assign(service.id, volunteer.id, team.id, admin.id);

      const h6 = await headersFor(volunteer);
      const res = await request(http())
        .get('/services')
        .set(h6)
        .expect(200);

      const json = JSON.stringify(res.body);
      for (const user of [admin, volunteer]) {
        expect(json).not.toContain(user.email);
      }
      expect(json).not.toContain('passwordHash');
      expect(json).not.toContain('"email"');
      expect(json).not.toContain('isActive');
    });

    it('keeps a deactivated user visible in assignments', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam();
      const gone = await createUser({ name: 'Gone', isActive: false });
      await addMember(team.id, gone.id);
      const service = await createService(admin.id, DAY);
      await assign(service.id, gone.id, team.id, admin.id);

      const h7 = await headersFor(admin);
      const res = await request(http())
        .get('/services')
        .set(h7)
        .expect(200);

      expect(res.body[0].assignments).toEqual([
        { userId: gone.id, name: 'Gone', teamId: team.id, teamName: team.name, notes: '' },
      ]);
    });
  });

  describe('GET /me/schedule', () => {
    it('returns 401 without a token', async () => {
      await request(http()).get('/me/schedule').expect(401);
    });

    it('returns 403 while must_change_password is true', async () => {
      const user = await createUser({ mustChangePassword: true });
      const h8 = await headersFor(user);
      await request(http())
        .get('/me/schedule')
        .set(h8)
        .expect(403);
    });

    it('returns only the caller own rows, never another user data', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam('Music');
      const me = await createUser({ name: 'Me' });
      const other = await createUser({ name: 'Other' });
      await addMember(team.id, me.id);
      await addMember(team.id, other.id);
      const service = await createService(admin.id, DAY, 'Shared');
      await assign(service.id, me.id, team.id, admin.id);
      await assign(service.id, other.id, team.id, admin.id);
      const otherOnly = await createService(admin.id, 2 * DAY, 'Not mine');
      await assign(otherOnly.id, other.id, team.id, admin.id);

      const h9 = await headersFor(me);
      const res = await request(http())
        .get('/me/schedule')
        .set(h9)
        .expect(200);

      expect(res.body).toEqual([
        {
          serviceId: service.id,
          title: 'Shared',
          startsAt: service.startsAt.toISOString(),
          endsAt: service.endsAt.toISOString(),
          teamId: team.id,
          teamName: 'Music',
          notes: '',
        },
      ]);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('Other');
      expect(json).not.toContain(other.id);
    });

    it('lists each service once for a volunteer in several teams, ordered by startsAt', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const music = await createTeam('Music');
      const sound = await createTeam('Sound');
      const me = await createUser();
      await addMember(music.id, me.id);
      await addMember(sound.id, me.id);
      const first = await createService(admin.id, DAY, 'First');
      const second = await createService(admin.id, 2 * DAY, 'Second');
      await assign(second.id, me.id, sound.id, admin.id);
      await assign(first.id, me.id, music.id, admin.id);

      const h10 = await headersFor(me);
      const res = await request(http())
        .get('/me/schedule')
        .set(h10)
        .expect(200);

      expect(
        res.body.map((r: { serviceId: string; teamName: string }) => [
          r.serviceId,
          r.teamName,
        ]),
      ).toEqual([
        [first.id, 'Music'],
        [second.id, 'Sound'],
      ]);
    });

    it('returns an empty list when nothing is assigned', async () => {
      const me = await createUser();
      const h11 = await headersFor(me);
      const res = await request(http())
        .get('/me/schedule')
        .set(h11)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('hides deleted services', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam();
      const me = await createUser();
      await addMember(team.id, me.id);
      const gone = await createService(admin.id, DAY, 'Gone', {
        deletedAt: new Date(),
      });
      await assign(gone.id, me.id, team.id, admin.id);

      const h12 = await headersFor(me);
      const res = await request(http())
        .get('/me/schedule')
        .set(h12)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('excludes ended services by default and includes them with includePast=true', async () => {
      const admin = await createUser({ role: UserRole.ADMIN });
      const team = await createTeam();
      const me = await createUser();
      await addMember(team.id, me.id);
      const headers = await headersFor(me);
      const ended = await createService(admin.id, -3 * DAY, 'Ended');
      const upcoming = await createService(admin.id, DAY, 'Upcoming');
      await assign(ended.id, me.id, team.id, admin.id);
      await assign(upcoming.id, me.id, team.id, admin.id);

      const byDefault = await request(http())
        .get('/me/schedule')
        .set(headers)
        .expect(200);
      expect(byDefault.body.map((r: { serviceId: string }) => r.serviceId)).toEqual(
        [upcoming.id],
      );

      const all = await request(http())
        .get('/me/schedule?includePast=true')
        .set(headers)
        .expect(200);
      expect(all.body.map((r: { serviceId: string }) => r.serviceId)).toEqual([
        ended.id,
        upcoming.id,
      ]);
    });

    it('returns 400 when includePast is not true or false', async () => {
      const headers = await headersFor(await createUser());
      await request(http())
        .get('/me/schedule?includePast=1')
        .set(headers)
        .expect(400);
    });
  });
});
