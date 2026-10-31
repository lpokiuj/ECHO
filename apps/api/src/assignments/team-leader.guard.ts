import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../auth/decorators/current-user.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { UserRole } from '../users/entities/user.entity.js';

// ADMIN may act as any team. Everyone else must be the leader of the team in
// the path, read from the DB on every request. An unknown team has no leader
// row, so non-admins get 403 and nothing leaks about which teams exist.
@Injectable()
export class TeamLeaderGuard implements CanActivate {
  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMembers: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params: { teamId?: string } }>();
    const { user } = request;
    if (user.role === UserRole.ADMIN) return true;

    // A malformed id cannot match a team; skip the query (Postgres would error)
    const teamId = request.params.teamId;
    if (!teamId || !isUUID(teamId)) throw new ForbiddenException();

    const isLeader = await this.teamMembers.existsBy({
      teamId,
      userId: user.id,
      isLeader: true,
    });
    if (!isLeader) throw new ForbiddenException();
    return true;
  }
}
