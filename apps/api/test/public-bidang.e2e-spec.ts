import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PrayerRequest } from '../src/prayer-requests/entities/prayer-request.entity.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { VolunteerApplicationBidang } from '../src/volunteer-applications/entities/volunteer-application-bidang.entity.js';
import { VolunteerApplication } from '../src/volunteer-applications/entities/volunteer-application.entity.js';
import { cleanDatabase } from './utils/test-app.js';
import {
  createAppWithResettableThrottle,
  type ResettableThrottlerStorage,
} from './utils/resettable-throttler-storage.js';

const PASSWORD = 'password123';

describe('Public bidang and submission relations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storage: ResettableThrottlerStorage;
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    ({ app, storage } = await createAppWithResettableThrottle());
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    storage.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(role: UserRole = UserRole.MEMBER): Promise<User> {
    return dataSource.getRepository(User).save({
      name: 'Test User',
      email: `u${Math.random().toString(36).slice(2)}@echo.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role,
      mustChangePassword: false,
      isActive: true,
    });
  }

  async function tokenFor(user: User): Promise<string> {
    const res = await request(http())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  const createTeam = (name: string) =>
    dataSource.getRepository(Team).save({ name });

  describe('GET /public/bidang', () => {
    it('returns [] when there are no teams, without a token', async () => {
      const res = await request(http()).get('/public/bidang').expect(200);
      expect(res.body).toEqual([]);
    });

    it('exposes only id and name, ordered by name, and no member data', async () => {
      const music = await createTeam('Music');
      const worship = await createTeam('Worship');
      const leader = await createUser();
      await dataSource
        .getRepository(TeamMember)
        .save({ teamId: worship.id, userId: leader.id, isLeader: true });
      const res = await request(http()).get('/public/bidang').expect(200);
      expect(res.body).toEqual([
        { id: music.id, name: 'Music' },
        { id: worship.id, name: 'Worship' },
      ]);
      for (const item of res.body as object[]) {
        expect(Object.keys(item).sort()).toEqual(['id', 'name']);
      }
      expect(JSON.stringify(res.body)).not.toContain(leader.email);
      expect(JSON.stringify(res.body)).not.toContain(leader.name);
    });

    it('also works with a valid token and has no write methods', async () => {
      await createTeam('Music');
      const token = await tokenFor(await createUser());
      await request(http())
        .get('/public/bidang')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(http()).post('/public/bidang').send({}).expect(404);
      await request(http()).delete('/public/bidang').expect(404);
    });
  });

  describe('deleting users and teams keeps submissions', () => {
    it('keeps submissions with handled_by NULL when the handling user is deleted', async () => {
      const admin = await createUser(UserRole.ADMIN);
      const handler = await createUser();
      const prayer = await dataSource.getRepository(PrayerRequest).save({
        content: 'x',
        consentAt: new Date(),
        handledBy: handler.id,
        handledAt: new Date(),
      });
      const application = await dataSource
        .getRepository(VolunteerApplication)
        .save({
          fullName: 'A',
          whatsapp: '1',
          consentAt: new Date(),
          handledBy: handler.id,
          handledAt: new Date(),
        });
      const token = await tokenFor(admin);
      await request(http())
        .delete(`/users/${handler.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      const prayerAfter = await dataSource
        .getRepository(PrayerRequest)
        .findOneByOrFail({ id: prayer.id });
      const applicationAfter = await dataSource
        .getRepository(VolunteerApplication)
        .findOneByOrFail({ id: application.id });
      expect(prayerAfter.handledBy).toBeNull();
      expect(applicationAfter.handledBy).toBeNull();
    });

    it('is not blocked by a team deletion and drops only that team interest row', async () => {
      const admin = await createUser(UserRole.ADMIN);
      const worship = await createTeam('Worship');
      const music = await createTeam('Music');
      const application = await dataSource
        .getRepository(VolunteerApplication)
        .save({ fullName: 'A', whatsapp: '1', consentAt: new Date() });
      await dataSource.getRepository(VolunteerApplicationBidang).save([
        { applicationId: application.id, bidangId: worship.id },
        { applicationId: application.id, bidangId: music.id },
      ]);
      const token = await tokenFor(admin);
      await request(http())
        .delete(`/teams/${worship.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      expect(
        await dataSource
          .getRepository(VolunteerApplication)
          .existsBy({ id: application.id }),
      ).toBe(true);
      const left = await dataSource
        .getRepository(VolunteerApplicationBidang)
        .find();
      expect(left.map((i) => i.bidangId)).toEqual([music.id]);
    });

    it('removes interest rows with the application', async () => {
      const team = await createTeam('Worship');
      const application = await dataSource
        .getRepository(VolunteerApplication)
        .save({ fullName: 'A', whatsapp: '1', consentAt: new Date() });
      await dataSource
        .getRepository(VolunteerApplicationBidang)
        .save({ applicationId: application.id, bidangId: team.id });
      await dataSource
        .getRepository(VolunteerApplication)
        .delete({ id: application.id });
      expect(
        await dataSource.getRepository(VolunteerApplicationBidang).count(),
      ).toBe(0);
    });
  });

  describe('schema', () => {
    it('rejects an unknown status, an unknown bidang and a duplicate interest', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO prayer_requests (content, consent_at, status) VALUES ('x', now(), 'BOGUS')`,
        ),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        dataSource.query(
          `INSERT INTO volunteer_applications (full_name, whatsapp, consent_at, status) VALUES ('a', '1', now(), 'BOGUS')`,
        ),
      ).rejects.toMatchObject({ code: '22P02' });
      const team = await createTeam('Worship');
      const [{ id }] = await dataSource.query(
        `INSERT INTO volunteer_applications (full_name, whatsapp, consent_at) VALUES ('a', '1', now()) RETURNING id`,
      );
      await expect(
        dataSource.query(
          `INSERT INTO volunteer_application_bidang (application_id, bidang_id) VALUES ($1, '00000000-0000-4000-8000-000000000000')`,
          [id],
        ),
      ).rejects.toMatchObject({ code: '23503' });
      const insert = () =>
        dataSource.query(
          `INSERT INTO volunteer_application_bidang (application_id, bidang_id) VALUES ($1, $2)`,
          [id, team.id],
        );
      await insert();
      await expect(insert()).rejects.toMatchObject({ code: '23505' });
    });
  });
});
