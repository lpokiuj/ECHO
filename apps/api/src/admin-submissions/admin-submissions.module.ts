import { Module } from '@nestjs/common';
import { AdminSubmissionsController } from './admin-submissions.controller.js';
import { AdminSubmissionsService } from './admin-submissions.service.js';

@Module({
  controllers: [AdminSubmissionsController],
  providers: [AdminSubmissionsService],
})
export class AdminSubmissionsModule {}
