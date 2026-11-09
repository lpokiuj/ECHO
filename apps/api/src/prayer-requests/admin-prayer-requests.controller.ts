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
import { AdminPrayerRequestsService } from './admin-prayer-requests.service.js';
import { ListPrayerRequestsQueryDto } from './dto/list-prayer-requests-query.dto.js';
import { UpdatePrayerRequestDto } from './dto/update-prayer-request.dto.js';

@Roles(UserRole.ADMIN, UserRole.PEMBINA)
@Controller('admin/prayer-requests')
export class AdminPrayerRequestsController {
  constructor(private readonly prayerRequests: AdminPrayerRequestsService) {}

  @Get()
  findAll(@Query() query: ListPrayerRequestsQueryDto) {
    return this.prayerRequests.findAll(query.status);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrayerRequestDto,
  ) {
    return this.prayerRequests.update(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prayerRequests.remove(id);
  }
}
