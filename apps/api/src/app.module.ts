import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions, envFilePath } from './database/data-source.js';
import { AdminSubmissionsModule } from './admin-submissions/admin-submissions.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { PrayerRequestsModule } from './prayer-requests/prayer-requests.module.js';
import { PublicModule } from './public/public.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { ServicesModule } from './services/services.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { UsersModule } from './users/users.module.js';
import { VolunteerApplicationsModule } from './volunteer-applications/volunteer-applications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AdminSubmissionsModule,
    AssignmentsModule,
    AuthModule,
    AvailabilityModule,
    AttendanceModule,
    EventsModule,
    HealthModule,
    PrayerRequestsModule,
    PublicModule,
    ScheduleModule,
    ServicesModule,
    TeamsModule,
    UsersModule,
    VolunteerApplicationsModule,
  ],
})
export class AppModule {}
