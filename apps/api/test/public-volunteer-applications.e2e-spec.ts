import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Team } from '../src/teams/entities/team.entity.js';
import { VolunteerApplicationBidang } from '../src/volunteer-applications/entities/volunteer-application-bidang.entity.js';
import {
  VolunteerApplication,
  VolunteerApplicationStatus,
} from '../src/volunteer-applications/entities/volunteer-application.entity.js';
import { cleanDatabase } from './utils/test-app.js';
import {
  createAppWithResettableThrottle,
  type ResettableThrottlerStorage,
} from './utils/resettable-throttler-storage.js';

const URL = '/public/volunteer-applications';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('POST /public/volunteer-applications (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storage: ResettableThrottlerStorage;
  const http = () => app.getHttpServer();
  const post = (body: object) => request(http()).post(URL).send(body);
  const valid = (extra: object = {}) => ({
    fullName: 'Budi Santoso',
    whatsapp: '+62 812 3456',
    consent: true,
    ...extra,
  });
  const rows = () => dataSource.getRepository(VolunteerApplication).find();
  const interests = () =>
    dataSource.getRepository(VolunteerApplicationBidang).find();
  const createTeam = (name: string) =>
    dataSource.getRepository(Team).save({ name });

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

  it('stores a minimal application and answers 201 { ok: true } without a token', async () => {
    const before = Date.now();
    const res = await post(valid()).expect(201);
    expect(res.body).toEqual({ ok: true });
    const [row] = await rows();
    expect(row).toMatchObject({
      fullName: 'Budi Santoso',
      whatsapp: '+62 812 3456',
      email: null,
      availability: null,
      message: null,
      status: VolunteerApplicationStatus.NEW,
      adminNote: null,
      handledBy: null,
      handledAt: null,
    });
    expect(row.consentAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.consentAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(await interests()).toHaveLength(0);
  });

  it('stores a full application: trimmed, lowercase email, deduped bidang', async () => {
    const worship = await createTeam('Worship');
    const music = await createTeam('Music');
    await post(
      valid({
        fullName: '  Budi  ',
        whatsapp: ' 0812 ',
        email: '  Budi@Echo.TEST ',
        availability: ' Sundays ',
        message: ' hi ',
        bidangIds: [worship.id, music.id, worship.id],
      }),
    ).expect(201);
    const [row] = await rows();
    expect(row).toMatchObject({
      fullName: 'Budi',
      whatsapp: '0812',
      email: 'budi@echo.test',
      availability: 'Sundays',
      message: 'hi',
    });
    const stored = await interests();
    expect(stored.map((i) => i.bidangId).sort()).toEqual(
      [worship.id, music.id].sort(),
    );
    expect(stored.every((i) => i.applicationId === row.id)).toBe(true);
  });

  it('accepts an empty bidangIds list and blank optional strings', async () => {
    await post(valid({ bidangIds: [], email: '  ', message: '' })).expect(201);
    const [row] = await rows();
    expect(row.email).toBeNull();
    expect(row.message).toBeNull();
    expect(await interests()).toHaveLength(0);
  });

  it('ignores client-supplied server fields', async () => {
    await post(
      valid({
        id: UNKNOWN_ID,
        status: 'ACCEPTED',
        adminNote: 'x',
        handledBy: UNKNOWN_ID,
        consentAt: '2000-01-01T00:00:00Z',
      }),
    ).expect(201);
    const [row] = await rows();
    expect(row.id).not.toBe(UNKNOWN_ID);
    expect(row.status).toBe(VolunteerApplicationStatus.NEW);
    expect(row.adminNote).toBeNull();
    expect(row.handledBy).toBeNull();
    expect(row.consentAt.getFullYear()).toBeGreaterThan(2000);
  });

  it('rejects missing or non-true consent with 400 and stores nothing', async () => {
    for (const consent of [undefined, false, 'true', 1, null]) {
      await post({ fullName: 'A', whatsapp: '1', consent }).expect(400);
    }
    expect(await rows()).toHaveLength(0);
  });

  it('requires fullName and whatsapp, and validates email', async () => {
    await post({ whatsapp: '1', consent: true }).expect(400);
    await post({ fullName: '  ', whatsapp: '1', consent: true }).expect(400);
    await post({ fullName: 'A', consent: true }).expect(400);
    await post({ fullName: 'A', whatsapp: '   ', consent: true }).expect(400);
    await post(valid({ email: 'not-an-email' })).expect(400);
    expect(await rows()).toHaveLength(0);
  });

  it('enforces the length limits (boundary passes)', async () => {
    const cases: Record<string, number> = {
      fullName: 100,
      whatsapp: 30,
      availability: 500,
      message: 1000,
    };
    for (const [field, max] of Object.entries(cases)) {
      await post(valid({ [field]: 'a'.repeat(max + 1) })).expect(400);
    }
    await post(valid({ email: `${'a'.repeat(250)}@b.co` })).expect(400);
    expect(await rows()).toHaveLength(0);
    storage.reset();
    await post(
      valid({
        fullName: 'a'.repeat(100),
        whatsapp: '1'.repeat(30),
        availability: 'a'.repeat(500),
        message: 'a'.repeat(1000),
      }),
    ).expect(201);
  });

  describe('bidangIds', () => {
    it('rejects an unknown bidang id with 400 and stores nothing', async () => {
      const worship = await createTeam('Worship');
      const res = await post(valid({ bidangIds: [UNKNOWN_ID] })).expect(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.stringContaining('bidangIds'),
      });
      expect(res.body.code).toBeUndefined();
      await post(valid({ bidangIds: [worship.id, UNKNOWN_ID] })).expect(400);
      expect(await rows()).toHaveLength(0);
      expect(await interests()).toHaveLength(0);
    });

    it('rejects malformed values and more than 20 ids', async () => {
      await post(valid({ bidangIds: ['not-a-uuid'] })).expect(400);
      await post(valid({ bidangIds: [1] })).expect(400);
      await post(valid({ bidangIds: UNKNOWN_ID })).expect(400);
      const many = Array.from({ length: 21 }, (_, i) =>
        `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      await post(valid({ bidangIds: many })).expect(400);
      expect(await rows()).toHaveLength(0);
    });
  });

  describe('honeypot', () => {
    it('answers 201 { ok: true } and stores nothing when website is filled', async () => {
      const team = await createTeam('Worship');
      const res = await post(
        valid({ website: 'http://spam.example', bidangIds: [team.id] }),
      ).expect(201);
      expect(res.body).toEqual({ ok: true });
      expect(await rows()).toHaveLength(0);
      expect(await interests()).toHaveLength(0);
    });

    it('treats a blank website as empty', async () => {
      await post(valid({ website: '  ' })).expect(201);
      expect(await rows()).toHaveLength(1);
    });
  });

  describe('rate limit', () => {
    it('answers 429 on the 6th request within the window', async () => {
      for (let i = 0; i < 5; i++) await post(valid()).expect(201);
      const res = await post(valid()).expect(429);
      expect(res.headers['retry-after']).toBeDefined();
      expect(await rows()).toHaveLength(5);
    });

    it('is per endpoint', async () => {
      for (let i = 0; i < 5; i++) await post(valid()).expect(201);
      await post(valid()).expect(429);
      await request(http())
        .post('/public/prayer-requests')
        .send({ content: 'x', consent: true })
        .expect(201);
    });
  });

  it('has no public read route', async () => {
    await request(http()).get(URL).expect(404);
  });
});
