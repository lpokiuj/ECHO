import { appendFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'

// Ids of data this run created through the API (never names, never tokens). The global
// teardown removes exactly these (DECISIONS D-046): services are deleted, users deactivated.
export const CREATED_FILE = '.screens/e2e-created.ndjson'

export function recordCreated(kind: 'service' | 'user', id: string): void {
  try {
    mkdirSync('.screens', { recursive: true })
    appendFileSync(CREATED_FILE, `${JSON.stringify({ kind, id })}\n`)
  } catch {
    // Cleanup is best effort: a missing record only leaves one extra e2e- row.
  }
}
