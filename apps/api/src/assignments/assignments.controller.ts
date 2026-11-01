import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.js';
import { User } from '../users/entities/user.entity.js';
import { AssignmentsService } from './assignments.service.js';
import { AssignDto } from './dto/assign.dto.js';
import { UpdateNotesDto } from './dto/update-notes.dto.js';
import { TeamLeaderGuard } from './team-leader.guard.js';

@UseGuards(TeamLeaderGuard)
@Controller('services/:id/teams/:teamId')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get('candidates')
  candidates(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.assignments.candidates(id, teamId);
  }

  @Post('assignments')
  @HttpCode(200)
  assign(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: AssignDto,
  ) {
    return this.assignments.assign(id, teamId, dto.userIds, user.id, dto.notes);
  }

  @Patch('assignments/:userId')
  updateNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateNotesDto,
  ) {
    return this.assignments.updateNotes(id, teamId, userId, dto.notes);
  }

  @Delete('assignments/:userId')
  @HttpCode(204)
  unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.assignments.unassign(id, teamId, userId);
  }
}
