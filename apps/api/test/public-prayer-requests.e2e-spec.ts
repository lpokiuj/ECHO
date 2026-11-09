import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PrayerRequest,
  PrayerRequestStatus,
} from '../src/prayer-requests/entities/prayer-request.entity.js';
import { cleanDatabase } from './utils/test-app.js';
import {
  createAppWithResettableThrottle,
  type ResettableThrottlerStorage,
} from './utils/resettable-throttler-storage.js';

const URL = '/public/prayer-requests';

describe('POST /public/prayer-requests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storage: ResettableThrottlerStorage;
  const http = () => app.getHttpServer();
  const post = (body: object) => request(http()).post(URL).send(body);
  const valid = (extra: object = {}) => ({
    content: 'Please pray for my family',
    consent: true,
    ...extra,
  });
  const rows = () => dataSource.getRepository(PrayerRequest).find();

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

  it('stores a minimal request and answers 201 { ok: true } without a token', async () => {
    const before = Date.now();
    const res = await post(valid()).expect(201);
    expect(res.body).toEqual({ ok: true });
    const [row] = await rows();
    expect(row).toMatchObject({
      name: null,
      contact: null,
      wantsFollowUp: false,
      content: 'Please pray for my family',
      status: PrayerRequestStatus.NEW,
      adminNote: null,
      handledBy: null,
      handledAt: null,
    });
    expect(row.consentAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.consentAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('stores a full request with trimmed values', async () => {
    await post(
      valid({
        name: '  Anna  ',
        contact: '  +62 812 0000  ',
        wantsFollowUp: true,
        content: '  pray  ',
      }),
    ).expect(201);
    const [row] = await rows();
    expect(row).toMatchObject({
      name: 'Anna',
      contact: '+62 812 0000',
      wantsFollowUp: true,
      content: 'pray',
    });
  });

  it('treats blank optional strings as not sent', async () => {
    await post(valid({ name: '   ', contact: '' })).expect(201);
    const [row] = await rows();
    expect(row.name).toBeNull();
    expect(row.contact).toBeNull();
  });

  it('ignores client-supplied server fields', async () => {
    await post(
      valid({
        id: '00000000-0000-4000-8000-000000000000',
        status: 'DONE',
        adminNote: 'x',
        handledBy: '00000000-0000-4000-8000-000000000000',
        consentAt: '2000-01-01T00:00:00Z',
      }),
    ).expect(201);
    const [row] = await rows();
    expect(row.id).not.toBe('00000000-0000-4000-8000-000000000000');
    expect(row.status).toBe(PrayerRequestStatus.NEW);
    expect(row.adminNote).toBeNull();
    expect(row.handledBy).toBeNull();
    expect(row.consentAt.getFullYear()).toBeGreaterThan(2000);
  });

  it('rejects missing or non-true consent with 400 and stores nothing', async () => {
    for (const consent of [undefined, false, 'true', 1, null]) {
      await post({ content: 'x', consent }).expect(400);
    }
    expect(await rows()).toHaveLength(0);
  });

  describe('follow-up contact', () => {
    it('requires a contact when follow-up is requested', async () => {
      for (const contact of [undefined, '', '   ', null]) {
        await post(valid({ wantsFollowUp: true, contact })).expect(400);
      }
      expect(await rows()).toHaveLength(0);
      await post(valid({ wantsFollowUp: true, contact: 'a@b.co' })).expect(201);
    });

    it('does not require a contact without follow-up, and rejects a non-boolean flag', async () => {
      await post(valid({ wantsFollowUp: false })).expect(201);
      await post(valid()).expect(201);
      await post(valid({ wantsFollowUp: 'yes' })).expect(400);
    });
  });

  describe('length limits', () => {
    it('limits content to 1-2000 characters after trimming', async () => {
      await post(valid({ content: 'a'.repeat(2001) })).expect(400);
      await post(valid({ content: '' })).expect(400);
      await post(valid({ content: '   \n ' })).expect(400);
      await post({ consent: true }).expect(400);
      await post(valid({ content: 123 })).expect(400);
      expect(await rows()).toHaveLength(0);
      storage.reset(); // the six requests above used up the 5-per-window budget
      await post(valid({ content: 'a'.repeat(2000) })).expect(201);
      expect(await rows()).toHaveLength(1);
    });

    it('limits name and contact to 100 characters', async () => {
      await post(valid({ name: 'a'.repeat(101) })).expect(400);
      await post(valid({ contact: 'a'.repeat(101) })).expect(400);
      await post(
        valid({ name: 'a'.repeat(100), contact: 'a'.repeat(100) }),
      ).expect(201);
    });
  });

  describe('honeypot', () => {
    it('answers 201 { ok: true } and stores nothing when website is filled', async () => {
      const res = await post(valid({ website: 'http://spam.example' })).expect(
        201,
      );
      expect(res.body).toEqual({ ok: true });
      expect(await rows()).toHaveLength(0);
    });

    it('treats a blank website as empty', async () => {
      await post(valid({ website: '   ' })).expect(201);
      await post(valid({ website: '' })).expect(201);
      expect(await rows()).toHaveLength(2);
    });

    it('still validates first: an invalid body with the honeypot filled is 400', async () => {
      await post({ website: 'x', content: 'x' }).expect(400);
    });
  });

  describe('rate limit', () => {
    it('answers 429 on the 6th request within the window', async () => {
      for (let i = 0; i < 5; i++) await post(valid()).expect(201);
      const res = await post(valid()).expect(429);
      expect(res.headers['retry-after']).toBeDefined();
      expect(await rows()).toHaveLength(5);
    });

    it('counts honeypot and invalid requests too', async () => {
      for (let i = 0; i < 3; i++) await post(valid({ website: 'x' })).expect(201);
      for (let i = 0; i < 2; i++) await post({}).expect(400);
      await post(valid()).expect(429);
    });

    it('is per endpoint and does not touch other routes', async () => {
      for (let i = 0; i < 5; i++) await post(valid()).expect(201);
      await post(valid()).expect(429);
      await request(http())
        .post('/public/volunteer-applications')
        .send({ fullName: 'A', whatsapp: '1', consent: true })
        .expect(201);
      for (let i = 0; i < 7; i++) {
        await request(http()).get('/public/bidang').expect(200);
      }
      await request(http()).get('/health').expect(200);
      await request(http())
        .post('/auth/login')
        .send({ email: 'nobody@echo.test', password: 'wrong-password' })
        .expect(401);
    });

    it('starts over after the counters are reset', async () => {
      for (let i = 0; i < 6; i++) await post(valid());
      await post(valid()).expect(429);
      storage.reset();
      await post(valid()).expect(201);
    });
  });

  describe('other routes', () => {
    it('has no public read route', async () => {
      await request(http()).get(URL).expect(404);
    });

    it('keeps protected routes protected', async () => {
      for (const path of ['/me', '/teams', '/services', '/users']) {
        await request(http()).get(path).expect(401);
      }
    });

    it('ignores a garbage Authorization header on a public route', async () => {
      await request(http())
        .post(URL)
        .set('Authorization', 'Bearer not-a-jwt')
        .send(valid())
        .expect(201);
    });
  });
});
