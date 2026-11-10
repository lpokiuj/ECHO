import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Event } from '../src/events/entities/event.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import {
  type AuthHeader,
  createKit,
  UNKNOWN_ID,
} from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

const valid = {
  title: 'Youth Night',
  startsAt: '2031-05-01T10:00:00.000Z',
  location: 'Main hall',
  description: 'An evening together',
};

describe('Admin events (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kit: ReturnType<typeof createKit>;
  let admin: User;
  let adminH: AuthHeader;

  const http = () => app.getHttpServer();
  const repo = () => dataSource.getRepository(Event);
  const seedEvent = (overrides: Partial<Event> = {}) =>
    repo().save({
      title: 'Seed',
      startsAt: new Date('2031-01-01T00:00:00Z'),
      location: 'Hall',
      description: 'Desc',
      ...overrides,
    });

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    kit = createKit(app, dataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    admin = await kit.createUser({ role: UserRole.ADMIN });
    adminH = await kit.headerFor(admin);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /admin/events', () => {
    it('creates an event (201) and stores the row', async () => {
      const res = await request(http())
        .post('/admin/events')
        .set(adminH)
        .send(valid)
        .expect(201);
      expect(res.body).toMatchObject({
        title: valid.title,
        startsAt: valid.startsAt,
        location: valid.location,
        description: valid.description,
        createdBy: admin.id,
      });
      expect(res.body.id).toBeTruthy();
      const row = await repo().findOneByOrFail({ id: res.body.id as string });
      expect(row.title).toBe(valid.title);
      expect(row.startsAt.toISOString()).toBe(valid.startsAt);
      expect(row.createdBy).toBe(admin.id);
    });

    it('trims text and drops unknown fields', async () => {
      const res = await request(http())
        .post('/admin/events')
        .set(adminH)
        .send({ ...valid, title: '  Padded  ', createdBy: UNKNOWN_ID, id: UNKNOWN_ID })
        .expect(201);
      expect(res.body.title).toBe('Padded');
      expect(res.body.createdBy).toBe(admin.id);
      expect(res.body.id).not.toBe(UNKNOWN_ID);
    });

    it('allows a start time in the past', async () => {
      await request(http())
        .post('/admin/events')
        .set(adminH)
        .send({ ...valid, startsAt: '2020-01-01T00:00:00Z' })
        .expect(201);
    });

    it('accepts the maximum lengths', async () => {
      await request(http())
        .post('/admin/events')
        .set(adminH)
        .send({
          ...valid,
          title: 'a'.repeat(120),
          location: 'b'.repeat(200),
          description: 'c'.repeat(2000),
        })
        .expect(201);
    });

    for (const field of ['title', 'startsAt', 'location', 'description']) {
      it(`400 when ${field} is missing`, async () => {
        const body: Record<string, string> = { ...valid };
        delete body[field];
        await request(http()).post('/admin/events').set(adminH).send(body).expect(400);
        expect(await repo().count()).toBe(0);
      });
    }

    const tooLong: [string, string][] = [
      ['title', 'a'.repeat(121)],
      ['location', 'b'.repeat(201)],
      ['description', 'c'.repeat(2001)],
    ];
    for (const [field, value] of tooLong) {
      it(`400 when ${field} is too long`, async () => {
        await request(http())
          .post('/admin/events')
          .set(adminH)
          .send({ ...valid, [field]: value })
          .expect(400);
        expect(await repo().count()).toBe(0);
      });
    }

    for (const field of ['title', 'location', 'description']) {
      it(`400 when ${field} is whitespace only`, async () => {
        await request(http())
          .post('/admin/events')
          .set(adminH)
          .send({ ...valid, [field]: '   ' })
          .expect(400);
      });
    }

    for (const startsAt of ['not a date', '2031-02-30T10:00:00Z', '2031-05-01T10:00:00', 123, '']) {
      it(`400 for invalid date ${JSON.stringify(startsAt)}`, async () => {
        await request(http())
          .post('/admin/events')
          .set(adminH)
          .send({ ...valid, startsAt })
          .expect(400);
      });
    }
  });

  describe('GET /admin/events', () => {
    it('returns [] when there are no events', async () => {
      const res = await request(http()).get('/admin/events').set(adminH).expect(200);
      expect(res.body).toEqual([]);
    });

    it('lists all events including past ones, newest start first', async () => {
      const past = await seedEvent({ title: 'Past', startsAt: new Date('2020-01-01T00:00:00Z') });
      const soon = await seedEvent({ title: 'Soon', startsAt: new Date('2031-01-01T00:00:00Z') });
      const later = await seedEvent({ title: 'Later', startsAt: new Date('2032-01-01T00:00:00Z') });
      const res = await request(http()).get('/admin/events').set(adminH).expect(200);
      expect((res.body as { id: string }[]).map((e) => e.id)).toEqual([
        later.id,
        soon.id,
        past.id,
      ]);
      expect(Object.keys(res.body[0]).sort()).toEqual(
        ['createdAt', 'createdBy', 'description', 'id', 'location', 'startsAt', 'title', 'updatedAt'],
      );
    });
  });

  describe('PATCH /admin/events/:id', () => {
    it('updates one field and updatedAt, keeps the rest', async () => {
      const event = await seedEvent();
      await new Promise((r) => setTimeout(r, 20));
      const res = await request(http())
        .patch(`/admin/events/${event.id}`)
        .set(adminH)
        .send({ title: 'Renamed' })
        .expect(200);
      expect(res.body.title).toBe('Renamed');
      expect(res.body.location).toBe('Hall');
      expect(res.body.createdAt).toBe(event.createdAt.toISOString());
      expect(new Date(res.body.updatedAt as string).getTime()).toBeGreaterThan(
        event.updatedAt.getTime(),
      );
      const row = await repo().findOneByOrFail({ id: event.id });
      expect(row.title).toBe('Renamed');
    });

    it('updates every field', async () => {
      const event = await seedEvent();
      const res = await request(http())
        .patch(`/admin/events/${event.id}`)
        .set(adminH)
        .send({
          title: 'T2',
          startsAt: '2033-03-03T03:00:00+07:00',
          location: 'L2',
          description: 'D2',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        title: 'T2',
        startsAt: '2033-03-02T20:00:00.000Z',
        location: 'L2',
        description: 'D2',
      });
    });

    it('400 for an empty body', async () => {
      const event = await seedEvent();
      await request(http()).patch(`/admin/events/${event.id}`).set(adminH).send({}).expect(400);
    });

    it('400 for an empty body even on an unknown id', async () => {
      await request(http()).patch(`/admin/events/${UNKNOWN_ID}`).set(adminH).send({}).expect(400);
    });

    it('400 for invalid values and leaves the row unchanged', async () => {
      const event = await seedEvent();
      for (const body of [
        { title: '' },
        { title: 'a'.repeat(121) },
        { location: 'b'.repeat(201) },
        { description: 'c'.repeat(2001) },
        { startsAt: 'nope' },
        { startsAt: '2031-05-01T10:00:00' },
        { description: '   ' },
      ]) {
        await request(http())
          .patch(`/admin/events/${event.id}`)
          .set(adminH)
          .send(body)
          .expect(400);
      }
      const row = await repo().findOneByOrFail({ id: event.id });
      expect(row.title).toBe('Seed');
    });

    it('404 for an unknown id', async () => {
      await request(http())
        .patch(`/admin/events/${UNKNOWN_ID}`)
        .set(adminH)
        .send({ title: 'x' })
        .expect(404);
    });

    it('400 for an id that is not a uuid', async () => {
      await request(http())
        .patch('/admin/events/not-a-uuid')
        .set(adminH)
        .send({ title: 'x' })
        .expect(400);
    });
  });

  describe('DELETE /admin/events/:id', () => {
    it('hard deletes (204) and the row is gone', async () => {
      const event = await seedEvent();
      await request(http()).delete(`/admin/events/${event.id}`).set(adminH).expect(204);
      expect(await repo().existsBy({ id: event.id })).toBe(false);
      expect(await repo().count()).toBe(0);
      await request(http()).delete(`/admin/events/${event.id}`).set(adminH).expect(404);
    });

    it('404 for an unknown id', async () => {
      await request(http()).delete(`/admin/events/${UNKNOWN_ID}`).set(adminH).expect(404);
    });

    it('400 for an id that is not a uuid', async () => {
      await request(http()).delete('/admin/events/not-a-uuid').set(adminH).expect(400);
    });

    it('deletes only the requested event', async () => {
      const a = await seedEvent({ title: 'A' });
      const b = await seedEvent({ title: 'B' });
      await request(http()).delete(`/admin/events/${a.id}`).set(adminH).expect(204);
      expect(await repo().existsBy({ id: b.id })).toBe(true);
    });
  });

  describe('deleting the creating user', () => {
    it('keeps the event with created_by NULL', async () => {
      const pembina = await kit.createUser({ role: UserRole.PEMBINA });
      const pembinaH = await kit.headerFor(pembina);
      const created = await request(http())
        .post('/admin/events')
        .set(pembinaH)
        .send(valid)
        .expect(201);
      expect(created.body.createdBy).toBe(pembina.id);
      await request(http()).delete(`/users/${pembina.id}`).set(adminH).expect(204);
      const row = await repo().findOneByOrFail({ id: created.body.id as string });
      expect(row.createdBy).toBeNull();
      const list = await request(http()).get('/admin/events').set(adminH).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].createdBy).toBeNull();
    });
  });
});
