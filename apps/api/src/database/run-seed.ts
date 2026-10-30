import bcrypt from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { ServiceAssignment } from '../assignments/entities/service-assignment.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import type { SeedData } from './seed-data.js';

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  userPassword: string; // shared dev password for the fake users
  now?: Date; // for tests
}

const WIB_OFFSET_HOURS = 7; // Asia/Jakarta has no daylight saving

// Next `count` Sundays at 10:00-12:00 WIB, as UTC instants (timestamptz).
export function nextSundayServices(count: number, now: Date) {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_HOURS * 3_600_000);
  const daysAhead = (7 - wibNow.getUTCDay()) % 7;
  let start = Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate() + daysAhead,
    10 - WIB_OFFSET_HOURS,
  );
  if (start <= now.getTime()) start += 7 * 86_400_000; // today's service already started
  return Array.from({ length: count }, (_, i) => {
    const startsAt = new Date(start + i * 7 * 86_400_000);
    return { startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3_600_000) };
  });
}

// Insert-only: rows are found by natural key and inserted if missing. Nothing is
// ever updated or deleted, so running it twice changes nothing.
export async function runSeed(
  dataSource: DataSource,
  data: SeedData,
  options: SeedOptions,
): Promise<void> {
  await dataSource.transaction(async (m) => {
    const adminId = await seedAdmin(m, options);
    const teamIds = await seedTeams(m, data.teams);
    const userIds = await seedUsers(m, data, options.userPassword);
    await seedMemberships(m, data, teamIds, userIds);
    const serviceIds = await seedServices(
      m,
      adminId,
      options.now ?? new Date(),
    );
    await seedAssignments(m, data, { adminId, teamIds, userIds, serviceIds });
  });
}

async function hashIfMissing(
  m: EntityManager,
  emails: string[],
  password: string,
): Promise<Map<string, string>> {
  const existing = new Set(
    (await m.find(User, { select: { email: true } })).map((u) => u.email),
  );
  const hashes = new Map<string, string>();
  for (const email of emails) {
    // bcrypt is slow on purpose, so skip people who already exist
    if (!existing.has(email))
      hashes.set(email, await bcrypt.hash(password, 10));
  }
  return hashes;
}

async function userIdsByEmail(m: EntityManager) {
  const users = await m.find(User, { select: { id: true, email: true } });
  return new Map(users.map((u) => [u.email, u.id]));
}

async function seedAdmin(m: EntityManager, o: SeedOptions): Promise<string> {
  const hashes = await hashIfMissing(m, [o.adminEmail], o.adminPassword);
  if (hashes.has(o.adminEmail)) {
    await m
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        name: 'Admin',
        email: o.adminEmail,
        passwordHash: hashes.get(o.adminEmail),
        role: UserRole.ADMIN,
        mustChangePassword: true,
      })
      .orIgnore()
      .execute();
  }
  return (await userIdsByEmail(m)).get(o.adminEmail)!;
}

async function seedTeams(m: EntityManager, names: string[]) {
  await m
    .createQueryBuilder()
    .insert()
    .into(Team)
    .values(names.map((name) => ({ name })))
    .orIgnore()
    .execute();
  const teams = await m.find(Team);
  return new Map(teams.map((t) => [t.name, t.id]));
}

async function seedUsers(m: EntityManager, data: SeedData, password: string) {
  const hashes = await hashIfMissing(
    m,
    data.users.map((u) => u.email),
    password,
  );
  const rows = data.users
    .filter((u) => hashes.has(u.email))
    .map((u) => ({
      name: u.name,
      email: u.email,
      passwordHash: hashes.get(u.email),
      role: u.role ?? UserRole.MEMBER,
      isActive: u.isActive ?? true,
      mustChangePassword: false, // dev convenience: log in without the change-password step
    }));
  if (rows.length > 0) {
    await m
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(rows)
      .orIgnore()
      .execute();
  }
  return userIdsByEmail(m);
}

async function seedMemberships(
  m: EntityManager,
  data: SeedData,
  teamIds: Map<string, string>,
  userIds: Map<string, string>,
) {
  const rows = data.users.flatMap((u) =>
    u.teams.map((t) => ({
      teamId: lookup(teamIds, t.team, 'team'),
      userId: lookup(userIds, u.email, 'user'),
      isLeader: t.isLeader ?? false,
    })),
  );
  if (rows.length > 0) {
    await m
      .createQueryBuilder()
      .insert()
      .into(TeamMember)
      .values(rows)
      .orIgnore()
      .execute();
  }
}

async function seedServices(m: EntityManager, adminId: string, now: Date) {
  const ids: string[] = [];
  for (const { startsAt, endsAt } of nextSundayServices(2, now)) {
    const title = 'Sunday Service';
    // withDeleted: a service someone soft-deleted must not come back
    const found = await m.findOne(Service, {
      where: { title, startsAt },
      withDeleted: true,
    });
    if (found) {
      ids.push(found.id);
    } else {
      const created = await m.save(
        m.create(Service, { title, startsAt, endsAt, createdBy: adminId }),
      );
      ids.push(created.id);
    }
  }
  return ids;
}

async function seedAssignments(
  m: EntityManager,
  data: SeedData,
  ids: {
    adminId: string;
    teamIds: Map<string, string>;
    userIds: Map<string, string>;
    serviceIds: string[];
  },
) {
  const leaderOf = new Map<string, string>(); // team name -> a leader's user id
  for (const u of data.users) {
    for (const t of u.teams) {
      if (t.isLeader && !leaderOf.has(t.team)) {
        leaderOf.set(t.team, lookup(ids.userIds, u.email, 'user'));
      }
    }
  }
  const rows = data.assignments.map((a) => {
    const serviceId = ids.serviceIds[a.serviceIndex];
    if (!serviceId)
      throw new Error(`Seed: no service at index ${a.serviceIndex}`);
    return {
      serviceId,
      userId: lookup(ids.userIds, a.userEmail, 'user'),
      teamId: lookup(ids.teamIds, a.team, 'team'),
      assignedBy: leaderOf.get(a.team) ?? ids.adminId,
    };
  });
  if (rows.length > 0) {
    // (service_id, user_id) is unique: an existing assignment is skipped, not duplicated
    await m
      .createQueryBuilder()
      .insert()
      .into(ServiceAssignment)
      .values(rows)
      .orIgnore()
      .execute();
  }
}

function lookup(map: Map<string, string>, key: string, what: string): string {
  const id = map.get(key);
  if (!id) throw new Error(`Seed: unknown ${what} "${key}"`);
  return id;
}
