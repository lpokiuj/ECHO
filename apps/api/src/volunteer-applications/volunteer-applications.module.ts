import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminVolunteerApplicationsController } from './admin-volunteer-applications.controller.js';
import { AdminVolunteerApplicationsService } from './admin-volunteer-applications.service.js';
import { VolunteerApplicationBidang } from './entities/volunteer-application-bidang.entity.js';
import { VolunteerApplication } from './entities/volunteer-application.entity.js';
import { PublicVolunteerApplicationsController } from './public-volunteer-applications.controller.js';
import { VolunteerApplicationsService } from './volunteer-applications.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([VolunteerApplication, VolunteerApplicationBidang]),
  ],
  controllers: [
    PublicVolunteerApplicationsController,
    AdminVolunteerApplicationsController,
  ],
  providers: [VolunteerApplicationsService, AdminVolunteerApplicationsService],
})
export class VolunteerApplicationsModule {}
