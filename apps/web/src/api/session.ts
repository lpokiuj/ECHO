// Session store: the token lives in memory and is mirrored to sessionStorage (never localStorage).
// No React and no router imports, so the API client can use it without import cycles.
const STORAGE_KEY = 'echo.session'

export type SessionEvent = { type: 'unauthorized' } | { type: 'passwordChangeRequired' }
type Listener = (event: SessionEvent) => void

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let token: string | null = readStored()
const listeners = new Set<Listener>()

export function getToken(): string | null {
  return token
}

export function setToken(next: string): void {
  token = next
  try {
    window.sessionStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be unavailable; the in-memory token still works.
  }
}

function wipe(): void {
  token = null
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up.
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emit(event: SessionEvent): void {
  listeners.forEach((listener) => listener(event))
}

/** Voluntary logout: clears the session without notifying subscribers. */
export function logout(): void {
  wipe()
}

/** Session ended by the server (401): clear it and tell subscribers to go to login. */
export function expireSession(): void {
  wipe()
  emit({ type: 'unauthorized' })
}
