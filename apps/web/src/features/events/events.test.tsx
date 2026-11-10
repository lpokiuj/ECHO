import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { messages } from '@/lib/messages'
import {
  ERROR_BODIES,
  EVENTS_EXAMPLE,
  EVENT_ERROR_BODIES,
  EVENT_EXAMPLE,
  EVENT_PAST_EXAMPLE,
  ME_BY_ROLE,
  handlers,
  respond,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const t = messages.events
const f = t.form
const NOW = new Date('2026-11-01T06:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  toast.success.mockClear()
  toast.error.mockClear()
  server.use(
    handlers.me(undefined, ME_BY_ROLE.admin),
    http.get('*/api/admin/events', () => HttpResponse.json(EVENTS_EXAMPLE)),
  )
})
afterEach(() => vi.useRealTimers())

const user = () => userEvent.setup({ advanceTimers: () => undefined })
const table = () => screen.getByTestId('events-table')

async function openPage(role: keyof typeof ME_BY_ROLE = 'admin') {
  server.use(handlers.me(undefined, ME_BY_ROLE[role]))
  renderApp('/events', { token: true })
  await screen.findByRole('heading', { level: 1, name: t.title })
  await screen.findByTestId('events-table')
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function fillCreate(overrides: Partial<Record<string, string>> = {}) {
  const u = user()
  await u.click(screen.getByRole('button', { name: t.add }))
  await screen.findByLabelText(f.titleLabel)
  fill(f.titleLabel, overrides.title ?? '  Malam Pujian  ')
  fill(f.date, overrides.date ?? '2026-12-06')
  fill(f.time, overrides.time ?? '19:30')
  fill(f.locationLabel, overrides.location ?? ' Aula ')
  fill(f.descriptionLabel, overrides.description ?? ' Ibadah bersama ')
  return u
}

describe('access', () => {
  it.each(['pembina', 'admin'] as const)('%s sees the page and the add button', async (role) => {
    await openPage(role)
    expect(within(table()).getByText(EVENT_EXAMPLE.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.add })).toBeInTheDocument()
  })

  it.each(['member', 'leader'] as const)(
    '%s is sent home and no events call is made',
    async (role) => {
      let listed = 0
      server.use(
        http.get('*/api/admin/events', () => {
          listed += 1
          return HttpResponse.json(EVENTS_EXAMPLE)
        }),
        handlers.me(undefined, ME_BY_ROLE[role]),
      )
      renderApp('/events', { token: true })
      expect(
        await screen.findByRole('heading', { level: 1, name: messages.placeholder.title }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: t.title })).not.toBeInTheDocument()
      expect(listed).toBe(0)
    },
  )

  it('shows a clear message when the list answers 403', async () => {
    server.use(http.get('*/api/admin/events', () => respond(403, ERROR_BODIES.forbidden)))
    renderApp('/events', { token: true })
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })
})

describe('list states', () => {
  it('shows a skeleton while loading', async () => {
    server.use(
      http.get('*/api/admin/events', async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json(EVENTS_EXAMPLE)
      }),
    )
    renderApp('/events', { token: true })
    await screen.findByRole('heading', { level: 1, name: t.title })
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it('lists events in API order with WIB date and time and a past badge', async () => {
    await openPage()
    const rows = within(table()).getAllByRole('row')
    expect(rows[1]).toHaveTextContent(EVENT_EXAMPLE.title)
    expect(rows[2]).toHaveTextContent(EVENT_PAST_EXAMPLE.title)
    expect(rows[1]).toHaveTextContent('01 Mei 2031')
    expect(rows[1]).toHaveTextContent('17.00 WIB')
    expect(rows[1]).not.toHaveTextContent(t.past)
    expect(rows[2]).toHaveTextContent(t.past)
  })

  it('shows the empty state', async () => {
    server.use(http.get('*/api/admin/events', () => HttpResponse.json([])))
    renderApp('/events', { token: true })
    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument()
    expect(screen.getByText(t.emptyDescription)).toBeInTheDocument()
  })

  it('shows an Indonesian error with retry, never the backend text', async () => {
    let fail = true
    server.use(
      http.get('*/api/admin/events', () =>
        fail
          ? respond(500, { message: 'secret backend text', statusCode: 500 })
          : HttpResponse.json(EVENTS_EXAMPLE),
      ),
    )
    renderApp('/events', { token: true })
    expect(await screen.findByText(t.loadErrorTitle)).toBeInTheDocument()
    expect(screen.getByText(messages.errors.server)).toBeInTheDocument()
    expect(screen.queryByText('secret backend text')).not.toBeInTheDocument()
    fail = false
    await user().click(screen.getByRole('button', { name: messages.common.retry }))
    expect(await screen.findByTestId('events-table')).toBeInTheDocument()
  })

  it('renders the table for wide screens and cards for narrow ones', async () => {
    await openPage()
    expect(screen.getByTestId('events-table')).toHaveClass('hidden', 'md:block')
    expect(screen.getByTestId('events-cards')).toHaveClass('md:hidden')
    expect(within(screen.getByTestId('events-cards')).getByText('Youth Night')).toBeInTheDocument()
  })
})

describe('create', () => {
  it('sends WIB input as +07:00, trimmed, then refreshes the events', async () => {
    let body: unknown
    server.use(
      http.post('*/api/admin/events', async ({ request }) => {
        body = await request.json()
        return respond(201, EVENT_EXAMPLE)
      }),
    )
    await openPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const u = await fillCreate()
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.created))
    expect(body).toEqual({
      title: 'Malam Pujian',
      startsAt: '2026-12-06T19:30:00+07:00',
      location: 'Aula',
      description: 'Ibadah bersama',
    })
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toContain('events')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('accepts a date in the past', async () => {
    let calls = 0
    server.use(http.post('*/api/admin/events', () => ((calls += 1), respond(201, EVENT_EXAMPLE))))
    await openPage()
    const u = await fillCreate({ date: '2020-01-01' })
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(calls).toBe(1))
  })

  it('enforces the limits without calling the server', async () => {
    let calls = 0
    server.use(http.post('*/api/admin/events', () => ((calls += 1), respond(201, EVENT_EXAMPLE))))
    await openPage()
    const u = await fillCreate({
      title: 'a'.repeat(121),
      location: 'b'.repeat(201),
      description: 'c'.repeat(2001),
      time: '25:00',
    })
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.validation.titleTooLong)).toBeInTheDocument()
    expect(screen.getByText(t.validation.locationTooLong)).toBeInTheDocument()
    expect(screen.getByText(t.validation.descriptionTooLong)).toBeInTheDocument()
    expect(screen.getByText(t.validation.timeFormat)).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('treats whitespace-only text and a missing date as required', async () => {
    let calls = 0
    server.use(http.post('*/api/admin/events', () => ((calls += 1), respond(201, EVENT_EXAMPLE))))
    await openPage()
    const u = user()
    await u.click(screen.getByRole('button', { name: t.add }))
    await screen.findByLabelText(f.titleLabel)
    fill(f.titleLabel, '   ')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect((await screen.findAllByText(t.validation.required)).length).toBeGreaterThanOrEqual(5)
    expect(calls).toBe(0)
  })

  it('accepts the exact maximum lengths', async () => {
    let body: { title: string; location: string; description: string } | undefined
    server.use(
      http.post('*/api/admin/events', async ({ request }) => {
        body = (await request.json()) as typeof body
        return respond(201, EVENT_EXAMPLE)
      }),
    )
    await openPage()
    const u = await fillCreate({
      title: 'a'.repeat(120),
      location: 'b'.repeat(200),
      description: 'c'.repeat(2000),
    })
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(body).toBeDefined())
    expect(body!.title).toHaveLength(120)
    expect(body!.description).toHaveLength(2000)
  })

  it('shows a server 400 on the title field in Indonesian', async () => {
    server.use(http.post('*/api/admin/events', () => respond(400, EVENT_ERROR_BODIES.titleTooLong)))
    await openPage()
    const u = await fillCreate()
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(messages.errors.fields.tooLong)).toBeInTheDocument()
    expect(screen.queryByText(/shorter than/)).not.toBeInTheDocument()
  })

  it('shows a clear message on 403', async () => {
    server.use(http.post('*/api/admin/events', () => respond(403, ERROR_BODIES.forbidden)))
    await openPage()
    const u = await fillCreate()
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(messages.errors.forbidden))
    expect(await screen.findByRole('alert')).toHaveTextContent(messages.errors.forbidden)
  })
})

describe('edit', () => {
  const editButton = (title: string) =>
    within(table()).getByRole('button', { name: `${t.editAria}: ${title}` })

  it('prefills in WIB and sends only the changed fields', async () => {
    let body: unknown
    server.use(
      http.patch(`*/api/admin/events/${EVENT_EXAMPLE.id}`, async ({ request }) => {
        body = await request.json()
        return respond(200, { ...EVENT_EXAMPLE, location: 'Aula' })
      }),
    )
    await openPage()
    const u = user()
    await u.click(editButton(EVENT_EXAMPLE.title))
    expect(await screen.findByLabelText(f.titleLabel)).toHaveValue('Youth Night')
    expect(screen.getByLabelText(f.time)).toHaveValue('17:00')
    expect(screen.getByLabelText(f.date)).toHaveValue('2031-05-01')
    fill(f.locationLabel, 'Aula')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.updated))
    expect(body).toEqual({ location: 'Aula' })
  })

  it('sends startsAt when the time changes', async () => {
    let body: unknown
    server.use(
      http.patch(`*/api/admin/events/${EVENT_EXAMPLE.id}`, async ({ request }) => {
        body = await request.json()
        return respond(200, EVENT_EXAMPLE)
      }),
    )
    await openPage()
    const u = user()
    await u.click(editButton(EVENT_EXAMPLE.title))
    await screen.findByLabelText(f.titleLabel)
    fill(f.time, '18:15')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(body).toEqual({ startsAt: '2031-05-01T18:15:00+07:00' }))
  })

  it('sends nothing when nothing changed', async () => {
    let calls = 0
    server.use(
      http.patch('*/api/admin/events/*', () => ((calls += 1), respond(200, EVENT_EXAMPLE))),
    )
    await openPage()
    const u = user()
    await u.click(editButton(EVENT_EXAMPLE.title))
    await screen.findByLabelText(f.titleLabel)
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    expect(await screen.findByText(f.noChanges)).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('handles a 404 by telling the user and closing the dialog', async () => {
    server.use(http.patch('*/api/admin/events/*', () => respond(404, EVENT_ERROR_BODIES.notFound)))
    await openPage()
    const u = user()
    await u.click(editButton(EVENT_EXAMPLE.title))
    await screen.findByLabelText(f.titleLabel)
    fill(f.titleLabel, 'Baru')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.gone))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('delete', () => {
  const deleteButton = (title: string) =>
    within(table()).getByRole('button', { name: `${t.deleteAria}: ${title}` })

  it('asks first with the permanent wording; cancel sends nothing', async () => {
    let calls = 0
    server.use(
      http.delete(
        '*/api/admin/events/*',
        () => ((calls += 1), new HttpResponse(null, { status: 204 })),
      ),
    )
    await openPage()
    const u = user()
    await u.click(deleteButton(EVENT_EXAMPLE.title))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(t.confirmDelete.title)).toBeInTheDocument()
    expect(within(dialog).getByText(EVENT_EXAMPLE.title)).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Hapus permanen? Data tidak bisa dikembalikan.')
    await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls).toBe(0)
  })

  it('deletes after confirmation, toasts and refreshes', async () => {
    let calls = 0
    server.use(
      http.delete(
        `*/api/admin/events/${EVENT_EXAMPLE.id}`,
        () => ((calls += 1), new HttpResponse(null, { status: 204 })),
      ),
    )
    await openPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const u = user()
    await u.click(deleteButton(EVENT_EXAMPLE.title))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmDelete.action,
      }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.deleted))
    expect(calls).toBe(1)
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toContain('events')
  })

  it.each([
    [403, ERROR_BODIES.forbidden, messages.errors.forbidden],
    [404, EVENT_ERROR_BODIES.notFound, messages.errors.notFound],
  ])('maps a %s on delete to an Indonesian toast and refreshes', async (status, body, text) => {
    server.use(http.delete('*/api/admin/events/*', () => respond(status, body)))
    await openPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const u = user()
    await u.click(deleteButton(EVENT_EXAMPLE.title))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmDelete.action,
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(text))
    expect(invalidate).toHaveBeenCalled()
  })
})
