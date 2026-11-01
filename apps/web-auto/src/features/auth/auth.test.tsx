import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { request } from '@/api/client'
import { ApiError } from '@/api/errors'
import { getToken } from '@/api/session'
import { messages } from '@/lib/messages'
import { ERROR_BODIES, LOGIN_OK, ME_BY_ROLE, handlers, respond } from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

async function fillLogin(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText(messages.auth.emailLabel), email)
  await userEvent.type(screen.getByLabelText(messages.auth.passwordLabel), password)
  await userEvent.click(screen.getByRole('button', { name: messages.auth.loginSubmit }))
}

describe('login', () => {
  it('shows one generic message for wrong credentials and stores no token', async () => {
    server.use(http.post('*/api/auth/login', () => respond(401, ERROR_BODIES.unauthorized)))
    renderApp('/login')
    await fillLogin('nobody@echo.local', 'salah-salah')
    expect(await screen.findByText(messages.auth.loginFailed)).toBeInTheDocument()
    expect(getToken()).toBeNull()
    expect(screen.queryByText(ERROR_BODIES.unauthorized.message)).toBeNull()
  })

  it('validates empty and malformed input before calling the API', async () => {
    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: messages.auth.loginSubmit }))
    expect(await screen.findAllByText(messages.auth.required)).toHaveLength(2)
    await userEvent.type(screen.getByLabelText(messages.auth.emailLabel), 'bukan-email')
    await userEvent.click(screen.getByRole('button', { name: messages.auth.loginSubmit }))
    expect(await screen.findByText(messages.auth.invalidEmail)).toBeInTheDocument()
  })

  it('logs in, loads /me and lands home with the greeting', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json(LOGIN_OK)),
      handlers.me(),
    )
    const { router } = renderApp('/login')
    await fillLogin('docs-example-lead-a@echo.local', 'apa-saja')
    expect(await heading(messages.placeholder.title)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getAllByText('Docs Example Lead A').length).toBeGreaterThan(0)
    expect(getToken()).toBe(LOGIN_OK.accessToken)
  })

  it('sends a user who must change the password to the change page', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json(LOGIN_OK)),
      handlers.me(undefined, ME_BY_ROLE.mustChange),
    )
    const { router } = renderApp('/login')
    await fillLogin('docs-example-lead-a@echo.local', 'apa-saja')
    expect(await heading(messages.auth.changePasswordTitle)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/change-password')
  })

  it('sends a visitor without a session to login', async () => {
    const { router } = renderApp('/')
    expect(await heading(messages.auth.loginTitle)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('sends a logged-in visitor away from login', async () => {
    server.use(handlers.me())
    const { router } = renderApp('/login', { token: true })
    expect(await heading(messages.placeholder.title)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('logs out: clears the token and returns to login', async () => {
    server.use(handlers.me())
    renderApp('/', { token: true })
    await heading(messages.placeholder.title)
    const trigger = (
      await screen.findAllByRole('button', { name: new RegExp(messages.auth.accountMenu) })
    )[0]!
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('menuitem', { name: messages.auth.logout }))
    expect(await heading(messages.auth.loginTitle)).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })

  it('shows an error with retry when /me fails', async () => {
    server.use(http.get('*/api/me', () => respond(500, { statusCode: 500 })))
    renderApp('/', { token: true })
    expect(await screen.findByText(messages.auth.sessionErrorTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument()
  })
})

describe('forced password change', () => {
  it.each(['/', '/design', '/tidak-ada'])('keeps a must-change user off %s', async (path) => {
    server.use(handlers.me(undefined, ME_BY_ROLE.mustChange))
    const { router } = renderApp(path, { token: true })
    expect(await heading(messages.auth.changePasswordTitle)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/change-password')
    expect(screen.queryByRole('navigation', { name: messages.nav.label })).toBeNull()
  })

  it('sends a user with no pending change away from the change page', async () => {
    server.use(handlers.me())
    const { router } = renderApp('/change-password', { token: true })
    expect(await heading(messages.placeholder.title)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('redirects to the change page on PASSWORD_CHANGE_REQUIRED from any call', async () => {
    let me: unknown = ME_BY_ROLE.leader
    server.use(
      http.get('*/api/me', () => HttpResponse.json(me as Record<string, unknown>)),
      http.get('*/api/services', () => {
        me = ME_BY_ROLE.mustChange
        return respond(403, ERROR_BODIES.passwordChangeRequired)
      }),
    )
    const { router } = renderApp('/', { token: true })
    await heading(messages.placeholder.title)
    await expect(request('/services')).rejects.toBeInstanceOf(ApiError)
    expect(await heading(messages.auth.changePasswordTitle)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/change-password')
  })

  it('shows an inline error for a wrong current password and stays logged in', async () => {
    server.use(
      handlers.me(undefined, ME_BY_ROLE.mustChange),
      http.post('*/api/auth/change-password', () => respond(401, ERROR_BODIES.unauthorized)),
    )
    const { router } = renderApp('/change-password', { token: true })
    await userEvent.type(await screen.findByLabelText(messages.auth.currentPasswordLabel), 'salah')
    await userEvent.type(screen.getByLabelText(messages.auth.newPasswordLabel), 'kata-baru-123')
    await userEvent.type(screen.getByLabelText(messages.auth.confirmPasswordLabel), 'kata-baru-123')
    await userEvent.click(screen.getByRole('button', { name: messages.auth.changePasswordSubmit }))
    expect(await screen.findByText(messages.errors.wrongCurrentPassword)).toBeInTheDocument()
    expect(getToken()).not.toBeNull()
    expect(router.state.location.pathname).toBe('/change-password')
  })

  it('validates new password length, match and difference on the client', async () => {
    server.use(handlers.me(undefined, ME_BY_ROLE.mustChange))
    renderApp('/change-password', { token: true })
    const current = await screen.findByLabelText(messages.auth.currentPasswordLabel)
    await userEvent.type(current, 'lama-12345')
    await userEvent.type(screen.getByLabelText(messages.auth.newPasswordLabel), 'pendek')
    await userEvent.type(screen.getByLabelText(messages.auth.confirmPasswordLabel), 'beda')
    await userEvent.click(screen.getByRole('button', { name: messages.auth.changePasswordSubmit }))
    expect(await screen.findByText(messages.auth.passwordTooShort)).toBeInTheDocument()
  })

  it('maps a server 400 for the new password to an Indonesian message', async () => {
    server.use(
      handlers.me(undefined, ME_BY_ROLE.mustChange),
      http.post('*/api/auth/change-password', () =>
        respond(400, {
          message: ['newPassword must be longer than or equal to 8 characters'],
          error: 'Bad Request',
          statusCode: 400,
        }),
      ),
    )
    renderApp('/change-password', { token: true })
    await userEvent.type(await screen.findByLabelText(messages.auth.currentPasswordLabel), 'lama')
    await userEvent.type(screen.getByLabelText(messages.auth.newPasswordLabel), 'kata-baru-123')
    await userEvent.type(screen.getByLabelText(messages.auth.confirmPasswordLabel), 'kata-baru-123')
    await userEvent.click(screen.getByRole('button', { name: messages.auth.changePasswordSubmit }))
    expect(await screen.findByText(messages.errors.fields.tooShort)).toBeInTheDocument()
  })

  it('changes the password (204), reloads /me and lands home', async () => {
    let me: unknown = ME_BY_ROLE.mustChange
    let posts = 0
    server.use(
      http.get('*/api/me', () => HttpResponse.json(me as Record<string, unknown>)),
      http.post('*/api/auth/change-password', () => {
        posts += 1
        me = ME_BY_ROLE.leader
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderApp('/change-password', { token: true })
    await userEvent.type(await screen.findByLabelText(messages.auth.currentPasswordLabel), 'lama')
    await userEvent.type(screen.getByLabelText(messages.auth.newPasswordLabel), 'kata-baru-123')
    await userEvent.type(screen.getByLabelText(messages.auth.confirmPasswordLabel), 'kata-baru-123')
    await userEvent.click(screen.getByRole('button', { name: messages.auth.changePasswordSubmit }))
    expect(await heading(messages.placeholder.title)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(posts).toBe(1)
  })
})

describe('navigation per role (rendered)', () => {
  const cases: [string, keyof typeof ME_BY_ROLE][] = [
    ['MEMBER', 'member'],
    ['leader', 'leader'],
    ['PEMBINA', 'pembina'],
    ['ADMIN', 'admin'],
  ]
  it.each(cases)('%s sees the routes that exist, plus a role badge', async (_label, key) => {
    server.use(handlers.me(undefined, ME_BY_ROLE[key]))
    renderApp('/', { token: true })
    await heading(messages.placeholder.title)
    const nav = screen.getAllByRole('navigation', { name: messages.nav.label })[0]!
    const links = within(nav).getAllByRole('link')
    // Home and the two schedules exist (feature 5), services for ADMIN and PEMBINA (feature 6),
    // the assign screen for leaders (feature 7), the users page for ADMIN (feature 8), plus the dev-only design link.
    const manages = key === 'pembina' || key === 'admin'
    const leads = key === 'leader'
    const admin = key === 'admin'
    expect(links).toHaveLength(4 + (manages ? 1 : 0) + (leads ? 1 : 0) + (admin ? 1 : 0))
    expect(within(nav).queryByRole('link', { name: messages.nav.assign }) !== null).toBe(leads)
    const names = [messages.nav.home, messages.nav.mySchedule, messages.nav.fullSchedule]
    for (const name of names) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).queryByRole('link', { name: messages.nav.services }) !== null).toBe(manages)
    expect(within(nav).queryByRole('link', { name: messages.nav.users }) !== null).toBe(admin)
    const role = ME_BY_ROLE[key].role as keyof typeof messages.roles
    await waitFor(() => expect(screen.getAllByText(messages.roles[role]).length).toBeGreaterThan(0))
  })
})
