import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase } from './utils/test-app.js';

const PASSWORD = 'password123';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let defaultPassword: string;
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    defaultPassword = app.get(ConfigService).getOrThrow('DEFAULT_USER_PASSWORD');
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

  function loginWith(email: string, password: string) {
    return request(http()).post('/auth/login').send({ email, password });
  }

  async function tokenFor(user: User): Promise<string> {
    const res = await loginWith(user.email, PASSWORD).expect(200);
    return res.body.accessToken as string;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function adminToken() {
    const admin = await createUser({ role: UserRole.ADMIN, name: 'Admin' });
    return { admin, token: await tokenFor(admin) };
  }

  const loadUser = (id: string) =>
    dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOneOrFail();

  describe('access control', () => {
    it.each([
      ['get', '/users'],
      ['post', '/users'],
      ['patch', `/users/${UNKNOWN_ID}`],
      ['post', `/users/${UNKNOWN_ID}/reset-password`],
    ] as const)('%s %s: 401 without token', async (method, url) => {
      await request(http())[method](url).expect(401);
    });

    it.each([UserRole.PEMBINA, UserRole.MEMBER])(
      '%s gets 403 on every users route',
      async (role) => {
        const user = await createUser({ role });
        const h = bearer(await tokenFor(user));
        await request(http()).get('/users').set(h).expect(403);
        await request(http())
          .post('/users')
          .set(h)
          .send({ name: 'X', email: 'x@echo.test' })
          .expect(403);
        await request(http())
          .patch(`/users/${user.id}`)
          .set(h)
          .send({ name: 'X' })
          .expect(403);
        await request(http())
          .post(`/users/${user.id}/reset-password`)
          .set(h)
          .expect(403);
      },
    );
  });

  describe('POST /users', () => {
    it('creates a MEMBER with the default password and must_change_password', async () => {
      const { token } = await adminToken();
      const res = await request(http())
        .post('/users')
        .set(bearer(token))
        .send({ name: 'New Person', email: 'new@echo.test' })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'New Person',
        email: 'new@echo.test',
        role: UserRole.MEMBER,
        mustChangePassword: true,
        isActive: true,
      });
      expect(res.body.passwordHash).toBeUndefined();

      const login = await loginWith('new@echo.test', defaultPassword);
      expect(login.status).toBe(200);
    });

    it('accepts an explicit role', async () => {
      const { token } = await adminToken();
      const res = await request(http())
        .post('/users')
        .set(bearer(token))
        .send({ name: 'P', email: 'p@echo.test', role: UserRole.PEMBINA })
        .expect(201);
      expect(res.body.role).toBe(UserRole.PEMBINA);
    });

    it('stores the email in lowercase and rejects a case variant with 409', async () => {
      const { token } = await adminToken();
      const res = await request(http())
        .post('/users')
        .set(bearer(token))
        .send({ name: 'Case', email: 'Case.Person@Echo.test' })
        .expect(201);
      expect(res.body.email).toBe('case.person@echo.test');
      await request(http())
        .post('/users')
        .set(bearer(token))
        .send({ name: 'Case 2', email: 'CASE.PERSON@echo.test' })
        .expect(409);
      await loginWith('Case.Person@ECHO.test', defaultPassword).expect(200);
    });

    it('lowercases the email on update and the database refuses uppercase', async () => {
      const { token } = await adminToken();
      const user = await createUser();
      const res = await request(http())
        .patch(`/users/${user.id}`)
        .set(bearer(token))
        .send({ email: 'New.Name@Echo.test' })
        .expect(200);
      expect(res.body.email).toBe('new.name@echo.test');
      await expect(
        dataSource.query(`UPDATE users SET email = 'UP@echo.test' WHERE id = $1`, [user.id]),
      ).rejects.toThrow(/users_email_lowercase_chk/);
    });

    it('409 on duplicate email', async () => {
      const { token } = await adminToken();
      const existing = await createUser();
      await request(http())
        .post('/users')
        .set(bearer(token))
        .send({ name: 'Dup', email: existing.email })
        .expect(409);
    });

    it.each([
      [{ name: 'X', email: 'not-an-email' }],
      [{ name: 'X', email: 'x@echo.test', role: 'SUPERUSER' }],
      [{ email: 'x@echo.test' }],
      [{ name: '', email: 'x@echo.test' }],
    ])('400 on invalid body %j', async (body) => {
      const { token } = await adminToken();
      await request(http())
        .post('/users')
        .set(bearer(token))
        .send(body)
        .expect(400);
    });
  });

  describe('GET /users', () => {
    it('lists users ordered by name without password hashes', async () => {
      const { token } = await adminToken();
      await createUser({ name: 'Zed' });
      await createUser({ name: 'Bob' });
      const res = await request(http())
        .get('/users')
        .set(bearer(token))
        .expect(200);
      expect(res.body.map((u: User) => u.name)).toEqual(['Admin', 'Bob', 'Zed']);
      for (const u of res.body) expect(u.passwordHash).toBeUndefined();
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates name and email', async () => {
      const { token } = await adminToken();
      const target = await createUser();
      const res = await request(http())
        .patch(`/users/${target.id}`)
        .set(bearer(token))
        .send({ name: 'Renamed', email: 'renamed@echo.test' })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Renamed',
        email: 'renamed@echo.test',
      });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('role change applies on the target\'s next request with the same token', async () => {
      const { token } = await adminToken();
      const target = await createUser();
      const targetToken = await tokenFor(target);
      await request(http())
        .get('/users')
        .set(bearer(targetToken))
        .expect(403);
      await request(http())
        .patch(`/users/${target.id}`)
        .set(bearer(token))
        .send({ role: UserRole.ADMIN })
        .expect(200);
      await request(http())
        .get('/users')
        .set(bearer(targetToken))
        .expect(200);
    });

    it('deactivating a user rejects their old token', async () => {
      const { token } = await adminToken();
      const target = await createUser();
      const targetToken = await tokenFor(target);
      await request(http())
        .patch(`/users/${target.id}`)
        .set(bearer(token))
        .send({ isActive: false })
        .expect(200);
      await request(http())
        .get('/me')
        .set(bearer(targetToken))
        .expect(401);
      await loginWith(target.email, PASSWORD).expect(401);
    });

    it('reactivating a user lets them log in again', async () => {
      const { token } = await adminToken();
      const target = await createUser({ isActive: false });
      await request(http())
        .patch(`/users/${target.id}`)
        .set(bearer(token))
        .send({ isActive: true })
        .expect(200);
      await loginWith(target.email, PASSWORD).expect(200);
    });

    it('an empty body is a no-op returning the user', async () => {
      const { token } = await adminToken();
      const target = await createUser({ name: 'Same' });
      const res = await request(http())
        .patch(`/users/${target.id}`)
        .set(bearer(token))
        .send({})
        .expect(200);
      expect(res.body.name).toBe('Same');
    });

    it('400 when an admin changes their own role or active status', async () => {
      const { admin, token } = await adminToken();
      await request(http())
        .patch(`/users/${admin.id}`)
        .set(bearer(token))
        .send({ role: UserRole.MEMBER })
        .expect(400);
      await request(http())
        .patch(`/users/${admin.id}`)
        .set(bearer(token))
        .send({ isActive: false })
        .expect(400);
      const reloaded = await loadUser(admin.id);
      expect(reloaded.role).toBe(UserRole.ADMIN);
      expect(reloaded.isActive).toBe(true);
    });

    it('an admin can still edit their own name', async () => {
      const { admin, token } = await adminToken();
      await request(http())
        .patch(`/users/${admin.id}`)
        .set(bearer(token))
        .send({ name: 'Me' })
        .expect(200);
    });

    it('409 on duplicate email', async () => {
      const { token } = await adminToken();
      const a = await createUser();
      const b = await createUser();
      await request(http())
        .patch(`/users/${b.id}`)
        .set(bearer(token))
        .send({ email: a.email })
        .expect(409);
    });

    it('404 for an unknown id, 400 for a non-UUID id', async () => {
      const { token } = await adminToken();
      await request(http())
        .patch(`/users/${UNKNOWN_ID}`)
        .set(bearer(token))
        .send({ name: 'X' })
        .expect(404);
      await request(http())
        .patch('/users/not-a-uuid')
        .set(bearer(token))
        .send({ name: 'X' })
        .expect(400);
    });

    describe('PEMBINA and team leadership', () => {
      async function joinTeam(user: User, isLeader: boolean) {
        const team = await dataSource
          .getRepository(Team)
          .save({ name: `Team ${Math.random().toString(36).slice(2)}` });
        await dataSource
          .getRepository(TeamMember)
          .save({ teamId: team.id, userId: user.id, isLeader });
        return team;
      }

      it('400 when a team leader is set to PEMBINA; allowed once the flag is removed', async () => {
        const { token } = await adminToken();
        const target = await createUser();
        const team = await joinTeam(target, true);
        await request(http())
          .patch(`/users/${target.id}`)
          .set(bearer(token))
          .send({ role: UserRole.PEMBINA })
          .expect(400);
        expect((await loadUser(target.id)).role).toBe(UserRole.MEMBER);

        await dataSource
          .getRepository(TeamMember)
          .update({ teamId: team.id, userId: target.id }, { isLeader: false });
        await request(http())
          .patch(`/users/${target.id}`)
          .set(bearer(token))
          .send({ role: UserRole.PEMBINA })
          .expect(200);
        expect((await loadUser(target.id)).role).toBe(UserRole.PEMBINA);
      });

      it('a plain team member can be set to PEMBINA', async () => {
        const { token } = await adminToken();
        const target = await createUser();
        await joinTeam(target, false);
        await request(http())
          .patch(`/users/${target.id}`)
          .set(bearer(token))
          .send({ role: UserRole.PEMBINA })
          .expect(200);
      });
    });

    it('400 on an invalid role', async () => {
      const { token } = await adminToken();
      const target = await createUser();
      await request(http())
        .patch(`/users/${target.id}`)
        .set(bearer(token))
        .send({ role: 'SUPERUSER' })
        .expect(400);
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('resets to the default password and requires a change', async () => {
      const { token } = await adminToken();
      const target = await createUser();
      await request(http())
        .post(`/users/${target.id}/reset-password`)
        .set(bearer(token))
        .expect(204);

      await loginWith(target.email, PASSWORD).expect(401);
      await loginWith(target.email, defaultPassword).expect(200);
      expect((await loadUser(target.id)).mustChangePassword).toBe(true);
    });

    it('404 for an unknown id, 400 for a non-UUID id', async () => {
      const { token } = await adminToken();
      await request(http())
        .post(`/users/${UNKNOWN_ID}/reset-password`)
        .set(bearer(token))
        .expect(404);
      await request(http())
        .post('/users/not-a-uuid/reset-password')
        .set(bearer(token))
        .expect(400);
    });
  });
});
