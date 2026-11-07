// The one module for API data types. Hand-written from ../../docs/api/ (no OpenAPI spec).
export type UserRole = 'ADMIN' | 'PEMBINA' | 'MEMBER'

export type ErrorCode =
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'INVALID_USERS'
  | 'SERVICE_ALREADY_STARTED'
  | 'ALREADY_ASSIGNED'
  | 'SERVICE_NOT_STARTED'
  | 'CANNOT_MARK_SELF'
  | 'HAS_ATTENDANCE_RECORDS'

export interface Membership {
  teamId: string
  teamName: string
  isLeader: boolean
}

export interface MeResponse {
  id: string
  name: string
  email: string
  role: UserRole
  mustChangePassword: boolean
  memberships: Membership[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface HealthResponse {
  status: string
}

/** Raw error body as sent by the backend. Its `message` is never shown to users. */
export interface ApiErrorBody {
  statusCode?: number
  message?: string | string[]
  error?: string
  code?: string
  invalidUserIds?: string[]
}

/** One person on a service, from GET /services (schedule.md). */
export interface ScheduleAssignment {
  userId: string
  name: string
  teamId: string
  teamName: string
  /** Set by the team leader, `""` when none. Visible to every logged-in user. */
  notes: string
  /** This person records their team's absences (attendance.md). */
  isAbsentTaker: boolean
}

/** GET /services item: a service with everyone assigned across teams. */
export interface ServiceSchedule {
  id: string
  title: string
  startsAt: string
  endsAt: string
  /** The caller marked this service unavailable (availability.md). */
  unavailable: boolean
  assignments: ScheduleAssignment[]
}

/** GET /me/schedule item. Note `serviceId`, not `id`. */
export interface MyScheduleItem {
  serviceId: string
  title: string
  startsAt: string
  endsAt: string
  teamId: string
  teamName: string
  /** Note on the caller's assignment, `""` when none. */
  notes: string
  /** Documented in the field table of schedule.md but missing from its example; read defensively. */
  unavailable?: boolean
  isAbsentTaker?: boolean
}

/** POST /services and PATCH /services/:id response. */
export interface Service {
  id: string
  title: string
  startsAt: string
  endsAt: string
  createdBy: string
  createdAt: string
}

export interface CreateServiceBody {
  title: string
  startsAt: string
  endsAt: string
}

/** Any non-empty subset. Send only what changed. */
export type UpdateServiceBody = Partial<CreateServiceBody>

/** GET /services/:id/teams/:teamId/candidates item (assignments.md). */
export interface Candidate {
  userId: string
  name: string
  assigned: boolean
  /** The member marked this service unavailable: shown, not selectable. */
  unavailable: boolean
}

export type SkippedReason =
  'ALREADY_ASSIGNED_THIS_TEAM' | 'ALREADY_ASSIGNED_OTHER_TEAM' | 'UNAVAILABLE'

export interface SkippedEntry {
  userId: string
  reason: SkippedReason
  /** Only with ALREADY_ASSIGNED_OTHER_TEAM. */
  heldByTeam?: { id: string; name: string }
}

/** POST /services/:id/teams/:teamId/assignments, 200. */
export interface AssignResult {
  assigned: string[]
  skipped: SkippedEntry[]
}

/** PATCH /services/:id/teams/:teamId/assignments/:userId, 200. */
export interface AssignmentNote {
  serviceId: string
  userId: string
  teamId: string
  notes: string
}

/** User object from users.md (the password hash is never returned). */
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
  createdAt: string
}

export interface CreateUserBody {
  name: string
  email: string
  role?: UserRole
}

export interface UpdateUserBody {
  name?: string
  email?: string
  role?: UserRole
  isActive?: boolean
}

/** GET /teams item, POST /teams and PATCH /teams/:id response (teams.md). */
export interface Team {
  id: string
  name: string
}

/** GET /teams/:id/members item (teams.md). */
export interface TeamMember {
  userId: string
  name: string
  email: string
  isLeader: boolean
  isActive: boolean
}

/** PUT /teams/:id/members/:userId, 200. */
export interface MemberUpsertResult {
  teamId: string
  userId: string
  isLeader: boolean
}

/** DELETE /teams/:id/members/:userId, 200. */
export interface RemovedAssignment {
  serviceId: string
  title: string
  startsAt: string
}

export interface RemoveMemberResult {
  removedAssignments: RemovedAssignment[]
}

/** GET /me/absences (attendance.md). */
export interface MyAbsences {
  count: number
  items: { serviceId: string; title: string; startsAt: string }[]
}

/** GET /services/:id/teams/:teamId/absences (attendance.md): users already recorded absent. */
export interface ServiceTeamAbsences {
  userIds: string[]
}

/** GET /teams/:teamId/absences item (attendance.md). */
export interface TeamAbsenceRow {
  userId: string
  name: string
  count: number
}
