import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PrayerRequestStatus } from '../src/prayer-requests/entities/prayer-request.entity.js';
import { UserRole } from '../src/users/entities/user.entity.js';
import { VolunteerApplicationStatus } from '../src/volunteer-applications/entities/volunteer-application.entity.js';
import { type AuthHeader, createKit } from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

describe('GET /admin/submissions/counts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kit: ReturnType<typeof createKit>;
  let h: AuthHeader;

  const counts = async () =>
    (await request(kit.http()).get('/admin/submissions/counts').set(h).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    kit = createKit(app, dataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    h = await kit.headerFor(await kit.createUser({ role: UserRole.ADMIN }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 0 and 0 (numbers, never null) when empty', async () => {
    expect(await counts()).toEqual({ prayerRequestsNew: 0, volunteerApplicationsNew: 0 });
  });

  it('counts only NEW rows of each type', async () => {
    await kit.createPrayer();
    await kit.createPrayer();
    await kit.createPrayer({ status: PrayerRequestStatus.IN_PROGRESS });
    await kit.createPrayer({ status: PrayerRequestStatus.DONE });
    await kit.createApplication();
    await kit.createApplication({ status: VolunteerApplicationStatus.CONTACTED });
    await kit.createApplication({ status: VolunteerApplicationStatus.ACCEPTED });
    await kit.createApplication({ status: VolunteerApplicationStatus.DECLINED });
    expect(await counts()).toEqual({ prayerRequestsNew: 2, volunteerApplicationsNew: 1 });
  });

  it('goes up after a public submission is created', async () => {
    await request(kit.http())
      .post('/public/prayer-requests')
      .send({ content: 'pray', consent: true })
      .expect(201);
    expect(await counts()).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 0 });
    await request(kit.http())
      .post('/public/volunteer-applications')
      .send({ fullName: 'A', whatsapp: '1', consent: true })
      .expect(201);
    expect(await counts()).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 1 });
  });

  it('changes after status changes, including a reset to NEW', async () => {
    const pr = await kit.createPrayer();
    const ap = await kit.createApplication();
    const patchPr = (status: string) =>
      request(kit.http()).patch(`/admin/prayer-requests/${pr.id}`).set(h).send({ status }).expect(200);
    const patchAp = (status: string) =>
      request(kit.http()).patch(`/admin/volunteer-applications/${ap.id}`).set(h).send({ status }).expect(200);

    await patchPr('IN_PROGRESS');
    expect(await counts()).toEqual({ prayerRequestsNew: 0, volunteerApplicationsNew: 1 });
    await patchAp('CONTACTED');
    expect(await counts()).toEqual({ prayerRequestsNew: 0, volunteerApplicationsNew: 0 });
    await patchPr('NEW');
    await patchAp('NEW');
    expect(await counts()).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 1 });
    await request(kit.http()).patch(`/admin/prayer-requests/${pr.id}`).set(h).send({ adminNote: 'n' }).expect(200);
    expect(await counts()).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 1 });
  });

  it('drops after deleting a NEW row and ignores deleting a handled one', async () => {
    const newPr = await kit.createPrayer();
    const donePr = await kit.createPrayer({ status: PrayerRequestStatus.DONE });
    const newAp = await kit.createApplication();
    const doneAp = await kit.createApplication({ status: VolunteerApplicationStatus.ACCEPTED });
    expect(await counts()).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 1 });
    await request(kit.http()).delete(`/admin/prayer-requests/${donePr.id}`).set(h).expect(204);
    await request(kit.http()).delete(`/admin/volunteer-applications/${doneAp.id}`).set(h).expect(204);
    expect(await counts()).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 1 });
    await request(kit.http()).delete(`/admin/prayer-requests/${newPr.id}`).set(h).expect(204);
    expect(await counts()).toEqual({ prayerRequestsNew: 0, volunteerApplicationsNew: 1 });
    await request(kit.http()).delete(`/admin/volunteer-applications/${newAp.id}`).set(h).expect(204);
    expect(await counts()).toEqual({ prayerRequestsNew: 0, volunteerApplicationsNew: 0 });
  });

  it('works for PEMBINA', async () => {
    await kit.createPrayer();
    const p = await kit.headerFor(await kit.createUser({ role: UserRole.PEMBINA }));
    const res = await request(kit.http()).get('/admin/submissions/counts').set(p).expect(200);
    expect(res.body).toEqual({ prayerRequestsNew: 1, volunteerApplicationsNew: 0 });
  });
});
