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

// Events (docs/api/events.md). Created through the admin API with the cached admin token (no login
// here). The title ALWAYS starts with `e2e-` so the global cleanup can find a leftover.
const apiBase = `${process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:5174'}/api`

export interface E2eEvent {
  id: string
  title: string
  startsAt: string
  location: string
  description: string
}

/** An instant `days` from now, at 10:00 Asia/Jakarta, written with an explicit +07:00 offset. */
export function futureStartsAt(days = 30): string {
  const wallClock = new Date(Date.now() + days * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000)
  return `${wallClock.toISOString().slice(0, 10)}T10:00:00+07:00`
}

function adminHeaders() {
  return { Authorization: `Bearer ${readAdminToken()}`, 'Content-Type': 'application/json' }
}

/** POST /admin/events. Expects 201, so a broken setup fails loudly. */
export async function createE2eEvent(days = 30): Promise<E2eEvent> {
  const response = await fetch(`${apiBase}/admin/events`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      title: e2eName(),
      startsAt: futureStartsAt(days),
      location: 'Lokasi akan diisi',
      description: 'Deskripsi akan diisi.',
    }),
  })
  refreshFrom({ 'x-access-token': response.headers.get('x-access-token') ?? '' })
  if (response.status !== 201) throw new Error(`create e2e event failed: ${response.status}`)
  return (await response.json()) as E2eEvent
}

/** DELETE /admin/events/:id. Expects 204. */
export async function deleteE2eEvent(id: string): Promise<void> {
  const response = await fetch(`${apiBase}/admin/events/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  })
  refreshFrom({ 'x-access-token': response.headers.get('x-access-token') ?? '' })
  if (response.status !== 204) throw new Error(`delete e2e event failed: ${response.status}`)
}
