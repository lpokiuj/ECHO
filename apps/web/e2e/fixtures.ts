import { randomBytes } from 'node:crypto'
import {
  expect,
  test as base,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import { PEMBINA_EMAIL, readToken, recordLogin, refreshFrom, requireEnv } from './session.ts'

// Credentials come from process.env only. Messages name the variable, never its value,
// and no response body is ever included in an error (bodies can hold tokens).
const SESSION_KEY = 'echo.session'
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export { PEMBINA_EMAIL, requireEnv }

export function randomSuffix(): string {
  return randomBytes(4).toString('hex')
}

/**
 * The E2E admin's token, from the session the global setup cached. It never logs in.
 */
export async function adminToken(): Promise<string> {
  return readToken('admin')
}

/** The shared PEMBINA's cached token (created by the global setup, never changed or deleted). */
export function pembinaToken(): string {
  return readToken('pembina')
}

/** Logs in through the API as a test user and returns only the status. Counted like any login. */
export async function loginAttemptStatus(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<number> {
  recordLogin(email)
  const response = await request.post(`${baseUrl}/api/auth/login`, { data: { email, password } })
  return response.status()
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
  const token = await adminToken()
  const suffix = randomSuffix()
  const name = `e2e-${suffix}`
  const email = `e2e-${suffix}@echo.local`
  const response = await request.post(`${baseUrl}/api/users`, {
    data: { name, email, role },
    headers: { Authorization: `Bearer ${token}` },
  })
  refreshFrom('admin', response.headers())
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
  method: 'post' | 'put' | 'patch',
  path: string,
  data: unknown,
  expected: number[],
): Promise<T> {
  const token = await adminToken()
  const response = await request[method](`${baseUrl}/api${path}`, {
    data,
    headers: authed(token),
  })
  refreshFrom('admin', response.headers())
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
  const token = await adminToken()
  const response = await request.get(`${baseUrl}/api/services`, { headers: authed(token) })
  refreshFrom('admin', response.headers())
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
 * Logs in through the UI as a created user and waits for the home page. New and reset accounts
 * are not forced to change their password, so there is no change step.
 */
export async function loginAndChange(page: Page, user: CreatedUser): Promise<void> {
  const a = messages.auth
  await page.goto('login')
  await page.getByLabel(a.emailLabel).fill(user.email)
  await page.getByLabel(a.passwordLabel).fill(user.password)
  await page.getByRole('button', { name: a.loginSubmit }).click()
  await expect(page).toHaveURL(/\/volunteer-portal\/$/)
}

/**
 * Finds a record in a paginated list (10 per page, client-side, no search UI): checks page 1, the
 * last page, then pages backward until `item` is on screen. `list` (the table or cards container) is awaited
 * first so a list that has not loaded is not mistaken for a missing record. Returns `item`; the
 * caller asserts on it.
 */
export async function findInList(
  page: Page,
  item: Locator,
  options: { list?: Locator } = {},
): Promise<Locator> {
  const p = messages.pagination
  if (options.list) await expect(options.list).toBeVisible()
  const pager = page.getByRole('navigation', { name: p.label })
  const previous = pager.getByRole('button', { name: p.previous })
  const next = pager.getByRole('button', { name: p.next })
  const status = pager.getByRole('status')
  // Other workers add records while this runs, so the page total can change: only the page
  // number is compared. A list may also still be refetching after a save, so the whole search is
  // retried until the record shows up. The lists are long (hundreds of leftover rows), so the
  // search checks page 1, then the last page, then walks backward from there. The page lives in
  // the URL (`?page=N`, clamped), so a jump is a history change, not a reload: toggles stay as set.
  const jump = async (target: number | 'last') => {
    await page.evaluate((to) => {
      const url = new URL(window.location.href)
      if (to === 1) url.searchParams.delete('page')
      else url.searchParams.set('page', String(to === 'last' ? 1_000_000 : to))
      window.history.pushState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, target)
    await expect(status).toContainText(target === 'last' ? /Halaman (\d+) dari \1 / : /^Halaman 1 /)
  }
  const currentPage = async () => {
    const match = /(\d+) dari/.exec((await status.textContent()) ?? '')
    return Number(match?.[1] ?? 1)
  }
  await expect(async () => {
    if ((await pager.count()) > 0) {
      await jump(1)
      if ((await item.count()) === 0 && (await next.isEnabled())) {
        await jump('last')
        while ((await item.count()) === 0 && (await previous.isEnabled())) {
          const n = await currentPage()
          await previous.click()
          await expect(status).toContainText(`${p.status(n - 1, 0).replace(/ 0$/, '')} `)
        }
      }
    }
    expect(await item.count()).toBeGreaterThan(0)
  }).toPass({ timeout: 60_000 })
  return item
}

/**
 * Asserts that `item` is on no page of a paginated list: walks every page (the page lives in the
 * URL as `?page=N`) and fails if the record shows up anywhere. `list` is awaited first so an
 * unloaded list is not mistaken for a missing record.
 */
export async function expectNotInList(
  page: Page,
  item: Locator,
  options: { list: Locator },
): Promise<void> {
  const p = messages.pagination
  await expect(options.list).toBeVisible()
  const pager = page.getByRole('navigation', { name: p.label })
  const next = pager.getByRole('button', { name: p.next })
  const status = pager.getByRole('status')
  await expect(item).toHaveCount(0)
  while ((await pager.count()) > 0 && (await next.isEnabled())) {
    const before = await status.textContent()
    await next.click()
    await expect(status).not.toHaveText(before ?? '')
    await expect(item).toHaveCount(0)
  }
}

/** Reads a whole list as admin (GET /users or /teams); only ids are used by callers. */
async function listAs<T>(request: APIRequestContext, path: string): Promise<T[]> {
  const token = await adminToken()
  const response = await request.get(`${baseUrl}/api${path}`, { headers: authed(token) })
  refreshFrom('admin', response.headers())
  if (response.status() !== 200)
    throw new Error(`GET ${path} failed with status ${response.status()}`)
  return (await response.json()) as T[]
}

export const listUsers = (request: APIRequestContext) => listAs<{ id: string }>(request, '/users')
export const listTeams = (request: APIRequestContext) => listAs<{ id: string }>(request, '/teams')

/** Reads the service list as admin (GET /services?includePast=true). */
export async function listServices(
  request: APIRequestContext,
): Promise<{ id: string; title: string; startsAt: string; endsAt: string }[]> {
  const token = await adminToken()
  const response = await request.get(`${baseUrl}/api/services?includePast=true`, {
    headers: authed(token),
  })
  refreshFrom('admin', response.headers())
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

/** Counts every browser login request of a context (counts only, see session.ts). */
function trackLogins(context: BrowserContext): void {
  context.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/auth/login')) return
    const email = (request.postDataJSON() as { email?: unknown } | null)?.email
    if (typeof email === 'string') recordLogin(email)
  })
}

/**
 * The base `test`: like Playwright's, but every browser context it creates (the default one and
 * any `browser.newContext()`) counts its login calls. Specs that log in as a created user use it.
 */
export const plain = base.extend<object, { browser: Browser }>({
  browser: [
    async ({ browser }, provide) => {
      const original = browser.newContext.bind(browser)
      browser.newContext = async (options) => {
        const context = await original(options)
        trackLogins(context)
        return context
      }
      await provide(browser)
      browser.newContext = original
    },
    { scope: 'worker' },
  ],
})

/** `plain` whose `page` already holds the cached e2e admin session (no login). */
export const test = plain.extend({
  page: async ({ page }, provide) => {
    await seedSession(page, await adminToken())
    await provide(page)
  },
})
export { expect } from '@playwright/test'
