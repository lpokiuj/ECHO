import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ServiceAssignment } from '../src/assignments/entities/service-assignment.entity.js';
import { Service } from '../src/services/entities/service.entity.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase } from './utils/test-app.js';

const PASSWORD = 'password123';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

describe('Services (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(overrides: Partial<User> = {}): Promise<User> {
    return dataSource.getRepository(User).save({
      name: 'Test User',
      email: `u${Math.random().toString(36).slice(2)}@echo.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: UserRole.MEMBER,
      mustChangePassword: false,
      isActive: true,
      ...overrides,
    });
  }

  async function tokenFor(user: User): Promise<string> {
    const res = await request(http())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function authAs(role: UserRole) {
    const user = await createUser({ role });
    return { user, headers: bearer(await tokenFor(user)) };
  }

  const createTeam = () =>
    dataSource
      .getRepository(Team)
      .save({ name: `Team ${Math.random().toString(36).slice(2)}` });

  async function insertService(
    createdBy: string,
    startOffsetMs = 2 * DAY,
    title = 'Sunday Service',
  ): Promise<Service> {
    const startsAt = new Date(Date.now() + startOffsetMs);
    return dataSource.getRepository(Service).save({
      title,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * HOUR),
      createdBy,
    });
  }

  async function assignmentFixture(service: Service, createdBy: string) {
    const team = await createTeam();
    const volunteer = await createUser();
    await dataSource
      .getRepository(TeamMember)
      .save({ teamId: team.id, userId: volunteer.id, isLeader: false });
    return dataSource.getRepository(ServiceAssignment).save({
      serviceId: service.id,
      userId: volunteer.id,
      teamId: team.id,
      assignedBy: createdBy,
    });
  }

  const validBody = () => ({
    title: 'Sunday Service',
    startsAt: iso(2 * DAY),
    endsAt: iso(2 * DAY + 2 * HOUR),
  });

  const rawRow = async (id: string) => {
    const rows: { deleted_at: Date | null }[] = await dataSource.query(
      'SELECT deleted_at FROM services WHERE id = $1',
      [id],
    );
    return rows[0];
  };

  describe('access control', () => {
    const routes = (id: string) =>
      [
        ['post', '/services'],
        ['patch', `/services/${id}`],
        ['delete', `/services/${id}`],
      ] as const;

    it('returns 401 without a token', async () => {
      for (const [method, path] of routes(UNKNOWN_ID)) {
        await request(http())[method](path).send(validBody()).expect(401);
      }
    });

    it('returns 403 for a MEMBER', async () => {
      const { headers } = await authAs(UserRole.MEMBER);
      for (const [method, path] of routes(UNKNOWN_ID)) {
        await request(http())
          [method](path)
          .set(headers)
          .send(validBody())
          .expect(403);
      }
    });

    it('returns 403 for a team leader who created nothing', async () => {
      const { user, headers } = await authAs(UserRole.MEMBER);
      const team = await createTeam();
      await dataSource
        .getRepository(TeamMember)
        .save({ teamId: team.id, userId: user.id, isLeader: true });
      for (const [method, path] of routes(UNKNOWN_ID)) {
        await request(http())
          [method](path)
          .set(headers)
          .send(validBody())
          .expect(403);
      }
    });

    it('rejects a non-UUID id with 400', async () => {
      const { headers } = await authAs(UserRole.ADMIN);
      await request(http())
        .patch('/services/not-a-uuid')
        .set(headers)
        .send({ title: 'x' })
        .expect(400);
      await request(http())
        .delete('/services/not-a-uuid')
        .set(headers)
        .expect(400);
    });

    it.each([UserRole.ADMIN, UserRole.PEMBINA])(
      '%s can create, edit and delete, including a service made by someone else',
      async (role) => {
        const { user, headers } = await authAs(role);
        const created = await request(http())
          .post('/services')
          .set(headers)
          .send(validBody())
          .expect(201);
        expect(created.body.createdBy).toBe(user.id);

        const otherRole =
          role === UserRole.ADMIN ? UserRole.PEMBINA : UserRole.ADMIN;
        const other = await createUser({ role: otherRole });
        const foreign = await insertService(other.id);

        await request(http())
          .patch(`/services/${created.body.id}`)
          .set(headers)
          .send({ title: 'Edited' })
          .expect(200);
        await request(http())
          .patch(`/services/${foreign.id}`)
          .set(headers)
          .send({ title: 'Edited by other role' })
          .expect(200);
        await request(http())
          .delete(`/services/${created.body.id}`)
          .set(headers)
          .expect(204);
        await request(http())
          .delete(`/services/${foreign.id}`)
          .set(headers)
          .expect(204);
      },
    );
  });

  describe('POST /services', () => {
    it('returns 201 with the documented shape and trims the title', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const res = await request(http())
        .post('/services')
        .set(headers)
        .send({ ...validBody(), title: '  Sunday Service  ' })
        .expect(201);
      expect(Object.keys(res.body).sort()).toEqual(
        ['createdAt', 'createdBy', 'endsAt', 'id', 'startsAt', 'title'].sort(),
      );
      expect(res.body.title).toBe('Sunday Service');
      expect(res.body.createdBy).toBe(user.id);
    });

    it('stores an offset input as the same instant and returns it in UTC', async () => {
      const { headers } = await authAs(UserRole.ADMIN);
      // Far enough ahead to stay in the future
      const res = await request(http())
        .post('/services')
        .set(headers)
        .send({
          title: 'Timezone',
          startsAt: '2099-11-01T09:00:00+07:00',
          endsAt: '2099-11-01T11:00:00+07:00',
        })
        .expect(201);
      expect(res.body.startsAt).toBe('2099-11-01T02:00:00.000Z');
      expect(res.body.endsAt).toBe('2099-11-01T04:00:00.000Z');
      const row = await dataSource
        .getRepository(Service)
        .findOneByOrFail({ id: res.body.id });
      expect(row.startsAt.toISOString()).toBe('2099-11-01T02:00:00.000Z');
    });

    it('rejects a time without a timezone', async () => {
      const { headers } = await authAs(UserRole.ADMIN);
      await request(http())
        .post('/services')
        .set(headers)
        .send({
          title: 'x',
          startsAt: '2099-11-01T09:00:00',
          endsAt: '2099-11-01T11:00:00Z',
        })
        .expect(400);
      await request(http())
        .post('/services')
        .set(headers)
        .send({
          title: 'x',
          startsAt: '2099-11-01T09:00:00Z',
          endsAt: '2099-11-01T11:00:00',
        })
        .expect(400);
    });

    it('rejects endsAt equal to or before startsAt', async () => {
      const { headers } = await authAs(UserRole.ADMIN);
      const start = iso(2 * DAY);
      await request(http())
        .post('/services')
        .set(headers)
        .send({ title: 'x', startsAt: start, endsAt: start })
        .expect(400);
      await request(http())
        .post('/services')
        .set(headers)
        .send({ title: 'x', startsAt: start, endsAt: iso(DAY) })
        .expect(400);
    });

    it('rejects an empty, blank, missing or 151-character title', async () => {
      const { headers } = await authAs(UserRole.ADMIN);
      for (const title of ['', '   ', undefined, 'a'.repeat(151)]) {
        await request(http())
          .post('/services')
          .set(headers)
          .send({ ...validBody(), title })
          .expect(400);
      }
      await request(http())
        .post('/services')
        .set(headers)
        .send({ ...validBody(), title: 'a'.repeat(150) })
        .expect(201);
    });

    it('rejects a startsAt in the past', async () => {
      const { headers } = await authAs(UserRole.ADMIN);
      await request(http())
        .post('/services')
        .set(headers)
        .send({ title: 'x', startsAt: iso(-2 * HOUR), endsAt: iso(HOUR) })
        .expect(400);
      expect(await dataSource.getRepository(Service).count()).toBe(0);
    });
  });

  describe('PATCH /services/:id', () => {
    it('updates provided fields and never changes createdBy or createdAt', async () => {
      const { user, headers } = await authAs(UserRole.PEMBINA);
      const creator = await createUser({ role: UserRole.ADMIN });
      const svc = await insertService(creator.id);
      const newStart = iso(3 * DAY);
      const newEnd = iso(3 * DAY + 3 * HOUR);
      const res = await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({
          title: '  New title ',
          startsAt: newStart,
          endsAt: newEnd,
          createdBy: user.id,
          createdAt: '2000-01-01T00:00:00Z',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        id: svc.id,
        title: 'New title',
        startsAt: newStart,
        endsAt: newEnd,
        createdBy: creator.id,
      });
      expect(res.body.createdAt).toBe(svc.createdAt.toISOString());
      expect(Object.keys(res.body)).not.toContain('deletedAt');
    });

    it('rejects an empty body', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({})
        .expect(400);
    });

    it('rejects a merged range that is invalid', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      // endsAt at the existing startsAt
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ endsAt: svc.startsAt.toISOString() })
        .expect(400);
      // startsAt moved after the existing endsAt
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ startsAt: iso(10 * DAY) })
        .expect(400);
      const after = await dataSource
        .getRepository(Service)
        .findOneByOrFail({ id: svc.id });
      expect(after.startsAt.toISOString()).toBe(svc.startsAt.toISOString());
      expect(after.endsAt.toISOString()).toBe(svc.endsAt.toISOString());
    });

    it('rejects validation failures (title length, timezone)', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      for (const body of [
        { title: '' },
        { title: 'a'.repeat(151) },
        { startsAt: '2099-11-01T09:00:00' },
      ]) {
        await request(http())
          .patch(`/services/${svc.id}`)
          .set(headers)
          .send(body)
          .expect(400);
      }
    });

    it('rejects moving startsAt into the past', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ startsAt: iso(-HOUR) })
        .expect(400);
    });

    it('rejects re-sending startsAt on a service that already started', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id, -HOUR);
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ startsAt: svc.startsAt.toISOString() })
        .expect(400);
    });

    it('allows editing only the title or only endsAt of a started service', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id, -HOUR);
      const titleRes = await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ title: 'Renamed' })
        .expect(200);
      expect(titleRes.body.title).toBe('Renamed');
      const newEnd = iso(3 * HOUR);
      const endRes = await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ endsAt: newEnd })
        .expect(200);
      expect(endRes.body.endsAt).toBe(newEnd);
    });

    it('keeps assignments when times change (rule 14)', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      const assignment = await assignmentFixture(svc, user.id);
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ startsAt: iso(5 * DAY), endsAt: iso(5 * DAY + HOUR) })
        .expect(200);
      const rows = await dataSource
        .getRepository(ServiceAssignment)
        .findBy({ serviceId: svc.id });
      expect(rows.map((r) => r.id)).toEqual([assignment.id]);
    });

    it('returns 404 for an unknown or deleted service', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      await request(http())
        .patch(`/services/${UNKNOWN_ID}`)
        .set(headers)
        .send({ title: 'x' })
        .expect(404);
      const svc = await insertService(user.id);
      await request(http())
        .delete(`/services/${svc.id}`)
        .set(headers)
        .expect(204);
      await request(http())
        .patch(`/services/${svc.id}`)
        .set(headers)
        .send({ title: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /services/:id', () => {
    it('soft deletes: sets deleted_at, keeps the row and its assignments', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      await assignmentFixture(svc, user.id);

      await request(http())
        .delete(`/services/${svc.id}`)
        .set(headers)
        .expect(204);

      const row = await rawRow(svc.id);
      expect(row).toBeDefined();
      expect(row.deleted_at).not.toBeNull();
      expect(
        await dataSource
          .getRepository(ServiceAssignment)
          .countBy({ serviceId: svc.id }),
      ).toBe(1);
    });

    it('returns 404 on the second delete and for an unknown id', async () => {
      const { user, headers } = await authAs(UserRole.ADMIN);
      const svc = await insertService(user.id);
      await request(http())
        .delete(`/services/${svc.id}`)
        .set(headers)
        .expect(204);
      await request(http())
        .delete(`/services/${svc.id}`)
        .set(headers)
        .expect(404);
      await request(http())
        .delete(`/services/${UNKNOWN_ID}`)
        .set(headers)
        .expect(404);
    });
  });
});
