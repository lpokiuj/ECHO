import { afterEach, describe, expect, it } from 'vitest'
import { getToken, logout, setToken, subscribe, expireSession } from './session'

afterEach(() => logout())

describe('session store', () => {
  it('keeps the token in sessionStorage and never in localStorage', () => {
    setToken('fake-token-1')
    expect(getToken()).toBe('fake-token-1')
    expect(Object.values(window.sessionStorage)).toContain('fake-token-1')
    // eslint-disable-next-line no-restricted-properties -- asserting the token never reaches localStorage
    expect(window.localStorage.length).toBe(0)
  })

  it('clears memory and storage on logout', () => {
    setToken('fake-token-1')
    logout()
    expect(getToken()).toBeNull()
    expect(window.sessionStorage.length).toBe(0)
  })

  it('clears the session and notifies subscribers on expiry', () => {
    setToken('fake-token-1')
    const events: string[] = []
    const off = subscribe((e) => events.push(e.type))
    expireSession()
    off()
    expect(getToken()).toBeNull()
    expect(window.sessionStorage.length).toBe(0)
    expect(events).toEqual(['unauthorized'])
  })
})
