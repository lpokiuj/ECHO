import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions, envFilePath } from './database/data-source.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { ServicesModule } from './services/services.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AssignmentsModule,
    AuthModule,
    AvailabilityModule,
    AttendanceModule,
    HealthModule,
    ScheduleModule,
    ServicesModule,
    TeamsModule,
    UsersModule,
  ],
})
export class AppModule {}
