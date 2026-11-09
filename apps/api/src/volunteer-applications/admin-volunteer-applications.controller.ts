import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.js';
import { Roles } from '../auth/decorators/roles.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { AdminVolunteerApplicationsService } from './admin-volunteer-applications.service.js';
import { ListVolunteerApplicationsQueryDto } from './dto/list-volunteer-applications-query.dto.js';
import { UpdateVolunteerApplicationDto } from './dto/update-volunteer-application.dto.js';

@Roles(UserRole.ADMIN, UserRole.PEMBINA)
@Controller('admin/volunteer-applications')
export class AdminVolunteerApplicationsController {
  constructor(
    private readonly applications: AdminVolunteerApplicationsService,
  ) {}

  @Get()
  findAll(@Query() query: ListVolunteerApplicationsQueryDto) {
    return this.applications.findAll(query.status);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVolunteerApplicationDto,
  ) {
    return this.applications.update(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.remove(id);
  }
}
