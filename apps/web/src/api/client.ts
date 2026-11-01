// The only place that touches the network. Dev proxy: /api -> backend (prefix stripped).
import { ApiError, fromResponse, networkError } from './errors'
import { expireSession, emit, getToken, setToken } from './session'
import type {
  AssignResult,
  AssignmentNote,
  Candidate,
  ChangePasswordRequest,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  CreateServiceBody,
  CreateUserBody,
  UpdateUserBody,
  User,
  MemberUpsertResult,
  MyScheduleItem,
  RemoveMemberResult,
  Service,
  ServiceSchedule,
  Team,
  TeamMember,
  UpdateServiceBody,
} from './types'

const BASE_URL = '/api'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** POST /auth/change-password only: a 401 means a wrong current password, not an expired session. */
  wrongPassword401?: boolean
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError()
  }

  // Every authenticated response, including 4xx, may carry a fresh token. Absent: keep the old one.
  const fresh = response.headers.get('X-Access-Token')
  if (fresh) setToken(fresh)

  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await readBody(response)) as T
  }

  const base = fromResponse(response.status, await readBody(response))
  if (response.status === 401) {
    if (options.wrongPassword401) {
      throw new ApiError({ status: 401, kind: 'wrongCurrentPassword' })
    }
    expireSession()
  }
  if (response.status === 403 && base.code === 'PASSWORD_CHANGE_REQUIRED') {
    emit({ type: 'passwordChangeRequired' })
  }
  throw base
}

export function login(body: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', { method: 'POST', body })
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/me')
}

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return request<void>('/auth/change-password', { method: 'POST', body, wrongPassword401: true })
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

function scheduleQuery(includePast: boolean): string {
  return includePast ? '?includePast=true' : ''
}

export function getServices(includePast = false): Promise<ServiceSchedule[]> {
  return request<ServiceSchedule[]>(`/services${scheduleQuery(includePast)}`)
}

export function getMySchedule(includePast = false): Promise<MyScheduleItem[]> {
  return request<MyScheduleItem[]>(`/me/schedule${scheduleQuery(includePast)}`)
}

export function createService(body: CreateServiceBody): Promise<Service> {
  return request<Service>('/services', { method: 'POST', body })
}

export function updateService(id: string, body: UpdateServiceBody): Promise<Service> {
  return request<Service>(`/services/${encodeURIComponent(id)}`, { method: 'PATCH', body })
}

export function deleteService(id: string): Promise<void> {
  return request<void>(`/services/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

function assignmentsPath(serviceId: string, teamId: string): string {
  return `/services/${encodeURIComponent(serviceId)}/teams/${encodeURIComponent(teamId)}`
}

export function getCandidates(serviceId: string, teamId: string): Promise<Candidate[]> {
  return request<Candidate[]>(`${assignmentsPath(serviceId, teamId)}/candidates`)
}

export function assignUsers(
  serviceId: string,
  teamId: string,
  userIds: string[],
  notes: Record<string, string> = {},
): Promise<AssignResult> {
  // Only non-empty notes are sent; users without an entry get "" on the server.
  const filled = Object.entries(notes).filter(([id, note]) => userIds.includes(id) && note !== '')
  return request<AssignResult>(`${assignmentsPath(serviceId, teamId)}/assignments`, {
    method: 'POST',
    body: filled.length > 0 ? { userIds, notes: Object.fromEntries(filled) } : { userIds },
  })
}

export function updateAssignmentNote(
  serviceId: string,
  teamId: string,
  userId: string,
  notes: string,
): Promise<AssignmentNote> {
  return request<AssignmentNote>(
    `${assignmentsPath(serviceId, teamId)}/assignments/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: { notes } },
  )
}

export function unassignUser(serviceId: string, teamId: string, userId: string): Promise<void> {
  return request<void>(
    `${assignmentsPath(serviceId, teamId)}/assignments/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
}

export function getUsers(): Promise<User[]> {
  return request<User[]>('/users')
}

export function createUser(body: CreateUserBody): Promise<User> {
  return request<User>('/users', { method: 'POST', body })
}

export function updateUser(id: string, body: UpdateUserBody): Promise<User> {
  return request<User>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body })
}

/** 204 with an empty body. The server sets its default password; nothing is returned. */
export function resetUserPassword(id: string): Promise<void> {
  return request<void>(`/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' })
}

const teamPath = (id: string) => `/teams/${encodeURIComponent(id)}`
const memberPath = (teamId: string, userId: string) =>
  `${teamPath(teamId)}/members/${encodeURIComponent(userId)}`

export function getTeams(): Promise<Team[]> {
  return request<Team[]>('/teams')
}

export function createTeam(name: string): Promise<Team> {
  return request<Team>('/teams', { method: 'POST', body: { name } })
}

export function renameTeam(id: string, name: string): Promise<Team> {
  return request<Team>(teamPath(id), { method: 'PATCH', body: { name } })
}

export function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  return request<TeamMember[]>(`${teamPath(teamId)}/members`)
}

/** Upsert. `isLeader` is always sent: a bodiless PUT would reset an existing leader to false. */
export function putTeamMember(
  teamId: string,
  userId: string,
  isLeader: boolean,
): Promise<MemberUpsertResult> {
  return request<MemberUpsertResult>(memberPath(teamId, userId), {
    method: 'PUT',
    body: { isLeader },
  })
}

export function removeTeamMember(teamId: string, userId: string): Promise<RemoveMemberResult> {
  return request<RemoveMemberResult>(memberPath(teamId, userId), { method: 'DELETE' })
}
