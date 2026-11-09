import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PrayerRequest } from '../../src/prayer-requests/entities/prayer-request.entity.js';
import { TeamMember } from '../../src/teams/entities/team-member.entity.js';
import { Team } from '../../src/teams/entities/team.entity.js';
import { User, UserRole } from '../../src/users/entities/user.entity.js';
import { VolunteerApplicationBidang } from '../../src/volunteer-applications/entities/volunteer-application-bidang.entity.js';
import { VolunteerApplication } from '../../src/volunteer-applications/entities/volunteer-application.entity.js';

export const PASSWORD = 'password123';
export const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

export type AuthHeader = { Authorization: string };

// Accounts and rows for the admin submission e2e tests. Rows are inserted
// through the repositories, so the public POST rate limit never matters.
export function createKit(app: INestApplication, dataSource: DataSource) {
  const http = () => app.getHttpServer();

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

  async function headerFor(user: User): Promise<AuthHeader> {
    const res = await request(http())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return { Authorization: `Bearer ${res.body.accessToken as string}` };
  }

  const createTeam = (name = `Team ${Math.random().toString(36).slice(2)}`) =>
    dataSource.getRepository(Team).save({ name });

  // A team leader (Ketua Bidang): role MEMBER with isLeader on a membership
  async function createLeader(): Promise<User> {
    const leader = await createUser({ name: 'Leader' });
    const team = await createTeam();
    await dataSource
      .getRepository(TeamMember)
      .save({ teamId: team.id, userId: leader.id, isLeader: true });
    return leader;
  }

  const createPrayer = (overrides: Partial<PrayerRequest> = {}) =>
    dataSource.getRepository(PrayerRequest).save({
      content: 'Please pray',
      consentAt: new Date(),
      ...overrides,
    });

  async function createApplication(
    overrides: Partial<VolunteerApplication> = {},
    bidangIds: string[] = [],
  ): Promise<VolunteerApplication> {
    const application = await dataSource
      .getRepository(VolunteerApplication)
      .save({
        fullName: 'Applicant',
        whatsapp: '0812',
        consentAt: new Date(),
        ...overrides,
      });
    if (bidangIds.length > 0) {
      await dataSource
        .getRepository(VolunteerApplicationBidang)
        .insert(bidangIds.map((bidangId) => ({ applicationId: application.id, bidangId })));
    }
    return application;
  }

  return {
    http,
    createUser,
    headerFor,
    createTeam,
    createLeader,
    createPrayer,
    createApplication,
  };
}
