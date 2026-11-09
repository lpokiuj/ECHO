import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrayerRequest } from './entities/prayer-request.entity.js';
import { PrayerRequestsService } from './prayer-requests.service.js';
import { PublicPrayerRequestsController } from './public-prayer-requests.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([PrayerRequest])],
  controllers: [PublicPrayerRequestsController],
  providers: [PrayerRequestsService],
})
export class PrayerRequestsModule {}
