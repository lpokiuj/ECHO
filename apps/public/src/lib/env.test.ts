import { describe, expect, it, vi } from 'vitest'
import { getPortalUrl } from './env'

describe('getPortalUrl', () => {
  it('defaults to the same-origin portal path', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    expect(getPortalUrl()).toBe('/volunteer-portal/')
  })

  it('uses VITE_PORTAL_URL when set', () => {
    vi.stubEnv('VITE_PORTAL_URL', 'http://localhost:9999/volunteer-portal/')
    expect(getPortalUrl()).toBe('http://localhost:9999/volunteer-portal/')
  })

  it('ignores a blank value', () => {
    vi.stubEnv('VITE_PORTAL_URL', '   ')
    expect(getPortalUrl()).toBe('/volunteer-portal/')
  })
})
