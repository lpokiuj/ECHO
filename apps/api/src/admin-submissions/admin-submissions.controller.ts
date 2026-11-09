import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.js';
import { UserRole } from '../users/entities/user.entity.js';
import { AdminSubmissionsService } from './admin-submissions.service.js';

@Roles(UserRole.ADMIN, UserRole.PEMBINA)
@Controller('admin/submissions')
export class AdminSubmissionsController {
  constructor(private readonly submissions: AdminSubmissionsService) {}

  @Get('counts')
  counts() {
    return this.submissions.counts();
  }
}
