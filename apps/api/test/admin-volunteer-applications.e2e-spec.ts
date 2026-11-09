import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { VolunteerApplicationBidang } from '../src/volunteer-applications/entities/volunteer-application-bidang.entity.js';
import {
  VolunteerApplication,
  VolunteerApplicationStatus,
} from '../src/volunteer-applications/entities/volunteer-application.entity.js';
import {
  type AuthHeader,
  createKit,
  UNKNOWN_ID,
} from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

describe('Admin volunteer applications (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kit: ReturnType<typeof createKit>;
  let admin: User;
  let adminH: AuthHeader;

  const get = (query = '', h = adminH) =>
    request(kit.http()).get(`/admin/volunteer-applications${query}`).set(h);
  const patch = (id: string, body: object, h = adminH) =>
    request(kit.http()).patch(`/admin/volunteer-applications/${id}`).set(h).send(body);
  const del = (id: string, h = adminH) =>
    request(kit.http()).delete(`/admin/volunteer-applications/${id}`).set(h);
  const row = (id: string) =>
    dataSource.getRepository(VolunteerApplication).findOneBy({ id });
  const joinRows = () => dataSource.getRepository(VolunteerApplicationBidang).count();

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    kit = createKit(app, dataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    admin = await kit.createUser({ role: UserRole.ADMIN, name: 'Admin Anna' });
    adminH = await kit.headerFor(admin);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET', () => {
    it('lists newest first with the camelCase shape and bidang names', async () => {
      const music = await kit.createTeam('Music');
      const worship = await kit.createTeam('Worship');
      const old = await kit.createApplication({
        fullName: 'Old',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      const recent = await kit.createApplication(
        {
          fullName: 'Recent',
          whatsapp: '0813',
          email: 'r@echo.test',
          availability: 'Sundays',
          message: 'hi',
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
        [worship.id, music.id],
      );
      const res = await get().expect(200);
      expect(res.body.map((r: { id: string }) => r.id)).toEqual([recent.id, old.id]);
      expect(res.body[0]).toEqual({
        id: recent.id,
        fullName: 'Recent',
        whatsapp: '0813',
        email: 'r@echo.test',
        availability: 'Sundays',
        message: 'hi',
        bidang: [
          { id: music.id, name: 'Music' },
          { id: worship.id, name: 'Worship' },
        ],
        consentAt: expect.any(String),
        status: 'NEW',
        adminNote: null,
        handledBy: null,
        handledAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
      });
      expect(res.body[1].bidang).toEqual([]);
    });

    it('returns [] when empty', async () => {
      const res = await get().expect(200);
      expect(res.body).toEqual([]);
    });

    it('filters by status', async () => {
      const a = await kit.createApplication({ status: VolunteerApplicationStatus.NEW });
      const b = await kit.createApplication({ status: VolunteerApplicationStatus.CONTACTED });
      const c = await kit.createApplication({ status: VolunteerApplicationStatus.ACCEPTED });
      const d = await kit.createApplication({ status: VolunteerApplicationStatus.DECLINED });
      const ids = async (status: string) =>
        (await get(`?status=${status}`).expect(200)).body.map(
          (r: { id: string }) => r.id,
        );
      expect(await ids('NEW')).toEqual([a.id]);
      expect(await ids('CONTACTED')).toEqual([b.id]);
      expect(await ids('ACCEPTED')).toEqual([c.id]);
      expect(await ids('DECLINED')).toEqual([d.id]);
    });

    it('400 for an invalid, empty or repeated status', async () => {
      await get('?status=BOGUS').expect(400);
      await get('?status=').expect(400);
      await get('?status=DONE').expect(400);
      await get('?status=NEW&status=CONTACTED').expect(400);
    });

    it('works for PEMBINA too', async () => {
      await kit.createApplication();
      const h = await kit.headerFor(await kit.createUser({ role: UserRole.PEMBINA }));
      const res = await get('', h).expect(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PATCH', () => {
    it('sets status, handledBy and handledAt and returns the item with bidang', async () => {
      const team = await kit.createTeam('Sound');
      const app1 = await kit.createApplication({}, [team.id]);
      const before = Date.now();
      const res = await patch(app1.id, { status: 'CONTACTED' }).expect(200);
      expect(res.body).toMatchObject({
        id: app1.id,
        status: 'CONTACTED',
        adminNote: null,
        handledBy: { id: admin.id, name: 'Admin Anna' },
        bidang: [{ id: team.id, name: 'Sound' }],
        fullName: 'Applicant',
      });
      expect(Object.keys(res.body.handledBy).sort()).toEqual(['id', 'name']);
      expect(new Date(res.body.handledAt).getTime()).toBeGreaterThanOrEqual(before - 5000);
      const stored = await row(app1.id);
      expect(stored?.status).toBe(VolunteerApplicationStatus.CONTACTED);
      expect(stored?.handledBy).toBe(admin.id);
    });

    it('PEMBINA can patch and becomes handledBy', async () => {
      const pembina = await kit.createUser({ role: UserRole.PEMBINA, name: 'Pak Petrus' });
      const h = await kit.headerFor(pembina);
      const a = await kit.createApplication();
      const res = await patch(a.id, { status: 'ACCEPTED' }, h).expect(200);
      expect(res.body.handledBy).toEqual({ id: pembina.id, name: 'Pak Petrus' });
    });

    it('adminNote only: stores the trimmed note, sets handled fields, keeps status', async () => {
      const a = await kit.createApplication({ status: VolunteerApplicationStatus.CONTACTED });
      const res = await patch(a.id, { adminNote: '  asked to call  ' }).expect(200);
      expect(res.body.adminNote).toBe('asked to call');
      expect(res.body.status).toBe('CONTACTED');
      expect(res.body.handledBy.id).toBe(admin.id);
      expect(res.body.handledAt).not.toBeNull();
    });

    it('status only keeps an existing note', async () => {
      const a = await kit.createApplication({ adminNote: 'keep me' });
      const res = await patch(a.id, { status: 'DECLINED' }).expect(200);
      expect(res.body.adminNote).toBe('keep me');
    });

    it('null or blank adminNote clears the note', async () => {
      const a = await kit.createApplication({ adminNote: 'x' });
      let res = await patch(a.id, { adminNote: null }).expect(200);
      expect(res.body.adminNote).toBeNull();
      await patch(a.id, { adminNote: 'again' }).expect(200);
      res = await patch(a.id, { adminNote: '   ' }).expect(200);
      expect(res.body.adminNote).toBeNull();
      expect((await row(a.id))?.adminNote).toBeNull();
    });

    it('accepts a 1000 character note and rejects 1001', async () => {
      const a = await kit.createApplication();
      await patch(a.id, { adminNote: 'a'.repeat(1000) }).expect(200);
      await patch(a.id, { adminNote: 'a'.repeat(1001) }).expect(400);
    });

    it('a no-op patch and a reset to NEW still set handledBy and handledAt', async () => {
      const a = await kit.createApplication();
      const first = await patch(a.id, { status: 'NEW' }).expect(200);
      expect(first.body.handledBy.id).toBe(admin.id);
      await patch(a.id, { status: 'ACCEPTED' }).expect(200);
      const reset = await patch(a.id, { status: 'NEW' }).expect(200);
      expect(reset.body.status).toBe('NEW');
      expect(reset.body.handledAt).not.toBeNull();
    });

    it('400 for an invalid status, row unchanged', async () => {
      const a = await kit.createApplication();
      for (const status of ['BOGUS', 'DONE', 'contacted', 1, null, '']) {
        await patch(a.id, { status }).expect(400);
      }
      const stored = await row(a.id);
      expect(stored?.status).toBe(VolunteerApplicationStatus.NEW);
      expect(stored?.handledBy).toBeNull();
    });

    it('400 for a non-string adminNote', async () => {
      const a = await kit.createApplication();
      for (const adminNote of [1, true, {}, ['a']]) {
        await patch(a.id, { adminNote }).expect(400);
      }
    });

    it('400 for an empty body or one with only unknown fields, row unchanged', async () => {
      const a = await kit.createApplication();
      await patch(a.id, {}).expect(400);
      await patch(a.id, { foo: 'bar', fullName: 'Hacked' }).expect(400);
      const stored = await row(a.id);
      expect(stored?.handledBy).toBeNull();
      expect(stored?.handledAt).toBeNull();
      expect(stored?.fullName).toBe('Applicant');
    });

    it('404 for an unknown id and 400 for a malformed one', async () => {
      await patch(UNKNOWN_ID, { status: 'ACCEPTED' }).expect(404);
      await patch('not-a-uuid', { status: 'ACCEPTED' }).expect(400);
    });

    it('two concurrent patches both succeed', async () => {
      const a = await kit.createApplication();
      const [x, y] = await Promise.all([
        patch(a.id, { status: 'CONTACTED' }),
        patch(a.id, { status: 'ACCEPTED' }),
      ]);
      expect([x.status, y.status]).toEqual([200, 200]);
    });
  });

  describe('DELETE', () => {
    it('hard deletes: 204, row gone, no longer listed', async () => {
      const keep = await kit.createApplication();
      const gone = await kit.createApplication();
      const res = await del(gone.id).expect(204);
      expect(res.body).toEqual({});
      expect(await row(gone.id)).toBeNull();
      const list = await get().expect(200);
      expect(list.body.map((r: { id: string }) => r.id)).toEqual([keep.id]);
    });

    it('removes the bidang join rows but not the teams or other applications', async () => {
      const t1 = await kit.createTeam();
      const t2 = await kit.createTeam();
      const gone = await kit.createApplication({}, [t1.id, t2.id]);
      const keep = await kit.createApplication({}, [t1.id]);
      expect(await joinRows()).toBe(3);
      await del(gone.id).expect(204);
      expect(await joinRows()).toBe(1);
      expect(await dataSource.getRepository(Team).count()).toBe(2);
      const list = await get().expect(200);
      expect(list.body[0].id).toBe(keep.id);
      expect(list.body[0].bidang).toHaveLength(1);
    });

    it('404 on a second delete and for an unknown id, 400 for a malformed id', async () => {
      const a = await kit.createApplication();
      await del(a.id).expect(204);
      await del(a.id).expect(404);
      await del(UNKNOWN_ID).expect(404);
      await del('not-a-uuid').expect(400);
    });

    it('two concurrent deletes: one 204, one 404', async () => {
      const a = await kit.createApplication();
      const [x, y] = await Promise.all([del(a.id), del(a.id)]);
      expect([x.status, y.status].sort((p, q) => p - q)).toEqual([204, 404]);
    });
  });

  describe('deleting the user who handled it', () => {
    it('keeps the application with handledBy null', async () => {
      const handler = await kit.createUser({ role: UserRole.PEMBINA, name: 'Handler' });
      const team = await kit.createTeam('Usher');
      const a = await kit.createApplication({}, [team.id]);
      await patch(a.id, { status: 'ACCEPTED', adminNote: 'welcome' }, await kit.headerFor(handler)).expect(200);
      expect((await row(a.id))?.handledBy).toBe(handler.id);

      await request(kit.http()).delete(`/users/${handler.id}`).set(adminH).expect(204);

      expect((await row(a.id))?.handledBy).toBeNull();
      const list = await get().expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        id: a.id,
        status: 'ACCEPTED',
        adminNote: 'welcome',
        handledBy: null,
        bidang: [{ id: team.id, name: 'Usher' }],
      });
      expect(list.body[0].handledAt).not.toBeNull();
    });
  });

  describe('public routes never expose adminNote', () => {
    it('keeps adminNote out of the public responses', async () => {
      await kit.createApplication({ adminNote: 'secret internal note' });
      const bidang = await request(kit.http()).get('/public/bidang').expect(200);
      expect(JSON.stringify(bidang.body)).not.toContain('secret');
      await request(kit.http()).get('/public/volunteer-applications').expect(404);
      await request(kit.http()).get('/admin/volunteer-applications').expect(401);
    });
  });
});
