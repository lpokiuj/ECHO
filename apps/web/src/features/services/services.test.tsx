import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { messages } from '@/lib/messages'
import {
  ERROR_BODIES,
  ME_BY_ROLE,
  SERVICES_EXAMPLE,
  SERVICE_CREATED,
  SERVICE_ERROR_BODIES,
  SERVICE_PATCHED,
  handlers,
  respond,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const t = messages.services
const f = t.form
// "Now" is after the first example service started (and ended) and before the second.
const NOW = new Date('2026-11-01T06:00:00.000Z')
const UPCOMING = SERVICES_EXAMPLE[1]! // KEEP 1, 2026-11-20 22:26 WIB
const STARTED = SERVICES_EXAMPLE[0]! // Sunday Service, started and ended

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  toast.success.mockClear()
  toast.error.mockClear()
  server.use(
    handlers.me(undefined, ME_BY_ROLE.admin),
    http.get('*/api/services', () => HttpResponse.json(SERVICES_EXAMPLE)),
  )
})
afterEach(() => vi.useRealTimers())

const user = () => userEvent.setup({ advanceTimers: () => undefined })

async function openPage(role: keyof typeof ME_BY_ROLE = 'admin') {
  server.use(handlers.me(undefined, ME_BY_ROLE[role]))
  renderApp('/services', { token: true })
  await screen.findByRole('heading', { level: 1, name: t.title })
  await screen.findByTestId('services-table')
}

const table = () => screen.getByTestId('services-table')

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function fillCreate(title: string, start: [string, string], end: [string, string]) {
  const u = user()
  await u.click(screen.getByRole('button', { name: t.add }))
  await u.type(await screen.findByLabelText(f.titleLabel), title)
  fill(f.startDate, start[0])
  fill(f.startTime, start[1])
  fill(f.endDate, end[0])
  fill(f.endTime, end[1])
  return u
}

/** Captures the JSON body of the next request to a handler. */
function capture<T>(sink: { body?: T; calls: number }) {
  return async ({ request }: { request: Request }) => {
    sink.calls += 1
    sink.body = (await request.json()) as T
  }
}

describe('access', () => {
  it.each(['pembina', 'admin'] as const)('%s sees the management screen', async (role) => {
    await openPage(role)
    expect(within(table()).getByText('KEEP 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.add })).toBeInTheDocument()
  })

  it.each(['member', 'leader'] as const)(
    '%s sees a clear no-access message, no data call',
    async (role) => {
      let listed = 0
      server.use(
        http.get('*/api/services', () => {
          listed += 1
          return HttpResponse.json(SERVICES_EXAMPLE)
        }),
      )
      server.use(handlers.me(undefined, ME_BY_ROLE[role]))
      renderApp('/services', { token: true })
      expect(await screen.findByText(t.noAccessTitle)).toBeInTheDocument()
      expect(listed).toBe(0)
    },
  )

  it('shows a clear message when the list itself answers 403', async () => {
    server.use(http.get('*/api/services', () => respond(403, ERROR_BODIES.forbidden)))
    renderApp('/services', { token: true })
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })
})

describe('create', () => {
  it('sends WIB input as ISO with +07:00, then refreshes both schedules', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.post('*/api/services', async (info) => {
        await capture(sink)(info)
        return respond(201, SERVICE_CREATED)
      }),
    )
    await openPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const u = await fillCreate(
      '  docs-example Service 1  ',
      ['2026-12-06', '09:00'],
      ['2026-12-06', '11:00'],
    )
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.created))
    expect(sink.body).toEqual({
      title: 'docs-example Service 1',
      startsAt: '2026-12-06T09:00:00+07:00',
      endsAt: '2026-12-06T11:00:00+07:00',
    })
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toEqual(expect.arrayContaining(['services', 'my-schedule']))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('enforces the form limits without calling the server', async () => {
    const sink: { calls: number } = { calls: 0 }
    server.use(
      http.post('*/api/services', () => ((sink.calls += 1), respond(201, SERVICE_CREATED))),
    )
    await openPage()
    // Title of 151 characters, end equal to start.
    const u = await fillCreate('a'.repeat(151), ['2026-12-06', '09:00'], ['2026-12-06', '09:00'])
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.validation.titleTooLong)).toBeInTheDocument()
    expect(screen.getByText(t.validation.endAfterStart)).toBeInTheDocument()
    // A start in the past is refused, an empty title too.
    fill(f.startDate, '2026-10-01')
    fill(f.endDate, '2026-12-06')
    await u.clear(screen.getByLabelText(f.titleLabel))
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.validation.startFuture)).toBeInTheDocument()
    expect(screen.getByText(t.validation.required)).toBeInTheDocument()
    expect(sink.calls).toBe(0)
  })

  it('refuses a time that is not a 24-hour HH:mm without calling the server', async () => {
    const sink: { calls: number } = { calls: 0 }
    server.use(
      http.post('*/api/services', () => ((sink.calls += 1), respond(201, SERVICE_CREATED))),
    )
    await openPage()
    const u = await fillCreate('Ibadah', ['2026-12-06', '9:00 PM'], ['2026-12-06', '25:00'])
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findAllByText(t.validation.timeFormat)).toHaveLength(2)
    expect(sink.calls).toBe(0)
  })

  it('shows the chosen date as DD Month YYYY, not the browser format', async () => {
    await openPage()
    await fillCreate('Ibadah', ['2026-11-08', '09:00'], ['2026-11-08', '11:00'])
    expect(screen.getAllByRole('button', { name: /08 November 2026/ })).toHaveLength(2)
  })

  it('accepts exactly 150 characters', async () => {
    const sink: { body?: { title: string }; calls: number } = { calls: 0 }
    server.use(
      http.post('*/api/services', async (info) => {
        await capture(sink)(info)
        return respond(201, SERVICE_CREATED)
      }),
    )
    await openPage()
    const u = await fillCreate('a'.repeat(150), ['2026-12-06', '09:00'], ['2026-12-06', '11:00'])
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(sink.calls).toBe(1))
    expect(sink.body?.title).toHaveLength(150)
  })

  const serverCases: [string, number, unknown, string, 'field' | 'form'][] = [
    [
      'title too long',
      400,
      SERVICE_ERROR_BODIES.titleTooLong,
      messages.errors.fields.tooLong,
      'field',
    ],
    ['no offset', 400, SERVICE_ERROR_BODIES.noOffset, messages.errors.fields.invalidDate, 'field'],
    [
      'end not after start',
      400,
      SERVICE_ERROR_BODIES.endBeforeStart,
      messages.errors.fields.endBeforeStart,
      'field',
    ],
    [
      'start not in the future',
      400,
      SERVICE_ERROR_BODIES.startNotFuture,
      messages.errors.fields.startNotFuture,
      'field',
    ],
    ['forbidden', 403, ERROR_BODIES.forbidden, messages.errors.forbidden, 'form'],
    [
      'server error',
      500,
      { message: 'Internal server error', statusCode: 500 },
      messages.errors.server,
      'form',
    ],
  ]
  it.each(serverCases)(
    'maps a server %s to Indonesian text, never the raw message',
    async (_n, status, body, text) => {
      server.use(http.post('*/api/services', () => respond(status, body)))
      await openPage()
      const u = await fillCreate('e2e-x', ['2026-12-06', '09:00'], ['2026-12-06', '11:00'])
      await u.click(screen.getByRole('button', { name: f.submitCreate }))
      expect(await within(screen.getByRole('dialog')).findByText(text)).toBeInTheDocument()
      expect(toast.error).toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      const raw = (body as { message: string | string[] }).message
      for (const m of Array.isArray(raw) ? raw : [raw])
        expect(screen.queryByText(m)).not.toBeInTheDocument()
    },
  )
})

describe('edit', () => {
  async function openEdit(title: string) {
    const u = user()
    await u.click(within(table()).getByRole('button', { name: `${t.editAria}: ${title}` }))
    await screen.findByRole('dialog')
    return u
  }

  it('prefills in WIB and sends only the changed field', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch(`*/api/services/${UPCOMING.id}`, async (info) => {
        await capture(sink)(info)
        return respond(200, SERVICE_PATCHED)
      }),
    )
    await openPage()
    const u = await openEdit(UPCOMING.title)
    expect(screen.getByLabelText(f.startDate)).toHaveValue('2026-11-20')
    expect(screen.getByLabelText(f.startTime)).toHaveValue('22:26')
    await u.clear(screen.getByLabelText(f.titleLabel))
    await u.type(screen.getByLabelText(f.titleLabel), 'Renamed')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.updated))
    expect(sink.body).toEqual({ title: 'Renamed' })
  })

  it('sends both times when the start moves, and nothing when nothing changed', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch(`*/api/services/${UPCOMING.id}`, async (info) => {
        await capture(sink)(info)
        return respond(200, SERVICE_PATCHED)
      }),
    )
    await openPage()
    const u = await openEdit(UPCOMING.title)
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    expect(await screen.findByText(f.noChanges)).toBeInTheDocument()
    expect(sink.calls).toBe(0)
    fill(f.startTime, '21:00')
    fill(f.endDate, '2026-11-21')
    fill(f.endTime, '01:00')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(sink.calls).toBe(1))
    expect(sink.body).toEqual({
      startsAt: '2026-11-20T21:00:00+07:00',
      endsAt: '2026-11-21T01:00:00+07:00',
    })
  })

  it('locks the start of a started service, never re-sends it, still edits the end', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch(`*/api/services/${STARTED.id}`, async (info) => {
        await capture(sink)(info)
        return respond(200, SERVICE_PATCHED)
      }),
    )
    await openPage()
    await screen.findByRole('switch') // list already rendered
    const u = user()
    await u.click(screen.getByRole('switch', { name: messages.schedule.includePast }))
    await u.click(
      await within(table()).findByRole('button', { name: `${t.editAria}: ${STARTED.title}` }),
    )
    await screen.findByRole('dialog')
    expect(screen.getByLabelText(f.startDate)).toBeDisabled()
    expect(screen.getByLabelText(f.startTime)).toBeDisabled()
    expect(screen.getByText(f.startLocked)).toBeInTheDocument()
    fill(f.endTime, '14:00')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(sink.calls).toBe(1))
    expect(sink.body).toEqual({ endsAt: '2026-11-01T14:00:00+07:00' })
  })

  it('handles a 404 by telling the user and closing the dialog', async () => {
    server.use(
      http.patch(`*/api/services/${UPCOMING.id}`, () => respond(404, ERROR_BODIES.notFound)),
    )
    await openPage()
    const u = await openEdit(UPCOMING.title)
    await u.type(screen.getByLabelText(f.titleLabel), 'x')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.gone))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows a server 400 on the end field', async () => {
    server.use(
      http.patch(`*/api/services/${UPCOMING.id}`, () =>
        respond(400, SERVICE_ERROR_BODIES.endBeforeStart),
      ),
    )
    await openPage()
    const u = await openEdit(UPCOMING.title)
    fill(f.endTime, '23:00')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    const message = await screen.findByText(messages.errors.fields.endBeforeStart)
    expect(message).toHaveAttribute('id', 'service-end-date-error')
  })
})

describe('delete', () => {
  const deleteButton = (title: string) =>
    within(table()).getByRole('button', { name: `${t.deleteAria}: ${title}` })

  it('asks first; cancel sends nothing', async () => {
    let calls = 0
    server.use(
      http.delete(
        '*/api/services/*',
        () => ((calls += 1), new HttpResponse(null, { status: 204 })),
      ),
    )
    await openPage()
    const u = user()
    await u.click(deleteButton(UPCOMING.title))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(t.confirmDelete.title)).toBeInTheDocument()
    expect(within(dialog).getByText(UPCOMING.title)).toBeInTheDocument()
    expect(dialog).toHaveTextContent(t.confirmDelete.description)
    await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls).toBe(0)
  })

  it('deletes after confirmation, toasts and refreshes both schedules', async () => {
    let calls = 0
    server.use(
      http.delete(
        `*/api/services/${UPCOMING.id}`,
        () => ((calls += 1), new HttpResponse(null, { status: 204 })),
      ),
    )
    await openPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const u = user()
    await u.click(deleteButton(UPCOMING.title))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmDelete.action,
      }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.deleted))
    expect(calls).toBe(1)
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toEqual(expect.arrayContaining(['services', 'my-schedule']))
  })

  it.each([
    [403, ERROR_BODIES.forbidden, messages.errors.forbidden],
    [404, ERROR_BODIES.notFound, messages.errors.notFound],
  ])('maps a %s on delete to an Indonesian toast', async (status, body, text) => {
    server.use(http.delete('*/api/services/*', () => respond(status, body)))
    await openPage()
    const u = user()
    await u.click(deleteButton(UPCOMING.title))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmDelete.action,
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(text))
  })
})

describe('layout', () => {
  it('renders the table for wide screens and cards for narrow ones', async () => {
    await openPage()
    expect(screen.getByTestId('services-table')).toHaveClass('hidden', 'md:block')
    expect(screen.getByTestId('services-cards')).toHaveClass('md:hidden')
    expect(within(screen.getByTestId('services-cards')).getByText('KEEP 1')).toBeInTheDocument()
  })
})
