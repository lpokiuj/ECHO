import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { fillMessage, messages } from '@/lib/messages'
import {
  ERROR_BODIES,
  MEMBERS_EXAMPLE,
  MEMBER_INACTIVE,
  MEMBER_PUT_RESULT,
  REMOVED_EXAMPLE,
  TEAMS_EXAMPLE,
  TEAM_CREATED,
  TEAM_ERROR_BODIES,
  USERS_EXAMPLE,
  USER_ADMIN,
  USER_CREATED,
  USER_PATCHED,
  ME_BY_ROLE,
  handlers,
  respond,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'
import { PICKER_LIMIT } from './AddMemberDialog'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const t = messages.teams
const f = t.form
const d = t.detail

const TEAM = TEAM_CREATED // the documented team the detail page opens
const LEAD = MEMBERS_EXAMPLE[0]! // leader
const PLAIN = MEMBERS_EXAMPLE[1]! // plain member
const ROSTER = [...MEMBERS_EXAMPLE, MEMBER_INACTIVE]
// GET /teams has to list the detail page's team so the header shows its name.
const TEAMS_WITH_DETAIL = [TEAM, ...TEAMS_EXAMPLE]

beforeEach(() => {
  toast.success.mockClear()
  toast.error.mockClear()
  server.use(
    handlers.me(undefined, ME_BY_ROLE.admin),
    http.get('*/api/teams', () => HttpResponse.json(TEAMS_WITH_DETAIL)),
    http.get('*/api/teams/:id/members', () => HttpResponse.json(ROSTER)),
    http.get('*/api/users', () => HttpResponse.json(USERS_EXAMPLE)),
  )
})

const user = () => userEvent.setup()
const membersTable = () => screen.getByTestId('members-table')
const memberRow = (name: string) =>
  within(membersTable())
    .getAllByRole('row')
    .find((r) => within(r).queryByText(name, { selector: 'p' }))!

async function openList() {
  renderApp('/teams', { token: true })
  await screen.findByRole('heading', { level: 1, name: t.title })
  await screen.findByTestId('teams-table')
}

async function openDetail() {
  renderApp(`/teams/${TEAM.id}`, { token: true })
  await screen.findByRole('heading', { level: 1, name: TEAM.name })
  await screen.findByTestId('members-table')
}

describe('access and list', () => {
  it('lists teams as table and cards, each linking to its page', async () => {
    await openList()
    expect(screen.getByTestId('teams-cards')).toBeInTheDocument()
    const link = within(screen.getByTestId('teams-table')).getByRole('link', {
      name: `${t.openAria}: Multimedia`,
    })
    expect(link).toHaveAttribute('href', `/teams/${TEAMS_EXAMPLE[0]!.id}`)
    expect(screen.getAllByRole('button', { name: `${t.renameAria}: Music` })).not.toHaveLength(0)
  })

  it.each(['pembina', 'member', 'leader'] as const)(
    '%s sees a no-access message and no data call',
    async (role) => {
      let listed = 0
      server.use(
        http.get('*/api/teams', () => {
          listed += 1
          return HttpResponse.json(TEAMS_EXAMPLE)
        }),
        handlers.me(undefined, ME_BY_ROLE[role]),
      )
      renderApp('/teams', { token: true })
      expect(await screen.findByText(t.noAccessTitle)).toBeInTheDocument()
      expect(listed).toBe(0)
    },
  )

  it('shows a clear Indonesian message with a retry when the list answers 403', async () => {
    server.use(http.get('*/api/teams', () => respond(403, ERROR_BODIES.forbidden)))
    renderApp('/teams', { token: true })
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })

  it('shows an empty state with a next action', async () => {
    server.use(http.get('*/api/teams', () => HttpResponse.json([])))
    renderApp('/teams', { token: true })
    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: t.addTeam })).toHaveLength(2)
  })
})

describe('create and rename', () => {
  async function openCreate() {
    await openList()
    const u = user()
    await u.click(screen.getAllByRole('button', { name: t.addTeam })[0]!)
    return { u, input: await screen.findByLabelText(f.nameLabel) }
  }

  it('sends the trimmed name and closes with a toast', async () => {
    let body: unknown
    server.use(
      http.post('*/api/teams', async ({ request }) => {
        body = await request.json()
        return respond(201, TEAM_CREATED)
      }),
    )
    const { u, input } = await openCreate()
    await u.type(input, '  docs-example-team-a ')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.created))
    expect(body).toEqual({ name: 'docs-example-team-a' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('enforces 1-100 characters without calling the server', async () => {
    let calls = 0
    server.use(http.post('*/api/teams', () => ((calls += 1), respond(201, TEAM_CREATED))))
    const { u, input } = await openCreate()
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.validation.nameRequired)).toBeInTheDocument()
    await u.click(input)
    await u.paste('x'.repeat(101))
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.validation.nameTooLong)).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('shows a duplicate name (409) inline on the field, dialog stays open', async () => {
    server.use(http.post('*/api/teams', () => respond(409, TEAM_ERROR_BODIES.nameTaken)))
    const { u, input } = await openCreate()
    await u.type(input, 'Music')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.nameTaken)).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Team name already in use')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('maps a server 400 on the name to a field message, never raw text', async () => {
    server.use(http.post('*/api/teams', () => respond(400, TEAM_ERROR_BODIES.nameEmpty)))
    const { u, input } = await openCreate()
    await u.type(input, 'a')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(messages.errors.fields.required)).toBeInTheDocument()
    expect(screen.queryByText(/should not be empty/)).not.toBeInTheDocument()
  })

  it('shows a 403 on create as an Indonesian message in the form', async () => {
    server.use(http.post('*/api/teams', () => respond(403, ERROR_BODIES.forbidden)))
    const { u, input } = await openCreate()
    await u.type(input, 'Baru')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(
      await within(screen.getByRole('dialog')).findByText(messages.errors.forbidden),
    ).toBeInTheDocument()
  })

  it('renames with PATCH, refreshes schedules and GET /me, and handles a duplicate', async () => {
    const bodies: unknown[] = []
    server.use(
      http.patch('*/api/teams/:id', async ({ request }) => {
        bodies.push(await request.json())
        return bodies.length === 1
          ? respond(409, TEAM_ERROR_BODIES.nameTaken)
          : respond(200, { id: TEAMS_EXAMPLE[1]!.id, name: 'Musik' })
      }),
    )
    await openList()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const u = user()
    await u.click(
      within(screen.getByTestId('teams-table')).getByRole('button', {
        name: `${t.renameAria}: Music`,
      }),
    )
    const input = await screen.findByLabelText(f.nameLabel)
    expect(input).toHaveValue('Music')
    await u.clear(input)
    await u.type(input, 'Multimedia')
    await u.click(screen.getByRole('button', { name: f.submitRename }))
    expect(await screen.findByText(t.nameTaken)).toBeInTheDocument()
    await u.clear(input)
    await u.type(input, 'Musik')
    await u.click(screen.getByRole('button', { name: f.submitRename }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.renamed))
    expect(bodies).toEqual([{ name: 'Multimedia' }, { name: 'Musik' }])
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys).toEqual(expect.arrayContaining(['["teams"]', '["services"]', '["me"]']))
    spy.mockRestore()
  })
})

describe('team page', () => {
  it('lists members with initials, a leader badge and an inactive mark, without fetching /users', async () => {
    let usersCalls = 0
    server.use(http.get('*/api/users', () => ((usersCalls += 1), HttpResponse.json(USERS_EXAMPLE))))
    await openDetail()
    expect(screen.getByTestId('members-cards')).toBeInTheDocument()
    const lead = memberRow(LEAD.name)
    expect(within(lead).getByText(d.leaderBadge)).toBeInTheDocument()
    expect(within(lead).getByText('DA')).toBeInTheDocument()
    expect(within(memberRow(PLAIN.name)).getByText(d.volunteerBadge)).toBeInTheDocument()
    expect(within(memberRow(MEMBER_INACTIVE.name)).getByText(d.inactiveBadge)).toBeInTheDocument()
    expect(usersCalls).toBe(0)
  })

  it('shows an empty state with a next action', async () => {
    server.use(http.get('*/api/teams/:id/members', () => HttpResponse.json([])))
    renderApp(`/teams/${TEAM.id}`, { token: true })
    expect(await screen.findByText(d.emptyTitle)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: d.addMember })).toHaveLength(2)
  })

  it('shows a not-found state when the roster answers 404 (unknown team)', async () => {
    server.use(
      http.get('*/api/teams/:id/members', () => respond(404, TEAM_ERROR_BODIES.teamNotFound)),
    )
    renderApp(`/teams/${TEAM.id}`, { token: true })
    expect(await screen.findByText(d.notFoundTitle)).toBeInTheDocument()
    expect(screen.queryByText('Team not found')).not.toBeInTheDocument()
  })

  it('shows a clear message when the roster answers 403', async () => {
    server.use(http.get('*/api/teams/:id/members', () => respond(403, ERROR_BODIES.forbidden)))
    renderApp(`/teams/${TEAM.id}`, { token: true })
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
  })
})

describe('add member', () => {
  async function openAdd() {
    await openDetail()
    const u = user()
    await u.click(screen.getAllByRole('button', { name: d.addMember })[0]!)
    await screen.findByRole('dialog')
    return u
  }
  // The button's name is its visible text (name, email, badges, action); the email is unique.
  const pick = (target: { email: string }) =>
    screen.findByRole('button', { name: new RegExp(target.email) })

  it('offers only non-members, marks inactive users and filters by search', async () => {
    server.use(
      http.get('*/api/teams/:id/members', () => HttpResponse.json([PLAIN, LEAD])),
      http.get('*/api/users', () => HttpResponse.json(USERS_EXAMPLE)),
    )
    const u = await openAdd()
    // USER_CREATED is the leader, USER_ADMIN and USER_PATCHED are not in the team.
    expect(await pick(USER_ADMIN)).toBeInTheDocument()
    const inactive = await pick(USER_PATCHED)
    expect(within(inactive).getByText(d.inactiveBadge)).toBeInTheDocument()
    expect(within(inactive).getByText(messages.roles.MEMBER)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: new RegExp(USER_CREATED.email) }),
    ).not.toBeInTheDocument()
    await u.type(screen.getByLabelText(t.picker.searchLabel), 'ADMIN@')
    expect(screen.queryByRole('button', { name: new RegExp(USER_PATCHED.name) })).toBeNull()
    expect(await pick(USER_ADMIN)).toBeInTheDocument()
    await u.clear(screen.getByLabelText(t.picker.searchLabel))
    await u.type(screen.getByLabelText(t.picker.searchLabel), 'tidak-ada-yang-cocok')
    expect(await screen.findByText(t.picker.noResults)).toBeInTheDocument()
  })

  it('renders at most 50 rows of a long user list and says how many there are', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...USER_ADMIN,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Relawan ${i}`,
      email: `relawan-${i}@echo.local`,
    }))
    server.use(
      http.get('*/api/users', () => HttpResponse.json(many)),
      http.get('*/api/teams/:id/members', () => HttpResponse.json([])),
    )
    renderApp(`/teams/${TEAM.id}`, { token: true })
    const u = user()
    await u.click((await screen.findAllByRole('button', { name: d.addMember }))[0]!)
    const list = await screen.findByRole('list', { name: t.picker.listLabel })
    expect(within(list).getAllByRole('listitem')).toHaveLength(PICKER_LIMIT)
    expect(
      screen.getByText(fillMessage(t.picker.cappedHint, { shown: PICKER_LIMIT, total: 120 })),
    ).toBeInTheDocument()
  })

  it('adds a plain member with an explicit isLeader false, once even on a double click', async () => {
    const bodies: unknown[] = []
    server.use(
      http.get('*/api/teams/:id/members', () => HttpResponse.json([LEAD])),
      http.put('*/api/teams/:id/members/:userId', async ({ request }) => {
        bodies.push(await request.json())
        return respond(200, { ...MEMBER_PUT_RESULT, isLeader: false })
      }),
    )
    const u = await openAdd()
    const button = await pick(USER_ADMIN)
    await u.dblClick(button)
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        fillMessage(t.toast.memberAdded, { name: USER_ADMIN.name }),
      ),
    )
    expect(bodies).toEqual([{ isLeader: false }])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows an Indonesian error for an inactive user (400) and keeps the dialog open', async () => {
    server.use(
      http.get('*/api/teams/:id/members', () => HttpResponse.json([LEAD])),
      http.put('*/api/teams/:id/members/:userId', () =>
        respond(400, TEAM_ERROR_BODIES.inactiveUser),
      ),
    )
    const u = await openAdd()
    await u.click(await pick(USER_PATCHED))
    expect(await within(screen.getByRole('dialog')).findByText(t.errors.inactiveUser)).toBeVisible()
    expect(toast.error).toHaveBeenCalledWith(t.errors.inactiveUser)
    expect(screen.queryByText(/inactive user/)).not.toBeInTheDocument()
  })

  it('shows a 403 on add as an Indonesian message', async () => {
    server.use(
      http.get('*/api/teams/:id/members', () => HttpResponse.json([LEAD])),
      http.put('*/api/teams/:id/members/:userId', () => respond(403, ERROR_BODIES.forbidden)),
    )
    const u = await openAdd()
    await u.click(await pick(USER_ADMIN))
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
  })

  it('shows an error with a retry when the user list cannot load', async () => {
    server.use(http.get('*/api/users', () => respond(403, ERROR_BODIES.forbidden)))
    await openAdd()
    expect(await screen.findByText(t.picker.loadError)).toBeInTheDocument()
  })
})

describe('leader', () => {
  const toggle = (name: string, leader: boolean) =>
    within(memberRow(name)).getByRole('button', {
      name: `${leader ? d.unmakeLeaderAria : d.makeLeaderAria}: ${name}`,
    })

  it('sets a leader with isLeader true, then refreshes GET /me, candidates and schedules', async () => {
    const bodies: unknown[] = []
    server.use(
      http.put('*/api/teams/:id/members/:userId', async ({ request }) => {
        bodies.push(await request.json())
        return respond(200, MEMBER_PUT_RESULT)
      }),
    )
    await openDetail()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    await user().click(toggle(PLAIN.name, false))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        fillMessage(t.toast.leaderSet, { name: PLAIN.name }),
      ),
    )
    expect(bodies).toEqual([{ isLeader: true }])
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys).toEqual(
      expect.arrayContaining([
        '["me"]',
        '["candidates"]',
        '["services"]',
        '["my-schedule"]',
        `["team-members","${TEAM.id}"]`,
      ]),
    )
    spy.mockRestore()
  })

  it('unsets a leader with isLeader false', async () => {
    const bodies: unknown[] = []
    server.use(
      http.put('*/api/teams/:id/members/:userId', async ({ request }) => {
        bodies.push(await request.json())
        return respond(200, { ...MEMBER_PUT_RESULT, isLeader: false })
      }),
    )
    await openDetail()
    await user().click(toggle(LEAD.name, true))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        fillMessage(t.toast.leaderUnset, { name: LEAD.name }),
      ),
    )
    expect(bodies).toEqual([{ isLeader: false }])
  })

  it('maps the PEMBINA-as-leader 400 to one Indonesian sentence', async () => {
    server.use(
      http.put('*/api/teams/:id/members/:userId', () =>
        respond(400, TEAM_ERROR_BODIES.pembinaLeader),
      ),
    )
    await openDetail()
    await user().click(toggle(PLAIN.name, false))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.errors.pembinaLeader))
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/PEMBINA/))
  })

  it('shows a 403 on a leader change as an Indonesian toast', async () => {
    server.use(
      http.put('*/api/teams/:id/members/:userId', () => respond(403, ERROR_BODIES.forbidden)),
    )
    await openDetail()
    await user().click(toggle(PLAIN.name, false))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(messages.errors.forbidden))
  })
})

describe('remove', () => {
  const removeButton = (name: string) =>
    within(memberRow(name)).getByRole('button', { name: `${d.removeAria}: ${name}` })

  it('asks first, naming the member and team and what is deleted; Cancel sends nothing', async () => {
    let calls = 0
    server.use(
      http.delete(
        '*/api/teams/:id/members/:userId',
        () => ((calls += 1), respond(200, { removedAssignments: [] })),
      ),
    )
    await openDetail()
    const u = user()
    await u.click(removeButton(PLAIN.name))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(
      fillMessage(t.confirmRemove.title, { name: PLAIN.name, team: TEAM.name }),
    )
    expect(dialog).toHaveTextContent(
      fillMessage(t.confirmRemove.description, { name: PLAIN.name, team: TEAM.name }),
    )
    await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
    expect(calls).toBe(0)
  })

  it('deletes after confirming, reports the removed assignments and refreshes schedules', async () => {
    server.use(http.delete('*/api/teams/:id/members/:userId', () => respond(200, REMOVED_EXAMPLE)))
    await openDetail()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const u = user()
    await u.click(removeButton(PLAIN.name))
    const dialog = await screen.findByRole('alertdialog')
    await u.click(within(dialog).getByRole('button', { name: t.confirmRemove.action }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        fillMessage(t.toast.memberRemovedWithAssignments, { name: PLAIN.name, count: 2 }),
      ),
    )
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys).toEqual(expect.arrayContaining(['["services"]', '["my-schedule"]', '["me"]']))
    spy.mockRestore()
  })

  it('handles 404 (already removed) and 403 with Indonesian toasts', async () => {
    server.use(
      http.delete('*/api/teams/:id/members/:userId', ({ params }) =>
        params.userId === PLAIN.userId
          ? respond(404, TEAM_ERROR_BODIES.memberNotFound)
          : respond(403, ERROR_BODIES.forbidden),
      ),
    )
    await openDetail()
    const u = user()
    await u.click(removeButton(PLAIN.name))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmRemove.action,
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.memberGone))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await u.click(removeButton(LEAD.name))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmRemove.action,
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(messages.errors.forbidden))
  })
})
