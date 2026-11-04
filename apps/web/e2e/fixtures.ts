import { randomBytes } from 'node:crypto'
import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import { recordCreated } from './created.ts'

// Credentials come from process.env only. Messages name the variable, never its value,
// and no response body is ever included in an error (bodies can hold tokens).
const SESSION_KEY = 'echo.session'
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export function randomSuffix(): string {
  return randomBytes(4).toString('hex')
}

/** Logs in through the API (dev proxy) and returns an access token. */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post(`${baseUrl}/api/auth/login`, { data: { email, password } })
  if (response.status() !== 200)
    throw new Error(`API login failed with status ${response.status()}`)
  const body = (await response.json()) as { accessToken: string }
  return body.accessToken
}

export async function adminToken(request: APIRequestContext): Promise<string> {
  return apiLogin(request, requireEnv('E2E_ADMIN_EMAIL'), requireEnv('E2E_ADMIN_PASSWORD'))
}

export interface CreatedUser {
  id: string
  name: string
  email: string
  password: string
}

/** Creates an `e2e-` user (MEMBER unless `role` is given) through POST /users. Its password is the server's default one. */
export async function createE2eUser(
  request: APIRequestContext,
  role: 'MEMBER' | 'PEMBINA' = 'MEMBER',
): Promise<CreatedUser> {
  const password = requireEnv('E2E_USER_PASSWORD')
  const token = await adminToken(request)
  const suffix = randomSuffix()
  const name = `e2e-${suffix}`
  const email = `e2e-${suffix}@echo.local`
  const response = await request.post(`${baseUrl}/api/users`, {
    data: { name, email, role },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status() === 403) {
    throw new Error(
      'POST /users returned 403: the e2e admin may still have to change its password (PASSWORD_CHANGE_REQUIRED). Stopping.',
    )
  }
  if (response.status() !== 201)
    throw new Error(`POST /users failed with status ${response.status()}`)
  const created = (await response.json()) as { id: string }
  recordCreated('user', created.id)
  return { id: created.id, name, email, password }
}

const authed = (token: string) => ({ Authorization: `Bearer ${token}` })

async function adminCall<T>(
  request: APIRequestContext,
  method: 'post' | 'put' | 'patch',
  path: string,
  data: unknown,
  expected: number[],
): Promise<T> {
  const token = await adminToken(request)
  const response = await request[method](`${baseUrl}/api${path}`, {
    data,
    headers: authed(token),
  })
  // Only the status is reported: bodies can hold tokens.
  if (!expected.includes(response.status()))
    throw new Error(`${method.toUpperCase()} ${path} failed with status ${response.status()}`)
  return (await response.json()) as T
}

/** ISO 8601 with an explicit +07:00 offset, `days` ahead of now, on a whole hour (WIB). */
export function wibInstant(days: number, hour: number): string {
  const wib = new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000)
  const date = wib.toISOString().slice(0, 10)
  return `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`
}

export interface CreatedService {
  id: string
  title: string
  startsAt: string
  endsAt: string
}

/** Creates a future `e2e-` service as admin (POST /services). */
export async function createE2eService(
  request: APIRequestContext,
  daysAhead = 30,
): Promise<CreatedService> {
  const title = `e2e-${randomSuffix()}`
  const service = await adminCall<CreatedService>(
    request,
    'post',
    '/services',
    { title, startsAt: wibInstant(daysAhead, 9), endsAt: wibInstant(daysAhead, 11) },
    [201],
  )
  recordCreated('service', service.id)
  return service
}

/**
 * Creates an `e2e-` service that starts `seconds` from now and lasts two hours. The API only
 * accepts a future start, so a "started" service means creating this and waiting.
 */
export async function createStartingSoonService(
  request: APIRequestContext,
  seconds = 45,
): Promise<CreatedService> {
  const title = `e2e-${randomSuffix()}`
  const start = new Date(Date.now() + seconds * 1000)
  const service = await adminCall<CreatedService>(
    request,
    'post',
    '/services',
    {
      title,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    },
    [201],
  )
  recordCreated('service', service.id)
  return service
}

/** Creates an `e2e-` team as admin (POST /teams). */
export async function createE2eTeam(
  request: APIRequestContext,
): Promise<{ id: string; name: string }> {
  return adminCall(request, 'post', '/teams', { name: `e2e-${randomSuffix()}` }, [201])
}

/** Adds a user to a team as admin, optionally as its leader (PUT /teams/:id/members/:userId). */
export async function addTeamMember(
  request: APIRequestContext,
  teamId: string,
  userId: string,
  isLeader = false,
): Promise<void> {
  await adminCall(request, 'put', `/teams/${teamId}/members/${userId}`, { isLeader }, [200])
}

/** Deactivates an `e2e-` user as admin (PATCH /users/:id). */
export async function deactivateUser(request: APIRequestContext, userId: string): Promise<void> {
  await adminCall(request, 'patch', `/users/${userId}`, { isActive: false }, [200])
}

/** Ids of everyone assigned to one service, from the full schedule (GET /services). */
export async function assignedUserIds(
  request: APIRequestContext,
  serviceId: string,
): Promise<string[]> {
  const token = await adminToken(request)
  const response = await request.get(`${baseUrl}/api/services`, { headers: authed(token) })
  if (response.status() !== 200)
    throw new Error(`GET /services failed with status ${response.status()}`)
  const services = (await response.json()) as {
    id: string
    assignments: { userId: string }[]
  }[]
  return services.find((s) => s.id === serviceId)?.assignments.map((a) => a.userId) ?? []
}

/** Assigns users to a service for a team as admin (ADMIN may use any team). */
export async function assignUsers(
  request: APIRequestContext,
  serviceId: string,
  teamId: string,
  userIds: string[],
): Promise<void> {
  const result = await adminCall<{ assigned: string[] }>(
    request,
    'post',
    `/services/${serviceId}/teams/${teamId}/assignments`,
    { userIds },
    [200],
  )
  if (result.assigned.length !== userIds.length) throw new Error('Not every e2e user was assigned')
}

/**
 * Logs in through the UI and completes the forced password change. The new password is
 * generated here, lives only in memory, and is never logged or stored.
 */
export async function loginAndChange(page: Page, user: CreatedUser): Promise<void> {
  const a = messages.auth
  const next = `Np-${randomSuffix()}-${randomSuffix()}`
  await page.goto('/login')
  await page.getByLabel(a.emailLabel).fill(user.email)
  await page.getByLabel(a.passwordLabel).fill(user.password)
  await page.getByRole('button', { name: a.loginSubmit }).click()
  await expect(page).toHaveURL(/\/change-password$/)
  await page.getByLabel(a.currentPasswordLabel).fill(user.password)
  await page.getByLabel(a.newPasswordLabel, { exact: true }).fill(next)
  await page.getByLabel(a.confirmPasswordLabel).fill(next)
  await page.getByRole('button', { name: a.changePasswordSubmit }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** Reads the service list as admin (GET /services?includePast=true). */
export async function listServices(
  request: APIRequestContext,
): Promise<{ id: string; title: string; startsAt: string; endsAt: string }[]> {
  const token = await adminToken(request)
  const response = await request.get(`${baseUrl}/api/services?includePast=true`, {
    headers: authed(token),
  })
  if (response.status() !== 200)
    throw new Error(`GET /services failed with status ${response.status()}`)
  return (await response.json()) as {
    id: string
    title: string
    startsAt: string
    endsAt: string
  }[]
}

/** Puts a session token in sessionStorage before any page script runs. */
export async function seedSession(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.sessionStorage.getItem(key!)) window.sessionStorage.setItem(key!, value!)
    },
    [SESSION_KEY, token],
  )
}

/** `test` whose `page` is already logged in as the e2e admin. */
export const test = base.extend({
  page: async ({ page, request }, provide) => {
    await seedSession(page, await adminToken(request))
    await provide(page)
  },
})
export { expect } from '@playwright/test'
