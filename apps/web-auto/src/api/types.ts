// The one module for API data types. Hand-written from ../api/docs/api/ (no OpenAPI spec).
export type UserRole = 'ADMIN' | 'PEMBINA' | 'MEMBER'

export type ErrorCode = 'PASSWORD_CHANGE_REQUIRED' | 'INVALID_USERS' | 'SERVICE_ALREADY_STARTED'

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
}

/** GET /services item: a service with everyone assigned across teams. */
export interface ServiceSchedule {
  id: string
  title: string
  startsAt: string
  endsAt: string
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
