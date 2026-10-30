import { UserRole } from '../users/entities/user.entity.js';

// Dev data for `npm run seed`. EDIT THIS FILE to put in your own people.
// The seed only inserts: it never updates or deletes, so editing a person who
// was already seeded has no effect (reset the dev DB to start over).
// The admin account is not listed here; it comes from ADMIN_EMAIL / ADMIN_PASSWORD.

export interface SeedUser {
  name: string;
  email: string; // unique; the seed finds people by email
  role?: UserRole; // default MEMBER
  isActive?: boolean; // default true
  teams: { team: string; isLeader?: boolean }[]; // team names from SEED_TEAMS
}

export interface SeedAssignment {
  serviceIndex: number; // 0 = the next Sunday, 1 = the Sunday after
  userEmail: string;
  team: string; // the team that assigned them
}

export interface SeedData {
  teams: string[];
  users: SeedUser[];
  assignments: SeedAssignment[];
}

export const SEED_TEAMS = [
  'Worship',
  'Music',
  'Sound',
  'Multimedia',
  'Usher',
  'Stage Manager',
];

// EXAMPLES: made-up people covering the domain rules. Replace with your own.
// To try conflicts by hand: put one person in two teams (shared.volunteer),
// and make a team leader a plain member of another team (worship.leader).
export const SEED_USERS: SeedUser[] = [
  {
    name: 'Petrus',
    email: 'petrus@echo.local',
    role: UserRole.PEMBINA,
    teams: [],
  },
  {
    name: 'Jimmy',
    email: 'jimmy@echo.local',
    role: UserRole.PEMBINA,
    teams: [],
  },

  // Worship team: leader + ordinary member of another team
  {
    name: 'Livana',
    email: 'livana@echo.local',
    teams: [
      { team: 'Worship', isLeader: true }
    ],
  },
  {
    name: 'Giana',
    email: 'giana@echo.local',
    teams: [
      { team: 'Worship' }
    ],
  },
  {
    name: 'Lukas',
    email: 'lukas@echo.local',
    teams: [
      { team: 'Worship' }
    ],
  },

  // Music team: leader + ordinary member of another team
  {
    name: 'Daniel',
    email: 'daniel@echo.local',
    teams: [{ team: 'Music', isLeader: true }],
  },
  {
    name: 'Osteen',
    email: 'osteen@echo.local',
    teams: [{ team: 'Music' }],
  },
  {
    name: 'Geofend',
    email: 'geofend@echo.local',
    teams: [{ team: 'Music' }],
  },

  // Sound team: leader + ordinary member of another team
  {
    name: 'Ruben',
    email: 'ruben@echo.local',
    teams: [{ team: 'Sound', isLeader: true }],
  },
  {
    name: 'Sam',
    email: 'sam@echo.local',
    teams: [{ team: 'Sound' }],
  },

  // Usher team: leader + ordinary member of another team
  {
    name: 'Nadia',
    email: 'nadia@echo.local',
    teams: [{ team: 'Usher', isLeader: true }],
  },
  {
    name: 'Agner',
    email: 'agner@echo.local',
    teams: [
      { team: 'Usher', isLeader: true },
      { team: 'Sound' }, // leader of one team, ordinary member of another
    ],
  },
  {
    name: 'Alin',
    email: 'alin@echo.local',
    teams: [{ team: 'Usher' }],
  },


  {
    name: 'Dhena',
    email: 'dhena@echo.local',
    isActive: false,
    teams: [{ team: 'Worship' }],
  },

  // Stage team: leader + ordinary member of another team
  {
    name: 'MS',
    email: 'ms@echo.local',
    teams: [{ team: 'Stage Manager', isLeader: true }],
  },
  {
    name: 'Enat',
    email: 'enat@echo.local',
    teams: [{ team: 'Stage Manager' }],
  },
   {
    name: 'Enji',
    email: 'enji@echo.local',
    teams: [{ team: 'Worship' }, { team: 'Stage Manager' }], // in two teams: conflict demo
  },
];

// EXAMPLES: Enji is already taken for the next Sunday by Worship, so Stage Manager
// trying to assign her that day is a conflict.
export const SEED_ASSIGNMENTS: SeedAssignment[] = [
  { serviceIndex: 0, userEmail: 'enji@echo.local', team: 'Worship' },
  { serviceIndex: 1, userEmail: 'alin@echo.local', team: 'Usher' },
];

export const SEED_DATA: SeedData = {
  teams: SEED_TEAMS,
  users: SEED_USERS,
  assignments: SEED_ASSIGNMENTS,
};
