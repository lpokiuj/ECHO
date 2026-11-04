import { ExecutionContext, Injectable } from '@nestjs/common';
import { TeamLeaderGuard } from '../assignments/team-leader.guard.js';
import type { AuthenticatedRequest } from '../auth/decorators/current-user.js';
import { UserRole } from '../users/entities/user.entity.js';

/** Read access to a team's attendance recap: leader of the team, ADMIN, or PEMBINA. */
@Injectable()
export class TeamRecapGuard extends TeamLeaderGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user.role === UserRole.PEMBINA) return true;
    return super.canActivate(context);
  }
}
