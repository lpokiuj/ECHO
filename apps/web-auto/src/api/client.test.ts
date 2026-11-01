import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/setup'
import { ERROR_BODIES, LOGIN_OK, ME_EXAMPLE, handlers, respond } from '@/test/handlers'
import { changePassword, getHealth, getMe, login } from './client'
import { ApiError } from './errors'
import { getToken, logout, setToken, subscribe } from './session'

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const
let events: string[]
let off: () => void

beforeEach(() => {
  events = []
  off = subscribe((e) => events.push(e.type))
})
afterEach(() => {
  off()
  logout()
  vi.restoreAllMocks()
})

describe('token handling', () => {
  it('stores the login token and sends it as a Bearer header', async () => {
    let auth: string | null = null
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json(LOGIN_OK)),
      http.get('*/api/me', ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json(ME_EXAMPLE)
      }),
    )
    const result = await login({ email: 'a@echo.local', password: 'x' })
    setToken('fake-token-1')
    expect(result.accessToken).toBe('<accessToken>')
    await getMe()
    expect(auth).toBe('Bearer fake-token-1')
  })

  it('replaces the token when X-Access-Token is present', async () => {
    setToken('fake-token-1')
    server.use(handlers.me({ 'X-Access-Token': 'fake-token-2' }))
    await getMe()
    expect(getToken()).toBe('fake-token-2')
  })

  it('keeps the token when X-Access-Token is absent', async () => {
    setToken('fake-token-1')
    server.use(handlers.me())
    await getMe()
    expect(getToken()).toBe('fake-token-1')
  })

  it.each([
    [403, ERROR_BODIES.forbidden],
    [404, ERROR_BODIES.notFound],
    [409, ERROR_BODIES.conflict],
  ])('replaces the token on a %i response', async (status, body) => {
    setToken('fake-token-1')
    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json(body, { status, headers: { 'X-Access-Token': 'fake-token-3' } }),
      ),
    )
    await expect(getMe()).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBe('fake-token-3')
  })

  it('never logs and never puts the token in a URL', async () => {
    const spies = consoleMethods.map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const urls: string[] = []
    setToken('fake-token-1')
    server.use(
      http.get('*/api/me', ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json(ERROR_BODIES.unauthorized, { status: 401 })
      }),
    )
    await getMe().catch(() => undefined)
    spies.forEach((s) => expect(s).not.toHaveBeenCalled())
    expect(urls.join()).not.toContain('fake-token-1')
  })
})

describe('401 and PASSWORD_CHANGE_REQUIRED', () => {
  it('clears the session and emits unauthorized on 401', async () => {
    setToken('fake-token-1')
    server.use(http.get('*/api/me', () => respond(401, ERROR_BODIES.unauthorized)))
    await expect(getMe()).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(getToken()).toBeNull()
    expect(window.sessionStorage.length).toBe(0)
    expect(events).toEqual(['unauthorized'])
  })

  it('keeps the session on 401 from change-password (wrong current password)', async () => {
    setToken('fake-token-1')
    server.use(
      http.post('*/api/auth/change-password', () => respond(401, ERROR_BODIES.unauthorized)),
    )
    await expect(
      changePassword({ currentPassword: 'wrong', newPassword: 'newpassword1' }),
    ).rejects.toMatchObject({ kind: 'wrongCurrentPassword', status: 401 })
    expect(getToken()).toBe('fake-token-1')
    expect(events).toEqual([])
  })

  it('emits passwordChangeRequired and keeps the token on that 403', async () => {
    setToken('fake-token-1')
    server.use(http.get('*/api/me', () => respond(403, ERROR_BODIES.passwordChangeRequired)))
    await expect(getMe()).rejects.toMatchObject({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED' })
    expect(events).toEqual(['passwordChangeRequired'])
    expect(getToken()).toBe('fake-token-1')
  })

  it('does not emit on a plain 403', async () => {
    server.use(http.get('*/api/me', () => respond(403, ERROR_BODIES.forbidden)))
    await expect(getMe()).rejects.toMatchObject({ kind: 'forbidden' })
    expect(events).toEqual([])
  })
})

describe('health', () => {
  it('reads /health', async () => {
    server.use(http.get('*/api/health', () => HttpResponse.json({ status: 'ok' })))
    await expect(getHealth()).resolves.toEqual({ status: 'ok' })
  })
})
