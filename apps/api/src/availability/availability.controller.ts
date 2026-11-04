import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.js';
import { User } from '../users/entities/user.entity.js';
import { AvailabilityService } from './availability.service.js';

// No @Roles: any logged-in user acts on themselves
@Controller()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Put('services/:id/unavailability')
  @HttpCode(204)
  markUnavailable(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availability.markUnavailable(id, user.id);
  }

  @Delete('services/:id/unavailability')
  @HttpCode(204)
  markAvailable(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availability.markAvailable(id, user.id);
  }

  @Get('me/unavailability')
  listMine(@CurrentUser() user: User) {
    return this.availability.listMine(user.id);
  }
}
