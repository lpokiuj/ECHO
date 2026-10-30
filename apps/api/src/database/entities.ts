import { ServiceAssignment } from '../assignments/entities/service-assignment.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { User } from '../users/entities/user.entity.js';

// Every entity must be listed here (the TypeORM CLI and the tests use this list).
// Classes, not a glob: a glob makes Node import the .ts files directly, and it
// cannot parse decorators.
export const ENTITIES = [User, Team, TeamMember, Service, ServiceAssignment];
