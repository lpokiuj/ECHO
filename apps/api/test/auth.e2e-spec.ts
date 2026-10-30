import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Roles } from '../src/auth/decorators/roles.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { cleanDatabase } from './utils/test-app.js';

// Test-only routes: a plain protected route and a role-restricted one
@Controller('probe')
class ProbeController {
  @Get('plain')
  plain() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @Get('admin')
  admin() {
    return { ok: true };
  }
}

const PASSWORD = 'password123';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    jwt = app.get(JwtService);
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

  async function login(user: User): Promise<string> {
    const res = await request(http())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('POST /auth/login', () => {
    it('returns an access token whose payload is only sub, iat, exp', async () => {
      const user = await createUser();
      const token = await login(user);
      const payload = jwt.decode(token) as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
      expect(payload.sub).toBe(user.id);
      expect((payload.exp as number) - (payload.iat as number)).toBe(15 * 60);
    });

    it('gives the same 401 for wrong password, unknown email, inactive user', async () => {
      const user = await createUser();
      const inactive = await createUser({ isActive: false });
      const attempts = [
        { email: user.email, password: 'wrong-password' },
        { email: 'nobody@echo.test', password: PASSWORD },
        { email: inactive.email, password: PASSWORD },
      ];
      const bodies = [];
      for (const body of attempts) {
        const res = await request(http())
          .post('/auth/login')
          .send(body)
          .expect(401);
        bodies.push(res.body);
      }
      expect(bodies[1]).toEqual(bodies[0]);
      expect(bodies[2]).toEqual(bodies[0]);
    });
  });

  describe('access control', () => {
    it('keeps /health and /auth/login public', async () => {
      await request(http()).get('/health').expect(200);
      await request(http()).post('/auth/login').send({}).expect(400);
    });

    it('rejects missing, malformed, tampered and expired tokens with 401', async () => {
      const user = await createUser();
      const good = await login(user);
      const expired = await jwt.signAsync({ sub: user.id }, { expiresIn: -10 });
      const wrongSecret = new JwtService({ secret: 'other' }).sign({
        sub: user.id,
      });
      const cases: Record<string, string | undefined> = {
        missing: undefined,
        malformed: 'Bearer not-a-jwt',
        tampered: `Bearer ${good.slice(0, -2)}xx`,
        wrongSecret: `Bearer ${wrongSecret}`,
        expired: `Bearer ${expired}`,
        wrongScheme: `Basic ${good}`,
      };
      for (const header of Object.values(cases)) {
        const req = request(http()).get('/probe/plain');
        if (header) req.set('Authorization', header);
        await req.expect(401);
      }
      await request(http()).get('/me').expect(401);
    });

    it('rejects a token older than 15 minutes with 401', async () => {
      const user = await createUser();
      const iat = Math.floor(Date.now() / 1000) - 16 * 60;
      const stale = await jwt.signAsync({ sub: user.id, iat });
      await request(http()).get('/probe/plain').set(bearer(stale)).expect(401);
    });

    it('rejects the old token of a user deactivated after login', async () => {
      const user = await createUser();
      const token = await login(user);
      await request(http()).get('/probe/plain').set(bearer(token)).expect(200);
      await dataSource.getRepository(User).update(user.id, { isActive: false });
      await request(http()).get('/probe/plain').set(bearer(token)).expect(401);
    });

    it('applies a role change on the next request with the same token', async () => {
      const user = await createUser();
      const token = await login(user);
      await request(http()).get('/probe/admin').set(bearer(token)).expect(403);
      await dataSource
        .getRepository(User)
        .update(user.id, { role: UserRole.ADMIN });
      await request(http()).get('/probe/admin').set(bearer(token)).expect(200);
    });

    it('lets only ADMIN through a @Roles(ADMIN) route', async () => {
      for (const [role, status] of [
        [UserRole.PEMBINA, 403],
        [UserRole.MEMBER, 403],
        [UserRole.ADMIN, 200],
      ] as const) {
        const user = await createUser({ role });
        const token = await login(user);
        await request(http())
          .get('/probe/admin')
          .set(bearer(token))
          .expect(status);
      }
    });
  });

  describe('sliding session', () => {
    it('returns a fresh valid token in X-Access-Token', async () => {
      const user = await createUser();
      const token = await login(user);
      const res = await request(http())
        .get('/probe/plain')
        .set(bearer(token))
        .expect(200);
      const fresh = res.headers['x-access-token'] as string;
      expect(fresh).toBeTruthy();
      expect((jwt.decode(fresh) as { sub: string }).sub).toBe(user.id);
      await request(http()).get('/probe/plain').set(bearer(fresh)).expect(200);
    });
  });

  describe('must_change_password', () => {
    it('gives 403 PASSWORD_CHANGE_REQUIRED on every route except change-password and /me', async () => {
      const user = await createUser({ mustChangePassword: true });
      const token = await login(user);
      for (const path of ['/probe/plain', '/probe/admin']) {
        const res = await request(http())
          .get(path)
          .set(bearer(token))
          .expect(403);
        expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      }
      await request(http()).get('/me').set(bearer(token)).expect(200);
      await request(http())
        .post('/auth/change-password')
        .set(bearer(token))
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass' })
        .expect(204);
      await request(http()).get('/probe/plain').set(bearer(token)).expect(200);
    });
  });

  describe('GET /me', () => {
    it('returns the profile with memberships and no password hash', async () => {
      const user = await createUser({ role: UserRole.PEMBINA, name: 'Ann' });
      const teams = await dataSource
        .getRepository(Team)
        .save([{ name: 'Sound' }, { name: 'Music' }]);
      await dataSource.getRepository(TeamMember).save([
        { teamId: teams[0].id, userId: user.id, isLeader: true },
        { teamId: teams[1].id, userId: user.id, isLeader: false },
      ]);
      const token = await login(user);
      const res = await request(http())
        .get('/me')
        .set(bearer(token))
        .expect(200);
      expect(res.body).toEqual({
        id: user.id,
        name: 'Ann',
        email: user.email,
        role: 'PEMBINA',
        mustChangePassword: false,
        memberships: [
          { teamId: teams[1].id, teamName: 'Music', isLeader: false },
          { teamId: teams[0].id, teamName: 'Sound', isLeader: true },
        ],
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password_?hash/i);
    });
  });

  describe('POST /auth/change-password', () => {
    const change = (token: string, body: object) =>
      request(http())
        .post('/auth/change-password')
        .set(bearer(token))
        .send(body);

    it('rejects a wrong current password with 401', async () => {
      const token = await login(await createUser());
      await change(token, {
        currentPassword: 'nope-nope',
        newPassword: 'brand-new-pass',
      }).expect(401);
    });

    it('rejects a short new password with 400', async () => {
      const token = await login(await createUser());
      await change(token, {
        currentPassword: PASSWORD,
        newPassword: 'short',
      }).expect(400);
    });

    it('rejects a new password equal to the current one with 400', async () => {
      const token = await login(await createUser());
      await change(token, {
        currentPassword: PASSWORD,
        newPassword: PASSWORD,
      }).expect(400);
    });

    it('requires authentication', async () => {
      await request(http())
        .post('/auth/change-password')
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass' })
        .expect(401);
    });

    it('succeeds with 204, clears the flag, and the old password stops working', async () => {
      const user = await createUser({ mustChangePassword: true });
      const token = await login(user);
      await change(token, {
        currentPassword: PASSWORD,
        newPassword: 'brand-new-pass',
      }).expect(204);
      const row = await dataSource
        .getRepository(User)
        .findOneByOrFail({ id: user.id });
      expect(row.mustChangePassword).toBe(false);
      await request(http())
        .post('/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      await request(http())
        .post('/auth/login')
        .send({ email: user.email, password: 'brand-new-pass' })
        .expect(200);
    });
  });
});
