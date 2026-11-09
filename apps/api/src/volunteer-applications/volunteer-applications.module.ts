import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VolunteerApplicationBidang } from './entities/volunteer-application-bidang.entity.js';
import { VolunteerApplication } from './entities/volunteer-application.entity.js';
import { PublicVolunteerApplicationsController } from './public-volunteer-applications.controller.js';
import { VolunteerApplicationsService } from './volunteer-applications.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([VolunteerApplication, VolunteerApplicationBidang]),
  ],
  controllers: [PublicVolunteerApplicationsController],
  providers: [VolunteerApplicationsService],
})
export class VolunteerApplicationsModule {}
