import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceAssignment } from '../assignments/entities/service-assignment.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Service, ServiceAssignment])],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
