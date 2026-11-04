import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Service } from '../services/entities/service.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';

export interface MyAbsencesView {
  count: number;
  items: { serviceId: string; title: string; startsAt: Date }[];
}

export interface TeamAbsenceCountView {
  userId: string;
  name: string;
  count: number;
}

export type MemberAbsencesView = MyAbsencesView;

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    private readonly dataSource: DataSource,
  ) {}

  // Leader of the team or ADMIN (guard) picks the one absent-taker. Allowed
  // before or after the service starts.
  async designate(
    serviceId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.loadService(serviceId, teamId);
    await this.dataSource.transaction(async (manager) => {
      // Serialize designations for this (service, team): two concurrent
      // requests would otherwise deadlock on row locks. The partial unique
      // index stays the last line of defence.
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`taker:${serviceId}:${teamId}`],
      );
      // Clear the old taker only if the target is really assigned by this team
      await manager.query(
        `UPDATE service_assignments SET is_absent_taker = false
         WHERE service_id = $1 AND team_id = $2 AND is_absent_taker
           AND user_id <> $3
           AND EXISTS (
             SELECT 1 FROM service_assignments
             WHERE service_id = $1 AND team_id = $2 AND user_id = $3
           )`,
        [serviceId, teamId, userId],
      );
      const [rows] = (await manager.query(
        `UPDATE service_assignments SET is_absent_taker = true
         WHERE service_id = $1 AND team_id = $2 AND user_id = $3
         RETURNING user_id`,
        [serviceId, teamId, userId],
      )) as [{ user_id: string }[], number];
      if (rows.length === 0) this.throwNotAssigned(userId);
    });
  }

  async record(
    caller: User,
    serviceId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.assertCanRecord(caller, serviceId, teamId);
    const service = await this.loadService(serviceId, teamId);
    this.assertStarted(service);
    if (userId === caller.id) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'CANNOT_MARK_SELF',
        message: 'You cannot record your own absence',
      });
    }
    // One statement: the target must be assigned by this team
    const inserted: { user_id: string }[] = await this.dataSource.query(
      `INSERT INTO service_absences (service_id, user_id, team_id, recorded_by)
       SELECT sa.service_id, sa.user_id, sa.team_id, $4
       FROM service_assignments sa
       WHERE sa.service_id = $1 AND sa.team_id = $2 AND sa.user_id = $3
       ON CONFLICT (service_id, user_id) DO NOTHING
       RETURNING user_id`,
      [serviceId, teamId, userId, caller.id],
    );
    if (inserted.length > 0) return;
    // Nothing inserted: already recorded (idempotent) or not assigned
    const exists: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM service_absences WHERE service_id = $1 AND user_id = $2`,
      [serviceId, userId],
    );
    if (exists.length === 0) this.throwNotAssigned(userId);
  }

  async remove(
    caller: User,
    serviceId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.assertCanRecord(caller, serviceId, teamId);
    const service = await this.loadService(serviceId, teamId);
    this.assertStarted(service);
    const [, affected] = (await this.dataSource.query(
      `DELETE FROM service_absences
       WHERE service_id = $1 AND team_id = $2 AND user_id = $3`,
      [serviceId, teamId, userId],
    )) as [unknown, number];
    if (affected > 0) return;
    const assigned: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM service_assignments
       WHERE service_id = $1 AND team_id = $2 AND user_id = $3`,
      [serviceId, teamId, userId],
    );
    if (assigned.length === 0) this.throwNotAssigned(userId);
  }

  // Soft-deleted services still count: an absence really happened
  async mine(userId: string): Promise<MyAbsencesView> {
    const rows: { service_id: string; title: string; starts_at: Date }[] =
      await this.dataSource.query(
        `SELECT s.id AS service_id, s.title, s.starts_at
         FROM service_absences ab
         JOIN services s ON s.id = ab.service_id
         WHERE ab.user_id = $1
         ORDER BY s.starts_at DESC, s.id`,
        [userId],
      );
    return {
      count: rows.length,
      items: rows.map((r) => ({
        serviceId: r.service_id,
        title: r.title,
        startsAt: r.starts_at,
      })),
    };
  }

  // Active members of the team with their lifetime miss count (all teams)
  async teamCounts(teamId: string): Promise<TeamAbsenceCountView[]> {
    if (!(await this.teams.existsBy({ id: teamId }))) {
      throw new NotFoundException('Team not found');
    }
    const rows: { user_id: string; name: string; count: string }[] =
      await this.dataSource.query(
        `SELECT u.id AS user_id, u.name,
                (SELECT COUNT(*) FROM service_absences ab WHERE ab.user_id = u.id) AS count
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id AND u.is_active
         WHERE tm.team_id = $1
         ORDER BY u.name, u.id`,
        [teamId],
      );
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      count: Number(r.count),
    }));
  }

  // Services one active member of the team missed (all teams, deleted services included)
  async memberAbsences(
    teamId: string,
    userId: string,
  ): Promise<MemberAbsencesView> {
    if (!(await this.teams.existsBy({ id: teamId }))) {
      throw new NotFoundException('Team not found');
    }
    const member: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM team_members tm
       JOIN users u ON u.id = tm.user_id AND u.is_active
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, userId],
    );
    if (member.length === 0) throw new NotFoundException('Member not found');
    return this.mine(userId);
  }

  // ADMIN, or the team's designated absent-taker for this service. Checked
  // before the service is loaded so a non-taker gets 403, never a 404 hint.
  private async assertCanRecord(
    caller: User,
    serviceId: string,
    teamId: string,
  ): Promise<void> {
    if (caller.role === UserRole.ADMIN) return;
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM service_assignments
       WHERE service_id = $1 AND team_id = $2 AND user_id = $3 AND is_absent_taker`,
      [serviceId, teamId, caller.id],
    );
    if (rows.length === 0) throw new ForbiddenException();
  }

  private async loadService(
    serviceId: string,
    teamId: string,
  ): Promise<Service> {
    const service = await this.services.findOneBy({ id: serviceId });
    if (!service) throw new NotFoundException('Service not found');
    if (!(await this.teams.existsBy({ id: teamId }))) {
      throw new NotFoundException('Team not found');
    }
    return service;
  }

  private assertStarted(service: Service): void {
    if (service.startsAt.getTime() > Date.now()) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SERVICE_NOT_STARTED',
        message: 'This service has not started yet',
      });
    }
  }

  private throwNotAssigned(userId: string): never {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_USERS',
      message: 'The user is not assigned to this service by this team',
      invalidUserIds: [userId],
    });
  }
}
