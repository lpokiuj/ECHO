import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { cleanDatabase, createTestApp } from './utils/test-app.js';

describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(app.get(DataSource));
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when the database is reachable', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('runs against the test database', () => {
    expect(app.get(DataSource).options.database).toBe('echo_test');
  });
});
