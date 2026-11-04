import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.js';
import { User } from '../users/entities/user.entity.js';
import { ScheduleQueryDto } from './dto/schedule-query.dto.js';
import { ScheduleService } from './schedule.service.js';

// No @Roles: every logged-in user may read the schedule
@Controller()
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('services')
  listServices(@CurrentUser() user: User, @Query() query: ScheduleQueryDto) {
    return this.schedule.listServices(user.id, query.includePast === 'true');
  }

  @Get('me/schedule')
  mine(@CurrentUser() user: User, @Query() query: ScheduleQueryDto) {
    return this.schedule.listMine(user.id, query.includePast === 'true');
  }
}
