import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../services/entities/service.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { AssignmentsController } from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';
import { ServiceAssignment } from './entities/service-assignment.entity.js';
import { TeamLeaderGuard } from './team-leader.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, Team, TeamMember, ServiceAssignment]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, TeamLeaderGuard],
})
export class AssignmentsModule {}
