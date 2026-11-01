import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { CREATED_FILE } from './created.ts'

interface Created {
  kind: 'service' | 'user'
  id: string
}

/**
 * Removes only the data this run created through the API: services are deleted and users
 * are deactivated. It never lists or sweeps older data. Failures are reported by status only
 * (bodies can hold tokens) and never fail the run.
 */
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(CREATED_FILE)) return
  const created: Created[] = readFileSync(CREATED_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Created)
  unlinkSync(CREATED_FILE)
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password || created.length === 0) return
  const api = `${process.env.E2E_BASE_URL ?? 'http://localhost:5173'}/api`
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (login.status !== 200) {
    console.warn(`e2e cleanup skipped: admin login returned ${login.status}`)
    return
  }
  const { accessToken } = (await login.json()) as { accessToken: string }
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  let failed = 0
  for (const { kind, id } of created) {
    const response =
      kind === 'service'
        ? await fetch(`${api}/services/${id}`, { method: 'DELETE', headers })
        : await fetch(`${api}/users/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ isActive: false }),
          })
    // 404 means a test already deleted it.
    if (![200, 204, 404].includes(response.status)) failed += 1
  }
  console.log(`e2e cleanup: ${created.length - failed} of ${created.length} removed`)
}
