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
  return { name, email, password }
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
