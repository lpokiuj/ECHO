import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { Team } from './entities/team.entity.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMember, User])],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
