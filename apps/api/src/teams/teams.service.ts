import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { Team } from './entities/team.entity.js';

const UNIQUE_VIOLATION = '23505';

export interface RemovedAssignment {
  serviceId: string;
  title: string;
  startsAt: Date;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TeamMember)
    private readonly teamMembers: Repository<TeamMember>,
    private readonly dataSource: DataSource,
  ) {}

  async create(name: string): Promise<Team> {
    try {
      const { id } = await this.teams.save({ name: name.trim() });
      return await this.teams.findOneByOrFail({ id });
    } catch (err) {
      throw this.mapError(err);
    }
  }

  findAll(): Promise<Team[]> {
    return this.teams.find({ order: { name: 'ASC' } });
  }

  async rename(id: string, name: string): Promise<Team> {
    try {
      const result = await this.teams.update(id, { name: name.trim() });
      if (!result.affected) throw new NotFoundException();
    } catch (err) {
      throw this.mapError(err);
    }
    return this.teams.findOneByOrFail({ id });
  }

  async setMember(teamId: string, userId: string, isLeader: boolean) {
    if (!(await this.teams.existsBy({ id: teamId }))) {
      throw new NotFoundException('Team not found');
    }
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) {
      throw new BadRequestException('Cannot add an inactive user to a team');
    }
    if (isLeader && user.role === UserRole.PEMBINA) {
      throw new BadRequestException('A PEMBINA cannot be a team leader');
    }
    // Upsert: the primary key guarantees one row, however many times this is called
    await this.teamMembers.upsert({ teamId, userId, isLeader }, [
      'teamId',
      'userId',
    ]);
    return { teamId, userId, isLeader };
  }

  // Rule 9: one transaction removes the membership and that team's assignments
  // for the user on future services. Past assignments stay.
  removeMember(
    teamId: string,
    userId: string,
  ): Promise<{ removedAssignments: RemovedAssignment[] }> {
    return this.dataSource.transaction(async (manager) => {
      const removed = await manager.delete(TeamMember, { teamId, userId });
      if (!removed.affected) throw new NotFoundException('Member not found');

      const rows: {
        service_id: string;
        title: string;
        starts_at: Date;
        deleted_at: Date | null;
      }[] = await manager.query(
        `WITH deleted AS (
           DELETE FROM service_assignments sa
           USING services s
           WHERE sa.service_id = s.id
             AND sa.team_id = $1
             AND sa.user_id = $2
             AND s.starts_at > now()
           RETURNING s.id AS service_id, s.title, s.starts_at, s.deleted_at
         )
         SELECT * FROM deleted ORDER BY starts_at`,
        [teamId, userId],
      );
      // Soft-deleted services are gone for everyone, so they are not reported
      return {
        removedAssignments: rows
          .filter((r) => r.deleted_at === null)
          .map((r) => ({
            serviceId: r.service_id,
            title: r.title,
            startsAt: r.starts_at,
          })),
      };
    });
  }

  private mapError(err: unknown): unknown {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return new ConflictException('Team name already in use');
    }
    return err;
  }
}
