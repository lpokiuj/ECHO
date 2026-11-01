import { randomBytes } from 'node:crypto'
import { test as base, type APIRequestContext, type Page } from '@playwright/test'

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

/** Creates an `e2e-` MEMBER through POST /users. Its password is the server's default one. */
export async function createE2eUser(request: APIRequestContext): Promise<CreatedUser> {
  const password = requireEnv('E2E_USER_PASSWORD')
  const token = await adminToken(request)
  const suffix = randomSuffix()
  const name = `e2e-${suffix}`
  const email = `e2e-${suffix}@echo.local`
  const response = await request.post(`${baseUrl}/api/users`, {
    data: { name, email, role: 'MEMBER' },
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
  return { id: created.id, name, email, password }
}

const authed = (token: string) => ({ Authorization: `Bearer ${token}` })

async function adminCall<T>(
  request: APIRequestContext,
  method: 'post' | 'put',
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
  return adminCall<CreatedService>(
    request,
    'post',
    '/services',
    { title, startsAt: wibInstant(daysAhead, 9), endsAt: wibInstant(daysAhead, 11) },
    [201],
  )
}

/** Creates an `e2e-` team as admin (POST /teams). */
export async function createE2eTeam(
  request: APIRequestContext,
): Promise<{ id: string; name: string }> {
  return adminCall(request, 'post', '/teams', { name: `e2e-${randomSuffix()}` }, [201])
}

/** Adds a user to a team as admin (PUT /teams/:id/members/:userId). */
export async function addTeamMember(
  request: APIRequestContext,
  teamId: string,
  userId: string,
): Promise<void> {
  await adminCall(request, 'put', `/teams/${teamId}/members/${userId}`, { isLeader: false }, [200])
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
