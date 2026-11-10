import {
  clearSession,
  loginSummary,
  recordLogin,
  requireEnv,
  resetLoginCount,
  storeAdminToken,
} from './session.ts'

// Before every run: log in once as the E2E admin, cache the session (see session.ts) and delete,
// through the admin API (docs/api/admin-submissions.md), every prayer request whose `name` starts
// with `e2e-`, every volunteer application whose `fullName` starts with `e2e-` and every event
// (docs/api/events.md) whose `title` starts with `e2e-`. Prefix only:
// nothing else is ever deleted. Output is counts only: never a name, an email, a credential or an
// environment value. Any failed list or delete call fails the whole run.
const PREFIX = 'e2e-'
const POOL = 8
const origin = process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:5174'
const api = `${origin}/api`

async function login(email: string, password: string): Promise<string> {
  recordLogin(email)
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (response.status !== 200)
    throw new Error(`e2e setup: login failed with status ${response.status}`)
  const body = (await response.json()) as { accessToken?: unknown }
  if (typeof body.accessToken !== 'string') throw new Error('e2e setup: login returned no token')
  return body.accessToken
}

function headersFor(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Lists everything (the admin endpoints have no pagination). Status and shape only in errors. */
async function getList(path: string, token: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${api}${path}`, { headers: headersFor(token) })
  if (response.status !== 200)
    throw new Error(`e2e setup: GET ${path} failed with status ${response.status}`)
  const body: unknown = await response.json()
  if (!Array.isArray(body)) throw new Error(`e2e setup: GET ${path} did not return a list`)
  return body as Record<string, unknown>[]
}

/** Ids of the items whose `field` is a string starting with the prefix (null fields never match). */
function idsWithPrefix(items: Record<string, unknown>[], field: string): string[] {
  return items.flatMap((item) => {
    const value = item[field]
    return typeof value === 'string' && value.startsWith(PREFIX) && typeof item.id === 'string'
      ? [item.id]
      : []
  })
}

/** Deletes every id (limited parallelism). Anything but 204 is a failure. */
async function deleteAll(path: string, ids: string[], token: string) {
  const failures: number[] = []
  let deleted = 0
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!
      const response = await fetch(`${api}${path}/${id}`, {
        method: 'DELETE',
        headers: headersFor(token),
      })
      if (response.status === 204) deleted += 1
      else failures.push(response.status)
    }
  }
  await Promise.all(Array.from({ length: Math.min(POOL, ids.length) }, worker))
  return { deleted, failures }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const started = Date.now()
  resetLoginCount()
  const token = await login(requireEnv('E2E_ADMIN_EMAIL'), requireEnv('E2E_ADMIN_PASSWORD'))
  storeAdminToken(token)

  const prayerIds = idsWithPrefix(await getList('/admin/prayer-requests', token), 'name')
  const applicationIds = idsWithPrefix(
    await getList('/admin/volunteer-applications', token),
    'fullName',
  )
  const eventIds = idsWithPrefix(await getList('/admin/events', token), 'title')
  const prayers = await deleteAll('/admin/prayer-requests', prayerIds, token)
  const applications = await deleteAll('/admin/volunteer-applications', applicationIds, token)

  const events = await deleteAll('/admin/events', eventIds, token)

  console.log(
    `e2e cleanup: prayer requests ${prayers.deleted}, volunteer applications ${applications.deleted}, events ${events.deleted} deleted in ${Date.now() - started} ms`,
  )
  const failed = [...prayers.failures, ...applications.failures, ...events.failures]
  if (failed.length > 0) {
    const byStatus = new Map<number, number>()
    for (const status of failed) byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
    const detail = [...byStatus].map(([status, count]) => `${count} x ${status}`).join(', ')
    throw new Error(
      `e2e cleanup failed: prayer requests ${prayers.failures.length}, volunteer applications ${applications.failures.length}, events ${events.failures.length} not deleted (${detail})`,
    )
  }

  return async () => {
    console.log(loginSummary())
    clearSession()
  }
}
