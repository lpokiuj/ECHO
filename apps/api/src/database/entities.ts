import { ServiceAbsence } from '../attendance/entities/service-absence.entity.js';
import { ServiceAssignment } from '../assignments/entities/service-assignment.entity.js';
import { ServiceUnavailability } from '../availability/entities/service-unavailability.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { VolunteerApplicationBidang } from '../volunteer-applications/entities/volunteer-application-bidang.entity.js';
import { VolunteerApplication } from '../volunteer-applications/entities/volunteer-application.entity.js';

// Every entity must be listed here (the TypeORM CLI and the tests use this list).
// Classes, not a glob: a glob makes Node import the .ts files directly, and it
// cannot parse decorators.
export const ENTITIES = [
  User,
  Team,
  TeamMember,
  Service,
  ServiceAssignment,
  ServiceUnavailability,
  ServiceAbsence,
  PrayerRequest,
  VolunteerApplication,
  VolunteerApplicationBidang,
];
