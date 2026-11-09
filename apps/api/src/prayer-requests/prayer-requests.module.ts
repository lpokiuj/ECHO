import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrayerRequest } from './entities/prayer-request.entity.js';
import { AdminPrayerRequestsController } from './admin-prayer-requests.controller.js';
import { AdminPrayerRequestsService } from './admin-prayer-requests.service.js';
import { PrayerRequestsService } from './prayer-requests.service.js';
import { PublicPrayerRequestsController } from './public-prayer-requests.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([PrayerRequest])],
  controllers: [PublicPrayerRequestsController, AdminPrayerRequestsController],
  providers: [PrayerRequestsService, AdminPrayerRequestsService],
})
export class PrayerRequestsModule {}
