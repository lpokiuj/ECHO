import { createHash } from 'node:crypto'
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'

// Session cache for one e2e run. The global setup logs in once per fixed account and writes the
// tokens here; every worker reads them, so no test logs in again. The file lives in the
// gitignored `.screens/` directory, is readable by the owner only, is replaced atomically
// (temp file plus rename) and is removed by the global teardown. Tokens are never printed.
const DIR = '.screens'
const TOKEN_FILE = `${DIR}/e2e-session.json`
const LOGIN_FILE = `${DIR}/e2e-logins.ndjson`

/** The shared PEMBINA account: created by the global setup, never changed, never deleted. */
export const PEMBINA_EMAIL = 'e2e-pembina@echo.local'

export type Actor = 'admin' | 'pembina'
type Tokens = Partial<Record<Actor, string>>

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

function readTokens(): Tokens {
  if (!existsSync(TOKEN_FILE)) return {}
  return JSON.parse(readFileSync(TOKEN_FILE, 'utf8')) as Tokens
}

export function readToken(actor: Actor): string {
  const token = readTokens()[actor]
  if (!token) throw new Error(`No cached ${actor} session: the global setup did not run`)
  return token
}

/** Stores a (new) token for an actor. Concurrent writers each replace the whole file. */
export function storeToken(actor: Actor, token: string): void {
  mkdirSync(DIR, { recursive: true })
  const temp = `${TOKEN_FILE}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
  writeFileSync(temp, JSON.stringify({ ...readTokens(), [actor]: token }), { mode: 0o600 })
  chmodSync(temp, 0o600)
  renameSync(temp, TOKEN_FILE)
}

/** Keeps the 15-minute sliding window alive: the API sends a fresh token on every response. */
export function refreshFrom(actor: Actor, headers: Record<string, string>): void {
  const fresh = headers['x-access-token']
  if (fresh) storeToken(actor, fresh)
}

export function clearSession(): void {
  rmSync(TOKEN_FILE, { force: true })
}

/** Which kind of account a login was for. Compared in memory; no email is ever written. */
function actorOf(email: string): 'admin' | 'pembina' | 'user' {
  const e = email.trim().toLowerCase()
  if (e === process.env.E2E_ADMIN_EMAIL?.trim().toLowerCase()) return 'admin'
  if (e === PEMBINA_EMAIL) return 'pembina'
  return 'user'
}

/** Counts one login call: the actor type and a short hash of the email, so only counts remain. */
export function recordLogin(email: string): void {
  try {
    mkdirSync(DIR, { recursive: true })
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 8)
    appendFileSync(LOGIN_FILE, `${JSON.stringify({ actor: actorOf(email), hash })}\n`)
  } catch {
    // Counting is a measurement, never a reason to fail a test.
  }
}

export function resetLoginCount(): void {
  rmSync(LOGIN_FILE, { force: true })
}

/** One line of counts: calls per actor type and the most logins any single test user made. */
export function loginSummary(): string {
  const empty = { admin: 0, pembina: 0, user: 0 }
  if (!existsSync(LOGIN_FILE)) return 'login calls: none'
  const counts = { ...empty }
  const perUser = new Map<string, number>()
  for (const line of readFileSync(LOGIN_FILE, 'utf8').split('\n').filter(Boolean)) {
    const { actor, hash } = JSON.parse(line) as { actor: keyof typeof empty; hash: string }
    counts[actor] += 1
    if (actor === 'user') perUser.set(hash, (perUser.get(hash) ?? 0) + 1)
  }
  const max = Math.max(0, ...perUser.values())
  const total = counts.admin + counts.pembina + counts.user
  return `login calls: ${total} (admin ${counts.admin}, shared pembina ${counts.pembina}, test users ${counts.user} across ${perUser.size} accounts, max ${max} per account)`
}
