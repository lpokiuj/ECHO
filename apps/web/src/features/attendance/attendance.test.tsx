import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fillMessage, messages } from '@/lib/messages'
import {
  ATTENDANCE_ERROR_BODIES,
  ERROR_BODIES,
  ME_BY_ROLE,
  MY_ABSENCES_EXAMPLE,
  SERVICES_EXAMPLE,
  TEAM_ABSENCES_EXAMPLE,
  handlers,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

// jsdom lacks the pointer-capture and scroll APIs that Radix Select calls.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => undefined
Element.prototype.releasePointerCapture ??= () => undefined
Element.prototype.scrollIntoView ??= () => undefined

const t = messages.attendance
const NOW = new Date('2026-11-01T06:00:00.000Z')
const STARTED = SERVICES_EXAMPLE[0]!
const UPCOMING = SERVICES_EXAMPLE[1]!
const TEAM = ME_BY_ROLE.member.memberships[0]!

const ME = ME_BY_ROLE.member
const PEER = {
  ...STARTED.assignments[0]!,
  userId: 'peer-1',
  name: 'Peer Satu',
  teamId: TEAM.teamId,
  teamName: TEAM.teamName,
}
const SELF = { ...PEER, userId: ME.id, name: 'Saya Sendiri', isAbsentTaker: true }

/** A started service where the caller is the team's absent-taker. */
const takerService = (base = STARTED) => ({ ...base, assignments: [SELF, PEER] })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  toast.success.mockClear()
  toast.error.mockClear()
})
afterEach(() => vi.useRealTimers())

function setup(options: { me?: typeof ME; services?: unknown[]; mine?: () => Response } = {}) {
  const calls: string[] = []
  server.use(
    handlers.me(undefined, options.me ?? ME),
    http.get('*/api/services', () => HttpResponse.json(options.services ?? SERVICES_EXAMPLE)),
    http.get('*/api/me/absences', () => options.mine?.() ?? HttpResponse.json(MY_ABSENCES_EXAMPLE)),
    http.get('*/api/teams/:teamId/absences', () => HttpResponse.json(TEAM_ABSENCES_EXAMPLE)),
    http.put('*/api/services/:id/teams/:teamId/absences/:userId', ({ params }) => {
      calls.push(`PUT ${String(params.userId)}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete('*/api/services/:id/teams/:teamId/absences/:userId', ({ params }) => {
      calls.push(`DELETE ${String(params.userId)}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

const open = async () => {
  renderApp('/attendance', { token: true })
  await screen.findByRole('heading', { level: 1, name: t.title })
}

describe('my absences', () => {
  it('shows the count and the services from GET /me/absences', async () => {
    setup()
    await open()
    expect(await screen.findByTestId('my-absence-count')).toHaveTextContent(
      fillMessage(t.mine.count, { count: MY_ABSENCES_EXAMPLE.count }),
    )
    expect(screen.getByRole('list', { name: t.mine.listLabel })).toHaveTextContent('Sunday Service')
  })

  it('has an empty state and an error state with retry', async () => {
    setup({ mine: () => HttpResponse.json({ count: 0, items: [] }) })
    await open()
    expect(await screen.findByText(t.mine.emptyTitle)).toBeInTheDocument()
  })

  it('maps a failure to an Indonesian message', async () => {
    setup({ mine: () => HttpResponse.json(ERROR_BODIES.forbidden, { status: 403 }) })
    await open()
    expect(await screen.findByText(t.mine.errorTitle)).toBeInTheDocument()
    expect(screen.getByText(messages.errors.forbidden)).toBeInTheDocument()
  })
})

describe('recording absences', () => {
  it('lets the taker mark and unmark a peer, but not themselves', async () => {
    const calls = setup({ services: [takerService()] })
    await open()
    const peer = await screen.findByRole('switch', {
      name: fillMessage(t.record.absentAria, { name: PEER.name }),
    })
    expect(
      screen.getByRole('switch', { name: fillMessage(t.record.absentAria, { name: SELF.name }) }),
    ).toBeDisabled()
    await userEvent.click(peer)
    await waitFor(() => expect(peer).toBeChecked())
    await userEvent.click(peer)
    await waitFor(() => expect(peer).not.toBeChecked())
    expect(calls).toEqual(['PUT peer-1', 'DELETE peer-1'])
    expect(toast.success).toHaveBeenCalledWith(fillMessage(t.record.recorded, { name: PEER.name }))
    expect(screen.getByText(t.record.recordedNote)).toBeInTheDocument()
  })

  it('shows a notice and disables the switches before the service starts', async () => {
    setup({ services: [takerService(UPCOMING)] })
    await open()
    const peer = await screen.findByRole('switch', {
      name: fillMessage(t.record.absentAria, { name: PEER.name }),
    })
    expect(screen.getByText(t.record.notStartedNotice)).toBeInTheDocument()
    expect(peer).toBeDisabled()
  })

  it('maps SERVICE_NOT_STARTED and CANNOT_MARK_SELF', async () => {
    setup({ services: [takerService()] })
    server.use(
      http.put('*/api/services/:id/teams/:teamId/absences/:userId', () =>
        HttpResponse.json(ATTENDANCE_ERROR_BODIES.serviceNotStarted, { status: 409 }),
      ),
    )
    await open()
    const peer = await screen.findByRole('switch', {
      name: fillMessage(t.record.absentAria, { name: PEER.name }),
    })
    await userEvent.click(peer)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(messages.errors.codes.SERVICE_NOT_STARTED),
    )
    expect(peer).not.toBeChecked()
    server.use(
      http.put('*/api/services/:id/teams/:teamId/absences/:userId', () =>
        HttpResponse.json(ATTENDANCE_ERROR_BODIES.cannotMarkSelf, { status: 400 }),
      ),
    )
    await userEvent.click(peer)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(messages.errors.codes.CANNOT_MARK_SELF),
    )
  })

  it('maps a 403', async () => {
    setup({ services: [takerService()] })
    server.use(
      http.put('*/api/services/:id/teams/:teamId/absences/:userId', () =>
        HttpResponse.json(ERROR_BODIES.forbidden, { status: 403 }),
      ),
    )
    await open()
    await userEvent.click(
      await screen.findByRole('switch', {
        name: fillMessage(t.record.absentAria, { name: PEER.name }),
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(messages.errors.forbidden))
  })

  it('shows an empty state to a member who is not a taker', async () => {
    setup()
    await open()
    expect(await screen.findByText(t.record.emptyTitle)).toBeInTheDocument()
    expect(screen.queryByText(t.recap.title)).toBeNull()
  })

  it('lets ADMIN pick any team and designate a taker', async () => {
    setup({ me: ME_BY_ROLE.admin as typeof ME, services: [takerService()] })
    const bodies: unknown[] = []
    server.use(
      http.get('*/api/teams', () => HttpResponse.json([{ id: TEAM.teamId, name: TEAM.teamName }])),
      http.put('*/api/services/:id/teams/:teamId/absent-taker', async ({ request }) => {
        bodies.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await open()
    await screen.findByRole('switch', {
      name: fillMessage(t.record.absentAria, { name: PEER.name }),
    })
    await userEvent.click(screen.getByRole('combobox', { name: messages.assign.taker.label }))
    await userEvent.click(await screen.findByRole('option', { name: PEER.name }))
    await userEvent.click(screen.getByRole('button', { name: messages.assign.taker.save }))
    await waitFor(() => expect(bodies).toEqual([{ userId: PEER.userId }]))
  })
})

describe('team recap', () => {
  it('shows per-member counts to a leader on the home page, as table and cards', async () => {
    setup({ me: ME_BY_ROLE.leader })
    renderApp('/', { token: true })
    const table = await screen.findByTestId('recap-table')
    expect(within(table).getByText('Amy')).toBeInTheDocument()
    expect(
      within(table).getByText(fillMessage(t.recap.countValue, { count: 1 })),
    ).toBeInTheDocument()
    expect(within(screen.getByTestId('recap-cards')).getByText('Bob')).toBeInTheDocument()
  })

  it('is no longer on the attendance page for a leader', async () => {
    setup({ me: ME_BY_ROLE.leader })
    await open()
    await screen.findByText(t.mine.title)
    expect(screen.queryByText(t.recap.title)).toBeNull()
  })

  it('is no longer on the attendance page for a leader', async () => {
    setup({ me: ME_BY_ROLE.leader })
    await open()
    await screen.findByText(t.mine.title)
    expect(screen.queryByText(t.recap.title)).toBeNull()
  })

  it('shows every team to PEMBINA on the home page', async () => {
    setup({ me: { ...ME_BY_ROLE.admin, role: 'PEMBINA' } as typeof ME })
    server.use(
      http.get('*/api/teams', () => HttpResponse.json([{ id: TEAM.teamId, name: TEAM.teamName }])),
    )
    renderApp('/', { token: true })
    expect(await screen.findByTestId('recap-table')).toBeInTheDocument()
  })

  it('is not shown to a plain member', async () => {
    setup()
    await open()
    await screen.findByText(t.mine.title)
    expect(screen.queryByText(t.recap.title)).toBeNull()
  })
})
