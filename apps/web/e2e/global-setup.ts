import {
  PEMBINA_EMAIL,
  clearSession,
  loginSummary,
  recordLogin,
  requireEnv,
  resetLoginCount,
  storeToken,
} from './session.ts'

// Before every run: delete all `e2e-` data through the API, log in once as the E2E admin and the
// shared PEMBINA, and cache both sessions (see session.ts). Output is counts only: never a name,
// an email, a credential or an environment value. Any failed call fails the whole run.
const PREFIX = 'e2e-'
const POOL = 8
const origin = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const api = `${origin}/api`

interface Item {
  id: string
}

async function login(email: string, password: string): Promise<string> {
  recordLogin(email)
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (response.status !== 200)
    throw new Error(`e2e setup: login failed with status ${response.status}`)
  return ((await response.json()) as { accessToken: string }).accessToken
}

function headersFor(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function getList<T>(path: string, token: string): Promise<T[]> {
  const response = await fetch(`${api}${path}`, { headers: headersFor(token) })
  if (response.status !== 200)
    throw new Error(`e2e setup: GET ${path} failed with status ${response.status}`)
  return (await response.json()) as T[]
}

/** Deletes every id (limited parallelism). Returns how many succeeded and the failing statuses. */
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

/** Ids of the items whose picked field is a string starting with the prefix (null never matches). */
function idsWithPrefix<T extends Item>(items: T[], pick: (item: T) => string | null): string[] {
  return items.filter((item) => pick(item)?.startsWith(PREFIX) ?? false).map((item) => item.id)
}

async function ensurePembina(adminToken: string): Promise<void> {
  const users = await getList<{ email: string }>('/users', adminToken)
  if (users.some((u) => u.email.toLowerCase() === PEMBINA_EMAIL)) return
  const response = await fetch(`${api}/users`, {
    method: 'POST',
    headers: headersFor(adminToken),
    body: JSON.stringify({ name: 'e2e-pembina', email: PEMBINA_EMAIL, role: 'PEMBINA' }),
  })
  if (response.status !== 201)
    throw new Error(`e2e setup: creating the shared PEMBINA failed with status ${response.status}`)
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const started = Date.now()
  const adminEmail = requireEnv('E2E_ADMIN_EMAIL').trim().toLowerCase()
  const userPassword = requireEnv('E2E_USER_PASSWORD')
  resetLoginCount()
  const token = await login(requireEnv('E2E_ADMIN_EMAIL'), requireEnv('E2E_ADMIN_PASSWORD'))
  storeToken('admin', token)
  const me = await (async () => {
    const response = await fetch(`${api}/me`, { headers: headersFor(token) })
    if (response.status !== 200)
      throw new Error(`e2e setup: GET /me failed with status ${response.status}`)
    return (await response.json()) as Item
  })()

  // Public submissions first: they relate to nothing else. Matched by `name` (prayer requests) and
  // `fullName` (volunteer applications) with the prefix; a null name never matches, so tests always
  // send an `e2e-` name. Same strict rule as everything below: any status but 204 fails the run.
  const prayerRequests = idsWithPrefix(
    await getList<Item & { name: string | null }>('/admin/prayer-requests', token),
    (r) => r.name,
  )
  const applications = idsWithPrefix(
    await getList<Item & { fullName: string }>('/admin/volunteer-applications', token),
    (a) => a.fullName,
  )
  const submissions = {
    prayer: await deleteAll('/admin/prayer-requests', prayerRequests, token),
    volunteer: await deleteAll('/admin/volunteer-applications', applications, token),
  }

  // Order matters for the rest: services first (soft delete), then teams (the database cascades their
  // assignments and absences, which frees leaders and absence takers), then users.
  const services = (
    await getList<Item & { title: string }>('/services?includePast=true', token)
  ).filter((s) => s.title.startsWith(PREFIX))
  const teams = (await getList<Item & { name: string }>('/teams', token)).filter((t) =>
    t.name.startsWith(PREFIX),
  )
  const results = {
    services: await deleteAll(
      '/services',
      services.map((s) => s.id),
      token,
    ),
    teams: await deleteAll(
      '/teams',
      teams.map((t) => t.id),
      token,
    ),
  }
  const users = (await getList<Item & { email: string }>('/users', token)).filter((u) => {
    const email = u.email.trim().toLowerCase()
    return (
      email.startsWith(PREFIX) && email !== adminEmail && email !== PEMBINA_EMAIL && u.id !== me.id
    )
  })
  const userResult = await deleteAll(
    '/users',
    users.map((u) => u.id),
    token,
  )

  const failed = [
    ...submissions.prayer.failures,
    ...submissions.volunteer.failures,
    ...results.services.failures,
    ...results.teams.failures,
    ...userResult.failures,
  ]
  const summary = `e2e cleanup: prayer requests ${submissions.prayer.deleted}, volunteer applications ${submissions.volunteer.deleted}, services ${results.services.deleted}, teams ${results.teams.deleted}, users ${userResult.deleted} deleted in ${Date.now() - started} ms`
  console.log(summary)
  if (failed.length > 0) {
    const byStatus = new Map<number, number>()
    for (const status of failed) byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
    const detail = [...byStatus].map(([status, count]) => `${count} x ${status}`).join(', ')
    throw new Error(
      `e2e cleanup failed: prayer requests ${submissions.prayer.failures.length}, volunteer applications ${submissions.volunteer.failures.length}, services ${results.services.failures.length}, teams ${results.teams.failures.length}, users ${userResult.failures.length} not deleted (${detail})`,
    )
  }

  await ensurePembina(token)
  storeToken('pembina', await login(PEMBINA_EMAIL, userPassword))

  return async () => {
    console.log(loginSummary())
    clearSession()
  }
}
