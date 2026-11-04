import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamLeaderGuard } from '../assignments/team-leader.guard.js';
import { TeamRecapGuard } from './team-recap.guard.js';
import { Service } from '../services/entities/service.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Service, Team, TeamMember])],
  controllers: [AttendanceController],
  providers: [AttendanceService, TeamLeaderGuard, TeamRecapGuard],
})
export class AttendanceModule {}
