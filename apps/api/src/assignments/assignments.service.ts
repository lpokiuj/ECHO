import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { mapAttendanceFkError } from '../attendance/attendance-errors.js';
import { lockAssignmentSlots } from '../availability/assignment-lock.js';
import { Service } from '../services/entities/service.entity.js';
import { Team } from '../teams/entities/team.entity.js';

export interface Candidate {
  userId: string;
  name: string;
  assigned: boolean;
  unavailable: boolean;
}

export type SkipReason =
  'ALREADY_ASSIGNED_THIS_TEAM' | 'ALREADY_ASSIGNED_OTHER_TEAM' | 'UNAVAILABLE';

export interface SkippedUser {
  userId: string;
  reason: SkipReason;
  heldByTeam?: { id: string; name: string };
}

export interface AssignmentNotesView {
  serviceId: string;
  userId: string;
  teamId: string;
  notes: string;
}

export interface AssignResult {
  assigned: string[];
  skipped: SkippedUser[];
}

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    private readonly dataSource: DataSource,
  ) {}

  async candidates(serviceId: string, teamId: string): Promise<Candidate[]> {
    await this.loadService(serviceId, teamId);
    // Active members of the team, minus anyone another team holds in this service
    const rows: {
      user_id: string;
      name: string;
      assigned: boolean;
      unavailable: boolean;
    }[] = await this.dataSource.query(
      `SELECT u.id AS user_id, u.name, (sa.team_id IS NOT NULL) AS assigned,
                (su.user_id IS NOT NULL) AS unavailable
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id AND u.is_active
         LEFT JOIN service_assignments sa
           ON sa.user_id = u.id AND sa.service_id = $1
         LEFT JOIN service_unavailability su
           ON su.user_id = u.id AND su.service_id = $1
         WHERE tm.team_id = $2
           AND (sa.team_id IS NULL OR sa.team_id = $2)
         ORDER BY u.name, u.id`,
      [serviceId, teamId],
    );
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      assigned: r.assigned,
      unavailable: r.unavailable,
    }));
  }

  async assign(
    serviceId: string,
    teamId: string,
    userIds: string[],
    assignedBy: string,
    notes?: Record<string, string>,
  ): Promise<AssignResult> {
    const service = await this.loadService(serviceId, teamId);
    this.assertNotStarted(service);
    const ids = [...new Set(userIds)];

    // Rule 7: only active members of the path team. This check is about
    // membership, never about conflicts (those are left to the database).
    const members: { user_id: string }[] = await this.dataSource.query(
      `SELECT tm.user_id
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id AND u.is_active
       WHERE tm.team_id = $1 AND tm.user_id = ANY($2::uuid[])`,
      [teamId, ids],
    );
    const valid = new Set(members.map((m) => m.user_id));
    const invalid = ids.filter((id) => !valid.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_USERS',
        message: 'Some users are not active members of this team',
        invalidUserIds: invalid,
      });
    }

    // Rules 3 and 4: the unique constraint decides who wins, in one statement.
    // The NOT EXISTS skips users who marked the service unavailable; the
    // advisory lock makes that guard race-free against a concurrent PUT
    // /services/:id/unavailability.
    const inserted: { user_id: string }[] = await this.dataSource.transaction(
      async (manager) => {
        await lockAssignmentSlots(manager, serviceId, ids);
        return manager.query(
          `INSERT INTO service_assignments (service_id, user_id, team_id, assigned_by, notes)
           SELECT $1, t.u, $2, $3, t.n FROM unnest($4::uuid[], $5::text[]) AS t(u, n)
           WHERE NOT EXISTS (
             SELECT 1 FROM service_unavailability su
             WHERE su.service_id = $1 AND su.user_id = t.u
           )
           ON CONFLICT (service_id, user_id) DO NOTHING
           RETURNING user_id`,
          [
            serviceId,
            teamId,
            assignedBy,
            ids,
            ids.map((id) => notes?.[id] ?? ''),
          ],
        );
      },
    );
    const assigned = new Set(inserted.map((r) => r.user_id));
    const skippedIds = ids.filter((id) => !assigned.has(id));

    const skipped: SkippedUser[] = [];
    if (skippedIds.length > 0) {
      // Rule 5: report who holds each skipped user
      const holders: {
        user_id: string;
        team_id: string;
        team_name: string;
      }[] = await this.dataSource.query(
        `SELECT sa.user_id, sa.team_id, t.name AS team_name
         FROM service_assignments sa
         JOIN teams t ON t.id = sa.team_id
         WHERE sa.service_id = $1 AND sa.user_id = ANY($2::uuid[])`,
        [serviceId, skippedIds],
      );
      const unavailable: { user_id: string }[] = await this.dataSource.query(
        `SELECT user_id FROM service_unavailability
         WHERE service_id = $1 AND user_id = ANY($2::uuid[])`,
        [serviceId, skippedIds],
      );
      const unavailableIds = new Set(unavailable.map((u) => u.user_id));
      const holderByUser = new Map(holders.map((h) => [h.user_id, h]));
      for (const userId of skippedIds) {
        const holder = holderByUser.get(userId);
        if (!holder) {
          // No holder: unavailable, or unassigned between insert and lookup
          if (unavailableIds.has(userId)) {
            skipped.push({ userId, reason: 'UNAVAILABLE' });
          }
          continue;
        }
        skipped.push(
          holder.team_id === teamId
            ? { userId, reason: 'ALREADY_ASSIGNED_THIS_TEAM' }
            : {
                userId,
                reason: 'ALREADY_ASSIGNED_OTHER_TEAM',
                heldByTeam: { id: holder.team_id, name: holder.team_name },
              },
        );
      }
    }
    return { assigned: ids.filter((id) => assigned.has(id)), skipped };
  }

  async unassign(
    serviceId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    const service = await this.loadService(serviceId, teamId);
    this.assertNotStarted(service);
    let affected: number;
    try {
      [, affected] = (await this.dataSource.query(
        `DELETE FROM service_assignments
         WHERE service_id = $1 AND team_id = $2 AND user_id = $3`,
        [serviceId, teamId, userId],
      )) as [unknown, number];
    } catch (err) {
      throw mapAttendanceFkError(err);
    }
    if (!affected) throw new NotFoundException('Assignment not found');
  }

  async updateNotes(
    serviceId: string,
    teamId: string,
    userId: string,
    notes: string,
  ): Promise<AssignmentNotesView> {
    const service = await this.loadService(serviceId, teamId);
    this.assertNotStarted(service);
    const rows: { notes: string }[] = (
      await this.dataSource.query(
        `UPDATE service_assignments SET notes = $4
         WHERE service_id = $1 AND team_id = $2 AND user_id = $3
         RETURNING notes`,
        [serviceId, teamId, userId, notes],
      )
    )[0];
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Assignment not found');
    }
    return { serviceId, userId, teamId, notes: rows[0].notes };
  }

  // Unknown or soft-deleted service, or unknown team (reachable by ADMIN only)
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

  private assertNotStarted(service: Service): void {
    if (service.startsAt.getTime() <= Date.now()) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SERVICE_ALREADY_STARTED',
        message: 'This service has already started',
      });
    }
  }
}
