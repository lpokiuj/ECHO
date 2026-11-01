import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fillMessage, messages } from '@/lib/messages'
import {
  ERROR_BODIES,
  INCLUDE_PAST_BAD,
  ME_BY_ROLE,
  MY_SCHEDULE_EXAMPLE,
  SERVICES_EXAMPLE,
  handlers,
  respond,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const t = messages.schedule
// "Now" is after the first example service (ends 2026-11-01T05:00Z) and before the second.
const NOW = new Date('2026-11-01T06:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  server.use(handlers.me(undefined, ME_BY_ROLE.member))
})
afterEach(() => vi.useRealTimers())

/** Serves only not-ended items by default and everything with includePast=true. */
function servicesByWindow(seen: string[]) {
  return http.get('*/api/services', ({ request }) => {
    const includePast = new URL(request.url).searchParams.get('includePast')
    seen.push(includePast ?? 'absent')
    return HttpResponse.json(includePast === 'true' ? SERVICES_EXAMPLE : SERVICES_EXAMPLE.slice(1))
  })
}

const table = () => screen.getByTestId('schedule-table')
const cards = () => screen.getByTestId('schedule-cards')

describe('Full schedule', () => {
  it('lists each service with every team and its people, in WIB', async () => {
    server.use(http.get('*/api/services', () => HttpResponse.json(SERVICES_EXAMPLE)))
    renderApp('/schedule', { token: true })
    expect(await screen.findByRole('heading', { level: 1, name: t.fullTitle })).toBeInTheDocument()
    await screen.findByTestId('schedule-table')
    const row = within(table()).getByRole('row', { name: /KEEP 1/ })
    expect(within(row).getByText('20 November 2026')).toBeInTheDocument()
    // 15:26Z is 22:26 WIB.
    expect(within(row).getByText('22.26 - 00.50 WIB')).toBeInTheDocument()
    // People are not in the row; the detail button opens them grouped by team.
    expect(within(row).queryByText(/Agner/)).toBeNull()
    await userEvent.click(within(row).getByRole('button', { name: new RegExp(t.detail) }))
    const dialog = await screen.findByRole('dialog', { name: 'KEEP 1' })
    const sound = within(dialog).getByRole('region', { name: 'Sound' })
    expect(within(sound).getByText('Agner')).toBeInTheDocument()
    const worship = within(dialog).getByRole('region', { name: 'Worship' })
    expect(within(worship).getByText('Giana')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    // The same button is rendered in the cards for narrow screens.
    expect(within(cards()).getAllByRole('button', { name: new RegExp(t.detail) })).not.toHaveLength(
      0,
    )
  })

  it('says when nobody is assigned', async () => {
    const empty = [{ ...SERVICES_EXAMPLE[0]!, assignments: [] }]
    server.use(http.get('*/api/services', () => HttpResponse.json(empty)))
    renderApp('/schedule', { token: true })
    await screen.findByTestId('schedule-table')
    await userEvent.click(within(table()).getByRole('button', { name: new RegExp(t.detail) }))
    expect(await screen.findByText(t.noAssignees)).toBeInTheDocument()
  })

  it('hides ended services by default and shows them with the toggle', async () => {
    const seen: string[] = []
    server.use(servicesByWindow(seen))
    renderApp('/schedule', { token: true })
    await screen.findByTestId('schedule-table')
    expect(within(table()).queryByText('Sunday Service')).toBeNull()
    expect(seen).toEqual(['absent'])

    await userEvent.click(screen.getByRole('switch', { name: t.includePast }))
    expect(await within(table()).findByText('Sunday Service')).toBeInTheDocument()
    expect(seen).toContain('true')
    // The ended one is marked; the upcoming one is not.
    const ended = within(table()).getByRole('row', { name: /Sunday Service/ })
    expect(within(ended).getByText(t.ended)).toBeInTheDocument()
    const upcoming = within(table()).getByRole('row', { name: /KEEP 1/ })
    expect(within(upcoming).queryByText(t.ended)).toBeNull()

    await userEvent.click(screen.getByRole('switch', { name: t.includePast }))
    await waitFor(() => expect(within(table()).queryByText('Sunday Service')).toBeNull())
  })

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get('*/api/services', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(SERVICES_EXAMPLE)
      }),
    )
    const { container } = renderApp('/schedule', { token: true })
    await screen.findByRole('heading', { level: 1, name: t.fullTitle })
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(screen.queryByTestId('schedule-table')).toBeNull()
    await screen.findByTestId('schedule-table')
  })

  it('shows an Indonesian error with retry, never the backend text', async () => {
    let calls = 0
    server.use(
      http.get('*/api/services', () => {
        calls += 1
        return calls === 1 ? respond(400, INCLUDE_PAST_BAD) : HttpResponse.json(SERVICES_EXAMPLE)
      }),
    )
    renderApp('/schedule', { token: true })
    expect(await screen.findByText(t.loadErrorTitle)).toBeInTheDocument()
    expect(screen.queryByText(/includePast/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: messages.common.retry }))
    expect(await screen.findByTestId('schedule-table')).toBeInTheDocument()
  })

  it('shows a clear message for 403', async () => {
    server.use(http.get('*/api/services', () => respond(403, ERROR_BODIES.forbidden)))
    renderApp('/schedule', { token: true })
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
  })

  it('shows the empty state, whose action turns on the toggle', async () => {
    const seen: string[] = []
    server.use(
      http.get('*/api/services', ({ request }) => {
        const past = new URL(request.url).searchParams.get('includePast')
        seen.push(past ?? 'absent')
        return HttpResponse.json(past === 'true' ? SERVICES_EXAMPLE : [])
      }),
    )
    renderApp('/schedule', { token: true })
    expect(await screen.findByText(t.emptyFullTitle)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t.emptyShowPast }))
    expect(await screen.findByTestId('schedule-table')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: t.includePast })).toBeChecked()
    expect(seen).toEqual(['absent', 'true'])
  })
})

describe('My schedule', () => {
  it('lists the caller own assignments using serviceId and the team', async () => {
    server.use(http.get('*/api/me/schedule', () => HttpResponse.json(MY_SCHEDULE_EXAMPLE)))
    renderApp('/my-schedule', { token: true })
    expect(await screen.findByRole('heading', { level: 1, name: t.myTitle })).toBeInTheDocument()
    const row = within(await screen.findByTestId('schedule-table')).getByRole('row', {
      name: /KEEP 1/,
    })
    expect(within(row).getByText('Sound')).toBeInTheDocument()
    expect(within(row).getByText('20 November 2026')).toBeInTheDocument()
  })

  it('sends includePast=true only when the toggle is on', async () => {
    const seen: string[] = []
    server.use(
      http.get('*/api/me/schedule', ({ request }) => {
        const past = new URL(request.url).searchParams.get('includePast')
        seen.push(past ?? 'absent')
        return HttpResponse.json(MY_SCHEDULE_EXAMPLE)
      }),
    )
    renderApp('/my-schedule', { token: true })
    await screen.findByTestId('schedule-table')
    await userEvent.click(screen.getByRole('switch', { name: t.includePast }))
    await waitFor(() => expect(seen).toEqual(['absent', 'true']))
  })

  it('shows the empty state for a user with no assignment', async () => {
    server.use(http.get('*/api/me/schedule', () => HttpResponse.json([])))
    renderApp('/my-schedule', { token: true })
    expect(await screen.findByText(t.emptyMineTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.emptyShowPast })).toBeInTheDocument()
  })

  it('shows an error with retry', async () => {
    let calls = 0
    server.use(
      http.get('*/api/me/schedule', () => {
        calls += 1
        return calls === 1
          ? respond(500, { message: 'boom', statusCode: 500 })
          : HttpResponse.json(MY_SCHEDULE_EXAMPLE)
      }),
    )
    renderApp('/my-schedule', { token: true })
    expect(await screen.findByText(messages.errors.server)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: messages.common.retry }))
    expect(await screen.findByTestId('schedule-table')).toBeInTheDocument()
  })
})

describe('Assignment notes', () => {
  const WORSHIP = '681e9003-157a-4f26-9b69-a39af059d88b'
  const SOUND = '77256f56-93fc-46e9-b360-ca69f8b3263a'
  const withNotes = SERVICES_EXAMPLE.map((s) => ({
    ...s,
    assignments: s.assignments.map((a) => (a.name === 'Giana' ? { ...a, notes: 'bawa gitar' } : a)),
  }))
  const leaderOf = (teamId: string, teamName: string) => ({
    ...ME_BY_ROLE.leader,
    memberships: [{ teamId, teamName, isLeader: true }],
  })

  async function openDetail(title: string) {
    renderApp('/schedule', { token: true })
    await screen.findByTestId('schedule-table')
    const row = within(table()).getByRole('row', { name: new RegExp(title) })
    await userEvent.click(within(row).getByRole('button', { name: new RegExp(t.detail) }))
    return screen.findByRole('dialog', { name: title })
  }

  const editButton = (dialog: HTMLElement) =>
    within(dialog).queryByRole('button', { name: fillMessage(t.editNoteAria, { name: 'Giana' }) })

  it('shows notes to a plain member, without an edit button', async () => {
    server.use(http.get('*/api/services', () => HttpResponse.json(withNotes)))
    const dialog = await openDetail('KEEP 1')
    expect(within(dialog).getByText('bawa gitar')).toBeInTheDocument()
    expect(editButton(dialog)).toBeNull()
  })

  it('does not offer editing to the leader of another team', async () => {
    server.use(
      http.get('*/api/services', () => HttpResponse.json(withNotes)),
      handlers.me(undefined, leaderOf(SOUND, 'Sound')),
    )
    expect(editButton(await openDetail('KEEP 1'))).toBeNull()
  })

  it('lets the leader of that team edit the note and sends a PATCH', async () => {
    const bodies: unknown[] = []
    server.use(
      http.get('*/api/services', () => HttpResponse.json(withNotes)),
      handlers.me(undefined, leaderOf(WORSHIP, 'Worship')),
      http.patch(
        '*/api/services/:id/teams/:teamId/assignments/:userId',
        async ({ request, params }) => {
          const body = (await request.json()) as { notes: string }
          bodies.push({ teamId: params.teamId, userId: params.userId, ...body })
          return HttpResponse.json({
            serviceId: params.id,
            userId: params.userId,
            teamId: params.teamId,
            notes: body.notes,
          })
        },
      ),
    )
    const dialog = await openDetail('KEEP 1')
    // Sound is another team: no button on Agner.
    expect(
      within(dialog).queryByRole('button', {
        name: fillMessage(t.editNoteAria, { name: 'Agner' }),
      }),
    ).toBeNull()
    await userEvent.click(await waitForButton(dialog))
    const field = within(dialog).getByLabelText(fillMessage(t.noteFieldLabel, { name: 'Giana' }))
    await userEvent.clear(field)
    await userEvent.type(field, 'bawa bass')
    await userEvent.click(within(dialog).getByRole('button', { name: t.noteSave }))
    await waitFor(() =>
      expect(bodies).toEqual([
        { teamId: WORSHIP, userId: 'db93ae8c-9da7-4be1-bcc8-2c72c12033da', notes: 'bawa bass' },
      ]),
    )
  })

  it('hides the edit button once the service has started', async () => {
    server.use(
      http.get('*/api/services', () => HttpResponse.json(withNotes)),
      handlers.me(undefined, leaderOf(WORSHIP, 'Worship')),
    )
    vi.setSystemTime(new Date('2026-11-21T00:00:00.000Z'))
    renderApp('/schedule?', { token: true })
    await userEvent.click(await screen.findByRole('switch', { name: t.includePast }))
    const row = await within(table()).findByRole('row', { name: /KEEP 1/ })
    await userEvent.click(within(row).getByRole('button', { name: new RegExp(t.detail) }))
    const dialog = await screen.findByRole('dialog', { name: 'KEEP 1' })
    expect(within(dialog).getByText('bawa gitar')).toBeInTheDocument()
    expect(editButton(dialog)).toBeNull()
  })

  it('maps a 409 to Indonesian and keeps the editor open', async () => {
    server.use(
      http.get('*/api/services', () => HttpResponse.json(withNotes)),
      handlers.me(undefined, leaderOf(WORSHIP, 'Worship')),
      http.patch('*/api/services/:id/teams/:teamId/assignments/:userId', () =>
        respond(409, ERROR_BODIES.serviceStarted),
      ),
    )
    const dialog = await openDetail('KEEP 1')
    await userEvent.click(await waitForButton(dialog))
    await userEvent.click(within(dialog).getByRole('button', { name: t.noteSave }))
    expect(
      await within(dialog).findByLabelText(fillMessage(t.noteFieldLabel, { name: 'Giana' })),
    ).toBeInTheDocument()
  })

  it('shows the own note on Jadwal Saya', async () => {
    server.use(
      http.get('*/api/me/schedule', () =>
        HttpResponse.json([{ ...MY_SCHEDULE_EXAMPLE[0]!, notes: 'datang jam 6' }]),
      ),
    )
    renderApp('/my-schedule', { token: true })
    await screen.findByTestId('schedule-table')
    expect(within(table()).getByText(/datang jam 6/)).toBeInTheDocument()
  })
})

async function waitForButton(dialog: HTMLElement) {
  return within(dialog).findByRole('button', {
    name: fillMessage(messages.schedule.editNoteAria, { name: 'Giana' }),
  })
}
