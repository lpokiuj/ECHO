import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { TeamLeaderGuard } from '../assignments/team-leader.guard.js';
import { TeamRecapGuard } from './team-recap.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.js';
import { User } from '../users/entities/user.entity.js';
import { AttendanceService } from './attendance.service.js';
import { SetAbsentTakerDto } from './dto/set-absent-taker.dto.js';

// Authorization differs per route: the leader (or ADMIN) designates the taker,
// the taker (or ADMIN) records absences; the service checks the latter.
@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @UseGuards(TeamLeaderGuard)
  @Put('services/:id/teams/:teamId/absent-taker')
  @HttpCode(204)
  designate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: SetAbsentTakerDto,
  ) {
    return this.attendance.designate(id, teamId, dto.userId);
  }

  @Put('services/:id/teams/:teamId/absences/:userId')
  @HttpCode(204)
  record(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.attendance.record(user, id, teamId, userId);
  }

  @Delete('services/:id/teams/:teamId/absences/:userId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.attendance.remove(user, id, teamId, userId);
  }

  @Get('me/absences')
  mine(@CurrentUser() user: User) {
    return this.attendance.mine(user.id);
  }

  @UseGuards(TeamRecapGuard)
  @Get('teams/:teamId/absences')
  teamCounts(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.attendance.teamCounts(teamId);
  }

  @UseGuards(TeamRecapGuard)
  @Get('teams/:teamId/absences/:userId')
  memberAbsences(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.attendance.memberAbsences(teamId, userId);
  }
}
