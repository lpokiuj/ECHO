import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Event } from '../src/events/entities/event.entity.js';
import { createKit } from './utils/admin-submissions-kit.js';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

describe('GET /public/events (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kit: ReturnType<typeof createKit>;
  const http = () => app.getHttpServer();

  const seed = (title: string, startsAt: Date, createdBy: string | null = null) =>
    dataSource.getRepository(Event).save({
      title,
      startsAt,
      location: 'Hall',
      description: 'Desc',
      createdBy,
    });
  const hours = (n: number) => new Date(Date.now() + n * 3600 * 1000);

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

  it('returns [] when there are no events, without a token', async () => {
    const res = await request(http()).get('/public/events').expect(200);
    expect(res.body).toEqual([]);
  });

  it('hides past events and keeps upcoming ones', async () => {
    await seed('Past', hours(-48));
    await seed('Just past', new Date(Date.now() - 1000));
    const future = await seed('Future', hours(48));
    const res = await request(http()).get('/public/events').expect(200);
    expect((res.body as { id: string }[]).map((e) => e.id)).toEqual([future.id]);
  });

  it('sorts by startsAt ascending', async () => {
    const c = await seed('C', hours(72));
    const a = await seed('A', hours(24));
    const b = await seed('B', hours(48));
    const res = await request(http()).get('/public/events').expect(200);
    expect((res.body as { id: string }[]).map((e) => e.id)).toEqual([a.id, b.id, c.id]);
  });

  it('exposes only id, title, startsAt, location and description', async () => {
    const creator = await kit.createUser();
    const event = await seed('Future', hours(24), creator.id);
    const res = await request(http()).get('/public/events').expect(200);
    expect(res.body).toEqual([
      {
        id: event.id,
        title: 'Future',
        startsAt: event.startsAt.toISOString(),
        location: 'Hall',
        description: 'Desc',
      },
    ]);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'description',
      'id',
      'location',
      'startsAt',
      'title',
    ]);
    expect(JSON.stringify(res.body)).not.toContain(creator.id);
  });

  it('also works with a valid token, is not throttled and has no write methods', async () => {
    await seed('Future', hours(24));
    const h = await kit.headerFor(await kit.createUser());
    await request(http()).get('/public/events').set(h).expect(200);
    for (let i = 0; i < 12; i += 1) {
      await request(http()).get('/public/events').expect(200);
    }
    await request(http()).post('/public/events').send({}).expect(404);
    await request(http()).patch('/public/events').send({}).expect(404);
    await request(http()).delete('/public/events').expect(404);
  });
});
