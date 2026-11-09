import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserRole } from '../src/users/entities/user.entity.js';
import {
  type AuthHeader,
  createKit,
  UNKNOWN_ID,
} from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

type Call = (id: string, h?: AuthHeader) => request.Test;

describe('Admin submission routes: authorization (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kit: ReturnType<typeof createKit>;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    kit = createKit(app, dataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const withAuth = (req: request.Test, h?: AuthHeader) =>
    h ? req.set(h) : req;

  // Each route, with the status it returns for a caller that passes the guards
  // and a real row (id is a real or unknown id; success needs a fresh row).
  const routes: {
    name: string;
    okStatus: number;
    prepare: () => Promise<string>;
    call: Call;
  }[] = [
    {
      name: 'GET /admin/prayer-requests',
      okStatus: 200,
      prepare: async () => (await kit.createPrayer()).id,
      call: (_id, h) => withAuth(request(kit.http()).get('/admin/prayer-requests'), h),
    },
    {
      name: 'PATCH /admin/prayer-requests/:id',
      okStatus: 200,
      prepare: async () => (await kit.createPrayer()).id,
      call: (id, h) =>
        withAuth(
          request(kit.http()).patch(`/admin/prayer-requests/${id}`).send({ status: 'DONE' }),
          h,
        ),
    },
    {
      name: 'DELETE /admin/prayer-requests/:id',
      okStatus: 204,
      prepare: async () => (await kit.createPrayer()).id,
      call: (id, h) =>
        withAuth(request(kit.http()).delete(`/admin/prayer-requests/${id}`), h),
    },
    {
      name: 'GET /admin/volunteer-applications',
      okStatus: 200,
      prepare: async () => (await kit.createApplication()).id,
      call: (_id, h) =>
        withAuth(request(kit.http()).get('/admin/volunteer-applications'), h),
    },
    {
      name: 'PATCH /admin/volunteer-applications/:id',
      okStatus: 200,
      prepare: async () => (await kit.createApplication()).id,
      call: (id, h) =>
        withAuth(
          request(kit.http())
            .patch(`/admin/volunteer-applications/${id}`)
            .send({ status: 'CONTACTED' }),
          h,
        ),
    },
    {
      name: 'DELETE /admin/volunteer-applications/:id',
      okStatus: 204,
      prepare: async () => (await kit.createApplication()).id,
      call: (id, h) =>
        withAuth(request(kit.http()).delete(`/admin/volunteer-applications/${id}`), h),
    },
    {
      name: 'GET /admin/submissions/counts',
      okStatus: 200,
      prepare: async () => UNKNOWN_ID,
      call: (_id, h) => withAuth(request(kit.http()).get('/admin/submissions/counts'), h),
    },
  ];

  for (const route of routes) {
    describe(route.name, () => {
      it('401 without a token', async () => {
        const id = await route.prepare();
        await route.call(id).expect(401);
      });

      it('403 for a MEMBER', async () => {
        const id = await route.prepare();
        const h = await kit.headerFor(await kit.createUser());
        await route.call(id, h).expect(403);
      });

      it('403 for a team leader (Ketua Bidang)', async () => {
        const id = await route.prepare();
        const h = await kit.headerFor(await kit.createLeader());
        await route.call(id, h).expect(403);
      });

      it('succeeds for PEMBINA', async () => {
        const id = await route.prepare();
        const h = await kit.headerFor(await kit.createUser({ role: UserRole.PEMBINA }));
        await route.call(id, h).expect(route.okStatus);
      });

      it('succeeds for ADMIN', async () => {
        const id = await route.prepare();
        const h = await kit.headerFor(await kit.createUser({ role: UserRole.ADMIN }));
        await route.call(id, h).expect(route.okStatus);
      });
    });
  }

  it('does not change data for a forbidden caller', async () => {
    const prayer = await kit.createPrayer();
    const application = await kit.createApplication();
    const h = await kit.headerFor(await kit.createLeader());
    await request(kit.http())
      .patch(`/admin/prayer-requests/${prayer.id}`)
      .set(h)
      .send({ status: 'DONE' })
      .expect(403);
    await request(kit.http())
      .delete(`/admin/volunteer-applications/${application.id}`)
      .set(h)
      .expect(403);
    const admin = await kit.headerFor(await kit.createUser({ role: UserRole.ADMIN }));
    const list = await request(kit.http())
      .get('/admin/prayer-requests')
      .set(admin)
      .expect(200);
    expect(list.body[0].status).toBe('NEW');
    const apps = await request(kit.http())
      .get('/admin/volunteer-applications')
      .set(admin)
      .expect(200);
    expect(apps.body).toHaveLength(1);
  });
});
