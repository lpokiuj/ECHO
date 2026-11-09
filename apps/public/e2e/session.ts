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

// Session cache for one e2e run. The public site has no login of its own: the global setup logs
// in ONCE as the E2E admin (to clean up `e2e-` submissions through the admin API) and writes the
// token here, so no test ever logs in again. The file lives in the gitignored `.screens/`
// directory, is readable by the owner only, is replaced atomically (temp file plus rename) and is
// removed by the global teardown. Tokens are never printed.
const DIR = '.screens'
const TOKEN_FILE = `${DIR}/e2e-session.json`
const LOGIN_FILE = `${DIR}/e2e-logins.ndjson`

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

function readTokens(): { admin?: string } {
  if (!existsSync(TOKEN_FILE)) return {}
  return JSON.parse(readFileSync(TOKEN_FILE, 'utf8')) as { admin?: string }
}

export function readAdminToken(): string {
  const token = readTokens().admin
  if (!token) throw new Error('No cached admin session: the global setup did not run')
  return token
}

/** Stores the admin token: temp file with mode 0600, then an atomic rename. */
export function storeAdminToken(token: string): void {
  mkdirSync(DIR, { recursive: true })
  const temp = `${TOKEN_FILE}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
  writeFileSync(temp, JSON.stringify({ admin: token }), { mode: 0o600 })
  chmodSync(temp, 0o600)
  renameSync(temp, TOKEN_FILE)
}

/** Keeps the 15-minute sliding window alive: the API sends a fresh token on every response. */
export function refreshFrom(headers: Record<string, string>): void {
  const fresh = headers['x-access-token']
  if (fresh) storeAdminToken(fresh)
}

export function clearSession(): void {
  rmSync(TOKEN_FILE, { force: true })
}

/** Counts one login call. Only a short hash of the email is written, never the email. */
export function recordLogin(email: string): void {
  try {
    mkdirSync(DIR, { recursive: true })
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 8)
    appendFileSync(LOGIN_FILE, `${JSON.stringify({ hash })}\n`)
  } catch {
    // Counting is a measurement, never a reason to fail a test.
  }
}

export function resetLoginCount(): void {
  rmSync(LOGIN_FILE, { force: true })
}

/** One line of counts: the design target is exactly one admin login per run. */
export function loginSummary(): string {
  if (!existsSync(LOGIN_FILE)) return 'login calls: none'
  const lines = readFileSync(LOGIN_FILE, 'utf8').split('\n').filter(Boolean)
  return `login calls: ${lines.length} (admin ${lines.length})`
}
