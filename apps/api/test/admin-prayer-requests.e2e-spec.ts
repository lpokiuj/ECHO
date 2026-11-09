import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PrayerRequest,
  PrayerRequestStatus,
} from '../src/prayer-requests/entities/prayer-request.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import {
  type AuthHeader,
  createKit,
  UNKNOWN_ID,
} from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

describe('Admin prayer requests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kit: ReturnType<typeof createKit>;
  let admin: User;
  let adminH: AuthHeader;

  const get = (query = '', h = adminH) =>
    request(kit.http()).get(`/admin/prayer-requests${query}`).set(h);
  const patch = (id: string, body: object, h = adminH) =>
    request(kit.http()).patch(`/admin/prayer-requests/${id}`).set(h).send(body);
  const del = (id: string, h = adminH) =>
    request(kit.http()).delete(`/admin/prayer-requests/${id}`).set(h);
  const row = (id: string) =>
    dataSource.getRepository(PrayerRequest).findOneBy({ id });

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
    it('lists newest first with the camelCase shape', async () => {
      const old = await kit.createPrayer({
        content: 'old',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      const recent = await kit.createPrayer({
        content: 'recent',
        name: 'Budi',
        contact: '0812',
        wantsFollowUp: true,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      });
      const res = await get().expect(200);
      expect(res.body.map((r: { id: string }) => r.id)).toEqual([recent.id, old.id]);
      expect(res.body[0]).toEqual({
        id: recent.id,
        name: 'Budi',
        contact: '0812',
        wantsFollowUp: true,
        content: 'recent',
        consentAt: expect.any(String),
        status: 'NEW',
        adminNote: null,
        handledBy: null,
        handledAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
      });
    });

    it('returns [] when empty', async () => {
      const res = await get().expect(200);
      expect(res.body).toEqual([]);
    });

    it('filters by status', async () => {
      const a = await kit.createPrayer({ status: PrayerRequestStatus.NEW });
      const b = await kit.createPrayer({ status: PrayerRequestStatus.IN_PROGRESS });
      const c = await kit.createPrayer({ status: PrayerRequestStatus.DONE });
      const ids = async (status: string) =>
        (await get(`?status=${status}`).expect(200)).body.map(
          (r: { id: string }) => r.id,
        );
      expect(await ids('NEW')).toEqual([a.id]);
      expect(await ids('IN_PROGRESS')).toEqual([b.id]);
      expect(await ids('DONE')).toEqual([c.id]);
    });

    it('400 for an invalid, empty or repeated status', async () => {
      await get('?status=BOGUS').expect(400);
      await get('?status=').expect(400);
      await get('?status=new').expect(400);
      await get('?status=NEW&status=DONE').expect(400);
      await get('?status=CONTACTED').expect(400);
    });

    it('works for PEMBINA too', async () => {
      await kit.createPrayer();
      const h = await kit.headerFor(await kit.createUser({ role: UserRole.PEMBINA }));
      const res = await get('', h).expect(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PATCH', () => {
    it('sets status, handledBy and handledAt and returns the updated item', async () => {
      const pr = await kit.createPrayer();
      const before = Date.now();
      const res = await patch(pr.id, { status: 'IN_PROGRESS' }).expect(200);
      expect(res.body).toMatchObject({
        id: pr.id,
        status: 'IN_PROGRESS',
        adminNote: null,
        handledBy: { id: admin.id, name: 'Admin Anna' },
        content: 'Please pray',
      });
      expect(Object.keys(res.body.handledBy).sort()).toEqual(['id', 'name']);
      expect(new Date(res.body.handledAt).getTime()).toBeGreaterThanOrEqual(before - 5000);
      const stored = await row(pr.id);
      expect(stored?.status).toBe(PrayerRequestStatus.IN_PROGRESS);
      expect(stored?.handledBy).toBe(admin.id);
      expect(stored?.handledAt).toBeInstanceOf(Date);
    });

    it('PEMBINA can patch and becomes handledBy', async () => {
      const pembina = await kit.createUser({ role: UserRole.PEMBINA, name: 'Pak Petrus' });
      const h = await kit.headerFor(pembina);
      const pr = await kit.createPrayer();
      const res = await patch(pr.id, { status: 'DONE' }, h).expect(200);
      expect(res.body.handledBy).toEqual({ id: pembina.id, name: 'Pak Petrus' });
    });

    it('adminNote only: stores the trimmed note, sets handled fields, keeps status', async () => {
      const pr = await kit.createPrayer({ status: PrayerRequestStatus.IN_PROGRESS });
      const res = await patch(pr.id, { adminNote: '  called them  ' }).expect(200);
      expect(res.body.adminNote).toBe('called them');
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.handledBy.id).toBe(admin.id);
      expect(res.body.handledAt).not.toBeNull();
    });

    it('status and note together', async () => {
      const pr = await kit.createPrayer();
      const res = await patch(pr.id, { status: 'DONE', adminNote: 'prayed' }).expect(200);
      expect(res.body).toMatchObject({ status: 'DONE', adminNote: 'prayed' });
    });

    it('status only keeps an existing note', async () => {
      const pr = await kit.createPrayer({ adminNote: 'keep me' });
      const res = await patch(pr.id, { status: 'DONE' }).expect(200);
      expect(res.body.adminNote).toBe('keep me');
    });

    it('null or blank adminNote clears the note', async () => {
      const pr = await kit.createPrayer({ adminNote: 'x' });
      let res = await patch(pr.id, { adminNote: null }).expect(200);
      expect(res.body.adminNote).toBeNull();
      await patch(pr.id, { adminNote: 'again' }).expect(200);
      res = await patch(pr.id, { adminNote: '   ' }).expect(200);
      expect(res.body.adminNote).toBeNull();
      await patch(pr.id, { adminNote: 'again' }).expect(200);
      res = await patch(pr.id, { adminNote: '' }).expect(200);
      expect(res.body.adminNote).toBeNull();
      expect((await row(pr.id))?.adminNote).toBeNull();
    });

    it('accepts a 1000 character note and rejects 1001', async () => {
      const pr = await kit.createPrayer();
      await patch(pr.id, { adminNote: 'a'.repeat(1000) }).expect(200);
      await patch(pr.id, { adminNote: 'a'.repeat(1001) }).expect(400);
      expect((await row(pr.id))?.adminNote).toHaveLength(1000);
    });

    it('a no-op patch and a reset to NEW still set handledBy and handledAt', async () => {
      const pr = await kit.createPrayer();
      const first = await patch(pr.id, { status: 'NEW' }).expect(200);
      expect(first.body.handledBy.id).toBe(admin.id);
      expect(first.body.handledAt).not.toBeNull();
      await patch(pr.id, { status: 'DONE' }).expect(200);
      const reset = await patch(pr.id, { status: 'NEW' }).expect(200);
      expect(reset.body.status).toBe('NEW');
      expect(reset.body.handledBy.id).toBe(admin.id);
    });

    it('400 for an invalid status, row unchanged', async () => {
      const pr = await kit.createPrayer();
      for (const status of ['BOGUS', 'CONTACTED', 'new', 1, null, '']) {
        await patch(pr.id, { status }).expect(400);
      }
      const stored = await row(pr.id);
      expect(stored?.status).toBe(PrayerRequestStatus.NEW);
      expect(stored?.handledBy).toBeNull();
    });

    it('400 for a non-string adminNote', async () => {
      const pr = await kit.createPrayer();
      for (const adminNote of [1, true, {}, ['a']]) {
        await patch(pr.id, { adminNote }).expect(400);
      }
    });

    it('400 for an empty body or one with only unknown fields, row unchanged', async () => {
      const pr = await kit.createPrayer();
      await patch(pr.id, {}).expect(400);
      await patch(pr.id, { foo: 'bar', handledBy: admin.id, content: 'x' }).expect(400);
      const stored = await row(pr.id);
      expect(stored?.handledBy).toBeNull();
      expect(stored?.handledAt).toBeNull();
      expect(stored?.content).toBe('Please pray');
    });

    it('ignores unknown fields next to valid ones', async () => {
      const pr = await kit.createPrayer();
      await patch(pr.id, { status: 'DONE', content: 'hacked', handledBy: UNKNOWN_ID }).expect(200);
      const stored = await row(pr.id);
      expect(stored?.content).toBe('Please pray');
      expect(stored?.handledBy).toBe(admin.id);
    });

    it('404 for an unknown id and 400 for a malformed one', async () => {
      await patch(UNKNOWN_ID, { status: 'DONE' }).expect(404);
      await patch('not-a-uuid', { status: 'DONE' }).expect(400);
    });

    it('two concurrent patches both succeed', async () => {
      const pr = await kit.createPrayer();
      const [a, b] = await Promise.all([
        patch(pr.id, { status: 'IN_PROGRESS' }),
        patch(pr.id, { status: 'DONE' }),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(['IN_PROGRESS', 'DONE']).toContain((await row(pr.id))?.status);
    });
  });

  describe('DELETE', () => {
    it('hard deletes: 204, row gone, no longer listed', async () => {
      const keep = await kit.createPrayer();
      const gone = await kit.createPrayer();
      const res = await del(gone.id).expect(204);
      expect(res.body).toEqual({});
      expect(await row(gone.id)).toBeNull();
      const list = await get().expect(200);
      expect(list.body.map((r: { id: string }) => r.id)).toEqual([keep.id]);
    });

    it('404 on a second delete and for an unknown id, 400 for a malformed id', async () => {
      const pr = await kit.createPrayer();
      await del(pr.id).expect(204);
      await del(pr.id).expect(404);
      await del(UNKNOWN_ID).expect(404);
      await del('not-a-uuid').expect(400);
    });

    it('two concurrent deletes: one 204, one 404', async () => {
      const pr = await kit.createPrayer();
      const [a, b] = await Promise.all([del(pr.id), del(pr.id)]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([204, 404]);
    });
  });

  describe('deleting the user who handled it', () => {
    it('keeps the request with handledBy null', async () => {
      const handler = await kit.createUser({ role: UserRole.PEMBINA, name: 'Handler' });
      const pr = await kit.createPrayer();
      await patch(pr.id, { status: 'DONE', adminNote: 'done' }, await kit.headerFor(handler)).expect(200);
      expect((await row(pr.id))?.handledBy).toBe(handler.id);

      await request(kit.http()).delete(`/users/${handler.id}`).set(adminH).expect(204);

      const stored = await row(pr.id);
      expect(stored?.handledBy).toBeNull();
      const list = await get().expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        id: pr.id,
        status: 'DONE',
        adminNote: 'done',
        handledBy: null,
      });
      expect(list.body[0].handledAt).not.toBeNull();
    });
  });

  describe('public routes never expose adminNote', () => {
    it('keeps adminNote and status out of every public response', async () => {
      await kit.createPrayer({ adminNote: 'secret internal note', status: PrayerRequestStatus.DONE });
      const bidang = await request(kit.http()).get('/public/bidang').expect(200);
      expect(JSON.stringify(bidang.body)).not.toContain('secret');
      const post = await request(kit.http())
        .post('/public/prayer-requests')
        .send({ content: 'hello', consent: true, adminNote: 'x' })
        .expect(201);
      expect(post.body).toEqual({ ok: true });
      await request(kit.http()).get('/public/prayer-requests').expect(404);
      await request(kit.http()).get('/admin/prayer-requests').expect(401);
    });
  });
});
