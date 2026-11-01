import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fillMessage, messages } from '@/lib/messages'
import {
  ASSIGNMENT_NOT_FOUND,
  ASSIGN_IDEMPOTENT,
  ASSIGN_PARTIAL,
  CANDIDATES_EXAMPLE,
  ERROR_BODIES,
  INVALID_USERS_BODY,
  ME_BY_ROLE,
  SERVICES_EXAMPLE,
  handlers,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const t = messages.assign
const NOW = new Date('2026-11-01T06:00:00.000Z')
const UPCOMING = SERVICES_EXAMPLE[1]! // KEEP 1
const STARTED = SERVICES_EXAMPLE[0]! // Sunday Service, started
const TEAM_A = ME_BY_ROLE.leader.memberships[0]!
const TEAM_B = {
  teamId: 'a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb',
  teamName: 'Multimedia',
  isLeader: true,
}
const [ENJI, GIANA, LIVANA, LUKAS] = CANDIDATES_EXAMPLE

// jsdom lacks the pointer-capture and scroll APIs that Radix Select calls.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => undefined
Element.prototype.releasePointerCapture ??= () => undefined
Element.prototype.scrollIntoView ??= () => undefined

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  toast.success.mockClear()
  toast.error.mockClear()
})
afterEach(() => vi.useRealTimers())

const user = () => userEvent.setup({ advanceTimers: () => undefined })

interface Spy {
  candidateCalls: number
  assignCalls: number
  bodies: { userIds: string[]; notes?: Record<string, string> }[]
}

function setup(
  options: {
    me?: typeof ME_BY_ROLE.leader
    candidates?: () => Response
    assign?: () => Response
    unassign?: () => Response
  } = {},
): Spy {
  const spy: Spy = { candidateCalls: 0, assignCalls: 0, bodies: [] }
  server.use(
    handlers.me(undefined, options.me ?? ME_BY_ROLE.leader),
    http.get('*/api/services', () => HttpResponse.json(SERVICES_EXAMPLE)),
    http.get('*/api/services/:id/teams/:teamId/candidates', () => {
      spy.candidateCalls += 1
      return options.candidates?.() ?? HttpResponse.json(CANDIDATES_EXAMPLE)
    }),
    http.post('*/api/services/:id/teams/:teamId/assignments', async ({ request }) => {
      spy.assignCalls += 1
      spy.bodies.push((await request.json()) as Spy['bodies'][number])
      return options.assign?.() ?? HttpResponse.json(ASSIGN_IDEMPOTENT)
    }),
    http.delete(
      '*/api/services/:id/teams/:teamId/assignments/:userId',
      () => options.unassign?.() ?? new HttpResponse(null, { status: 204 }),
    ),
  )
  return spy
}

async function openPage(service = UPCOMING.id, team: string = TEAM_A.teamId) {
  renderApp(`/assign?service=${service}&team=${team}`, { token: true })
  await screen.findByRole('heading', { level: 1, name: t.title })
  await screen.findByTestId('candidates-table')
}

const table = () => within(screen.getByTestId('candidates-table'))
const pick = async (u: ReturnType<typeof user>, name: string) =>
  u.click(table().getByRole('checkbox', { name }))
const assignButton = () => screen.getByRole('button', { name: new RegExp(`^${t.assignAction}`) })

describe('candidates', () => {
  it('lists the candidates and marks who is already assigned', async () => {
    setup()
    await openPage()
    expect(table().getByText(ENJI!.name)).toBeInTheDocument()
    expect(table().getByText(t.assignedBadge)).toBeInTheDocument()
    expect(table().queryByRole('checkbox', { name: ENJI!.name })).not.toBeInTheDocument()
    for (const c of [GIANA, LIVANA, LUKAS]) {
      expect(table().getByRole('checkbox', { name: c!.name })).not.toBeChecked()
    }
    expect(screen.getByTestId('candidates-cards')).toBeInTheDocument()
  })

  it('shows an error with retry when the candidates cannot load', async () => {
    setup({ candidates: () => HttpResponse.json(ERROR_BODIES.notFound, { status: 404 }) })
    renderApp(`/assign?service=${UPCOMING.id}&team=${TEAM_A.teamId}`, { token: true })
    expect(await screen.findByText(t.loadErrorTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument()
  })

  it('shows an empty state when the team has no active members', async () => {
    setup({ candidates: () => HttpResponse.json([]) })
    renderApp(`/assign?service=${UPCOMING.id}&team=${TEAM_A.teamId}`, { token: true })
    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument()
  })
})

describe('assign', () => {
  it('sends only the selected ids, and one request on a double click', async () => {
    const spy = setup()
    await openPage()
    const u = user()
    await pick(u, GIANA!.name)
    await pick(u, LUKAS!.name)
    expect(
      screen.getByRole('button', { name: fillMessage(t.assignActionCount, { count: 2 }) }),
    ).toBeInTheDocument()
    await u.dblClick(assignButton())
    await waitFor(() => expect(spy.assignCalls).toBe(1))
    expect(spy.bodies).toEqual([{ userIds: [GIANA!.userId, LUKAS!.userId] }])
    await waitFor(() => expect(spy.candidateCalls).toBeGreaterThanOrEqual(2))
    expect(spy.assignCalls).toBe(1)
  })

  it('offers a note field only for selected candidates and sends only filled notes', async () => {
    const spy = setup()
    await openPage()
    const u = user()
    const noteLabel = (name: string) => fillMessage(t.noteLabel, { name })
    expect(screen.queryByLabelText(noteLabel(GIANA!.name))).toBeNull()
    await pick(u, GIANA!.name)
    await pick(u, LUKAS!.name)
    await u.type(table().getByLabelText(noteLabel(GIANA!.name)), 'bawa gitar')
    // A dropped selection drops its field; the empty note of Lukas is not sent.
    await pick(u, LIVANA!.name)
    await u.type(table().getByLabelText(noteLabel(LIVANA!.name)), 'tidak jadi')
    await pick(u, LIVANA!.name)
    expect(table().queryByLabelText(noteLabel(LIVANA!.name))).toBeNull()
    await u.click(assignButton())
    await waitFor(() => expect(spy.assignCalls).toBe(1))
    expect(spy.bodies).toEqual([
      { userIds: [GIANA!.userId, LUKAS!.userId], notes: { [GIANA!.userId]: 'bawa gitar' } },
    ])
  })

  it('disables the button while nothing is selected', async () => {
    setup()
    await openPage()
    expect(assignButton()).toBeDisabled()
  })

  it('partial success lists who was added and who was skipped, with the holding team', async () => {
    setup({
      assign: () =>
        HttpResponse.json({
          assigned: [LIVANA!.userId],
          skipped: [
            { ...ASSIGN_PARTIAL.skipped[0]!, userId: GIANA!.userId },
            { userId: LUKAS!.userId, reason: 'ALREADY_ASSIGNED_THIS_TEAM' },
          ],
        }),
    })
    await openPage()
    const u = user()
    for (const c of [GIANA, LIVANA, LUKAS]) await pick(u, c!.name)
    await u.click(assignButton())
    const panel = within(await screen.findByTestId('assign-result'))
    expect(panel.getByText(fillMessage(t.result.added, { count: 1 }))).toBeInTheDocument()
    expect(panel.getByText(LIVANA!.name)).toBeInTheDocument()
    expect(panel.getByText(fillMessage(t.result.skipped, { count: 2 }))).toBeInTheDocument()
    expect(
      panel.getByText(fillMessage(t.result.reasonOtherTeam, { team: 'docs-example-team-a' }), {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(panel.getByText(t.result.reasonThisTeam, { exact: false })).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(
      fillMessage(t.toast.partial, { added: 1, skipped: 2 }),
    )
  })

  it('refetches the candidates after a 200 with everything skipped', async () => {
    const spy = setup({ assign: () => HttpResponse.json(ASSIGN_IDEMPOTENT) })
    await openPage()
    const before = spy.candidateCalls
    const u = user()
    await pick(u, GIANA!.name)
    await u.click(assignButton())
    await screen.findByTestId('assign-result')
    await waitFor(() => expect(spy.candidateCalls).toBe(before + 1))
    expect(toast.error).toHaveBeenCalledWith(t.toast.noneAdded)
  })

  it.each([
    ['400 INVALID_USERS', 400, INVALID_USERS_BODY],
    ['409 SERVICE_ALREADY_STARTED', 409, ERROR_BODIES.serviceStarted],
    ['403', 403, ERROR_BODIES.forbidden],
    ['404', 404, ERROR_BODIES.notFound],
  ])('refetches the candidates after a %s response', async (_label, status, body) => {
    const spy = setup({ assign: () => HttpResponse.json(body, { status }) })
    await openPage()
    const before = spy.candidateCalls
    const u = user()
    await pick(u, GIANA!.name)
    await u.click(assignButton())
    await waitFor(() => expect(spy.candidateCalls).toBe(before + 1))
    expect(toast.error).toHaveBeenCalled()
    // Never the backend text.
    expect(JSON.stringify(toast.error.mock.calls)).not.toContain('Some users')
  })

  it('a 409 switches the page to the started state', async () => {
    setup({ assign: () => HttpResponse.json(ERROR_BODIES.serviceStarted, { status: 409 }) })
    await openPage()
    const u = user()
    await pick(u, GIANA!.name)
    await u.click(assignButton())
    expect(await screen.findByText(t.startedNotice)).toBeInTheDocument()
    await waitFor(() => expect(table().getByRole('checkbox', { name: GIANA!.name })).toBeDisabled())
  })

  it('a 403 refreshes GET /me', async () => {
    let meCalls = 0
    const spy = setup({ assign: () => HttpResponse.json(ERROR_BODIES.forbidden, { status: 403 }) })
    server.use(
      http.get('*/api/me', () => {
        meCalls += 1
        return HttpResponse.json(ME_BY_ROLE.leader)
      }),
    )
    await openPage()
    const before = meCalls
    const u = user()
    await pick(u, GIANA!.name)
    await u.click(assignButton())
    await waitFor(() => expect(meCalls).toBe(before + 1))
    expect(spy.assignCalls).toBe(1)
  })
})

describe('started service', () => {
  it('disables the controls and says why', async () => {
    setup()
    server.use(
      http.get(`*/api/services/${STARTED.id}/teams/${TEAM_A.teamId}/candidates`, () =>
        HttpResponse.json(CANDIDATES_EXAMPLE),
      ),
    )
    await openPage(STARTED.id)
    const notice = screen.getByText(t.startedNotice)
    expect(notice).toBeInTheDocument()
    expect(table().getByRole('checkbox', { name: GIANA!.name })).toBeDisabled()
    expect(table().getByRole('checkbox', { name: GIANA!.name })).toHaveAttribute(
      'aria-describedby',
      notice.closest('[role="note"]')!.id,
    )
    expect(assignButton()).toBeDisabled()
    expect(
      table().getByRole('button', { name: fillMessage(t.unassignAria, { name: ENJI!.name }) }),
    ).toBeDisabled()
  })
})

describe('teams', () => {
  it('a leader of two teams can switch teams', async () => {
    const seen: string[] = []
    setup({ me: { ...ME_BY_ROLE.leader, memberships: [TEAM_A, TEAM_B] } })
    server.use(
      http.get('*/api/services/:id/teams/:teamId/candidates', ({ params }) => {
        seen.push(String(params.teamId))
        return HttpResponse.json(CANDIDATES_EXAMPLE)
      }),
    )
    await openPage()
    const u = user()
    await u.click(screen.getByRole('combobox', { name: t.teamLabel }))
    await u.click(await screen.findByRole('option', { name: TEAM_B.teamName }))
    await waitFor(() => expect(seen).toContain(TEAM_B.teamId))
    expect(seen[0]).toBe(TEAM_A.teamId)
  })

  it('a leader of one team gets no switcher', async () => {
    setup()
    await openPage()
    expect(screen.queryByRole('combobox', { name: t.teamLabel })).not.toBeInTheDocument()
    expect(screen.getByText(TEAM_A.teamName)).toBeInTheDocument()
  })
})

describe('unassign', () => {
  const unassignButton = () =>
    table().getByRole('button', { name: fillMessage(t.unassignAria, { name: ENJI!.name }) })

  it('asks for confirmation naming the person, service and team; cancel sends nothing', async () => {
    let deletes = 0
    setup({
      unassign: () => {
        deletes += 1
        return new HttpResponse(null, { status: 204 })
      },
    })
    await openPage()
    const u = user()
    await u.click(unassignButton())
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(ENJI!.name)
    expect(dialog).toHaveTextContent(UPCOMING.title)
    expect(dialog).toHaveTextContent(TEAM_A.teamName)
    await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
    expect(deletes).toBe(0)
  })

  it('confirming sends one DELETE and refetches the candidates', async () => {
    let deletes = 0
    const spy = setup({
      unassign: () => {
        deletes += 1
        return new HttpResponse(null, { status: 204 })
      },
    })
    await openPage()
    const before = spy.candidateCalls
    const u = user()
    await u.click(unassignButton())
    const dialog = await screen.findByRole('alertdialog')
    await u.click(within(dialog).getByRole('button', { name: t.confirmUnassign.action }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.unassigned))
    expect(deletes).toBe(1)
    await waitFor(() => expect(spy.candidateCalls).toBe(before + 1))
  })

  it('a 404 says the assignment is already gone and refetches', async () => {
    const spy = setup({
      unassign: () => HttpResponse.json(ASSIGNMENT_NOT_FOUND, { status: 404 }),
    })
    await openPage()
    const before = spy.candidateCalls
    const u = user()
    await u.click(unassignButton())
    const dialog = await screen.findByRole('alertdialog')
    await u.click(within(dialog).getByRole('button', { name: t.confirmUnassign.action }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.alreadyRemoved))
    await waitFor(() => expect(spy.candidateCalls).toBe(before + 1))
  })
})

describe('access', () => {
  it.each(['member', 'pembina', 'admin'] as const)(
    '%s gets the no-access page, no data call',
    async (role) => {
      const spy = setup({ me: ME_BY_ROLE[role] })
      renderApp('/assign', { token: true })
      expect(await screen.findByText(t.noAccessTitle)).toBeInTheDocument()
      expect(spy.candidateCalls).toBe(0)
    },
  )
})
