import { randomBytes } from 'node:crypto'
import { readAdminToken, refreshFrom, requireEnv } from './session.ts'

// Helpers for specs. The public site has no login; the admin token comes from the session the
// global setup cached (never log in here). Everything a test submits MUST be named `e2e-<random>`
// (prayer request `name`, volunteer `fullName`), or the next run's cleanup cannot find it.
export { expect, test } from '@playwright/test'
export { readAdminToken as adminToken, refreshFrom, requireEnv }

export function e2eName(): string {
  return `e2e-${randomBytes(4).toString('hex')}`
}
