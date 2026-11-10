import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Event } from '../src/events/entities/event.entity.js';
import { UserRole } from '../src/users/entities/user.entity.js';
import { type AuthHeader, createKit } from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

type Call = (id: string, h?: AuthHeader) => request.Test;

const validBody = {
  title: 'Youth Night',
  startsAt: '2031-05-01T10:00:00.000Z',
  location: 'Main hall',
  description: 'An evening together',
};

describe('Admin events routes: authorization (e2e)', () => {
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

  const createEvent = async () =>
    (
      await dataSource.getRepository(Event).save({
        title: 'Seed event',
        startsAt: new Date('2031-01-01T00:00:00Z'),
        location: 'Hall',
        description: 'Desc',
      })
    ).id;

  const routes: {
    name: string;
    okStatus: number;
    prepare: () => Promise<string>;
    call: Call;
  }[] = [
    {
      name: 'GET /admin/events',
      okStatus: 200,
      prepare: createEvent,
      call: (_id, h) => withAuth(request(kit.http()).get('/admin/events'), h),
    },
    {
      name: 'POST /admin/events',
      okStatus: 201,
      prepare: createEvent,
      call: (_id, h) =>
        withAuth(request(kit.http()).post('/admin/events').send(validBody), h),
    },
    {
      name: 'PATCH /admin/events/:id',
      okStatus: 200,
      prepare: createEvent,
      call: (id, h) =>
        withAuth(
          request(kit.http()).patch(`/admin/events/${id}`).send({ title: 'New' }),
          h,
        ),
    },
    {
      name: 'DELETE /admin/events/:id',
      okStatus: 204,
      prepare: createEvent,
      call: (id, h) =>
        withAuth(request(kit.http()).delete(`/admin/events/${id}`), h),
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
        const h = await kit.headerFor(
          await kit.createUser({ role: UserRole.PEMBINA }),
        );
        await route.call(id, h).expect(route.okStatus);
      });

      it('succeeds for ADMIN', async () => {
        const id = await route.prepare();
        const h = await kit.headerFor(
          await kit.createUser({ role: UserRole.ADMIN }),
        );
        await route.call(id, h).expect(route.okStatus);
      });
    });
  }

  it('does not change data for a forbidden caller', async () => {
    const id = await createEvent();
    const h = await kit.headerFor(await kit.createLeader());
    await request(kit.http()).post('/admin/events').set(h).send(validBody).expect(403);
    await request(kit.http())
      .patch(`/admin/events/${id}`)
      .set(h)
      .send({ title: 'Hacked' })
      .expect(403);
    await request(kit.http()).delete(`/admin/events/${id}`).set(h).expect(403);
    const rows = await dataSource.getRepository(Event).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Seed event');
  });
});
