import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.js';
import { UserRole } from '../users/entities/user.entity.js';
import { SetMemberDto } from './dto/set-member.dto.js';
import { TeamNameDto } from './dto/team-name.dto.js';
import { TeamsService } from './teams.service.js';

@Roles(UserRole.ADMIN)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  create(@Body() dto: TeamNameDto) {
    return this.teams.create(dto.name);
  }

  @Get()
  findAll() {
    return this.teams.findAll();
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TeamNameDto,
  ) {
    return this.teams.rename(id, dto.name);
  }

  @Put(':id/members/:userId')
  setMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetMemberDto = {},
  ) {
    return this.teams.setMember(id, userId, dto.isLeader ?? false);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teams.removeMember(id, userId);
  }
}
