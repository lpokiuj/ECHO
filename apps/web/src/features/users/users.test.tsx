import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from '@/lib/messages'
import {
  ERROR_BODIES,
  ME_BY_ROLE,
  USERS_EXAMPLE,
  USER_ADMIN,
  USER_CREATED,
  USER_ERROR_BODIES,
  USER_PATCHED,
  handlers,
  respond,
} from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const t = messages.users
const f = t.form

// jsdom lacks the pointer-capture and scroll APIs that Radix Select calls.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => undefined
Element.prototype.releasePointerCapture ??= () => undefined
Element.prototype.scrollIntoView ??= () => undefined
// The Switch measures itself with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ME_BY_ROLE.admin has the id of USER_CREATED in the docs, so that row is "the admin itself".
const SELF = USER_CREATED
const OTHER = USER_PATCHED // inactive MEMBER
const OTHER_ACTIVE = USER_ADMIN // an active user that is not the logged-in one

beforeEach(() => {
  toast.success.mockClear()
  toast.error.mockClear()
  server.use(
    handlers.me(undefined, ME_BY_ROLE.admin),
    http.get('*/api/users', () => HttpResponse.json(USERS_EXAMPLE)),
  )
})

const user = () => userEvent.setup()
const table = () => screen.getByTestId('users-table')
const rowOf = (name: string) =>
  within(table())
    .getAllByRole('row')
    .find((r) => within(r).queryByText(name, { selector: 'p' }))!

async function openPage() {
  renderApp('/users', { token: true })
  await screen.findByRole('heading', { level: 1, name: t.title })
  await screen.findByTestId('users-table')
}

async function openEdit(name: string) {
  const u = user()
  await u.click(within(rowOf(name)).getByRole('button', { name: `${t.editAria}: ${name}` }))
  await screen.findByRole('dialog')
  return u
}

function capture<T>(sink: { body?: T; calls: number }) {
  return async ({ request }: { request: Request }) => {
    sink.calls += 1
    sink.body = (await request.json()) as T
  }
}

describe('access and list', () => {
  it('lists users as table and cards with role badges, initials and an inactive mark', async () => {
    await openPage()
    expect(screen.getByTestId('users-cards')).toBeInTheDocument()
    const row = rowOf(OTHER.name)
    expect(within(row).getByText(messages.roles.MEMBER)).toBeInTheDocument()
    expect(within(row).getByText(t.inactive)).toBeInTheDocument()
    expect(within(row).getByText('D2')).toBeInTheDocument()
    expect(
      within(rowOf(USER_ADMIN.name)).getByText(messages.roles.ADMIN, {
        selector: '[data-slot="badge"]',
      }),
    ).toBeInTheDocument()
    expect(within(rowOf(USER_ADMIN.name)).getByText(t.active)).toBeInTheDocument()
    expect(within(rowOf(SELF.name)).getByText(t.you)).toBeInTheDocument()
  })

  it.each(['pembina', 'member', 'leader'] as const)(
    '%s sees a no-access message and no data call',
    async (role) => {
      let listed = 0
      server.use(
        http.get('*/api/users', () => {
          listed += 1
          return HttpResponse.json(USERS_EXAMPLE)
        }),
        handlers.me(undefined, ME_BY_ROLE[role]),
      )
      renderApp('/users', { token: true })
      expect(await screen.findByText(t.noAccessTitle)).toBeInTheDocument()
      expect(listed).toBe(0)
    },
  )

  it('shows a clear Indonesian message when the list answers 403', async () => {
    server.use(http.get('*/api/users', () => respond(403, ERROR_BODIES.forbidden)))
    renderApp('/users', { token: true })
    expect(await screen.findByText(messages.errors.forbidden)).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })

  it('shows an empty state with a next action', async () => {
    server.use(http.get('*/api/users', () => HttpResponse.json([])))
    renderApp('/users', { token: true })
    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument()
  })
})

describe('create', () => {
  async function fillCreate(name: string, email: string) {
    const u = user()
    await u.click(screen.getByRole('button', { name: t.add }))
    await u.type(await screen.findByLabelText(f.nameLabel), name)
    await u.type(screen.getByLabelText(f.emailLabel), email)
    return u
  }

  it('sends trimmed values with the default role MEMBER and never a password', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.post('*/api/users', async (info) => {
        await capture(sink)(info)
        return respond(201, USER_CREATED)
      }),
    )
    await openPage()
    const u = await fillCreate('  Docs Example Lead A ', ' docs-example-lead-a@echo.local ')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.created))
    expect(sink.body).toEqual({
      name: 'Docs Example Lead A',
      email: 'docs-example-lead-a@echo.local',
      role: 'MEMBER',
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('enforces the form limits without calling the server', async () => {
    const sink = { calls: 0 }
    server.use(http.post('*/api/users', () => ((sink.calls += 1), respond(201, USER_CREATED))))
    await openPage()
    const u = user()
    await u.click(screen.getByRole('button', { name: t.add }))
    await u.type(await screen.findByLabelText(f.emailLabel), 'bukan-email')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(t.validation.nameRequired)).toBeInTheDocument()
    expect(screen.getByText(t.validation.emailInvalid)).toBeInTheDocument()
    expect(sink.calls).toBe(0)
  })

  it('shows a duplicate email (409) inline on the email field, dialog stays open', async () => {
    server.use(http.post('*/api/users', () => respond(409, USER_ERROR_BODIES.emailTaken)))
    await openPage()
    const u = await fillCreate('Nama', 'admin@echo.local')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    const message = await screen.findByText(t.emailTaken)
    expect(screen.getByLabelText(f.emailLabel)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(f.emailLabel)).toHaveAccessibleDescription(t.emailTaken)
    expect(message).toBeInTheDocument()
    expect(screen.queryByText('Email already in use')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('maps a server 400 validation array to field messages, never raw text', async () => {
    server.use(http.post('*/api/users', () => respond(400, USER_ERROR_BODIES.validation)))
    await openPage()
    const u = await fillCreate('Nama', 'a@b.co')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(await screen.findByText(messages.errors.fields.required)).toBeInTheDocument()
    expect(screen.getByText(messages.errors.fields.email)).toBeInTheDocument()
    expect(screen.queryByText(/should not be empty|must be an email/)).not.toBeInTheDocument()
  })

  it('shows a 403 on create as an Indonesian message in the form', async () => {
    server.use(http.post('*/api/users', () => respond(403, ERROR_BODIES.forbidden)))
    await openPage()
    const u = await fillCreate('Nama', 'a@b.co')
    await u.click(screen.getByRole('button', { name: f.submitCreate }))
    expect(
      await within(screen.getByRole('dialog')).findByText(messages.errors.forbidden),
    ).toBeInTheDocument()
  })
})

describe('edit', () => {
  it('sends only the changed fields, then refreshes the list', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch('*/api/users/:id', async (info) => {
        await capture(sink)(info)
        return respond(200, USER_PATCHED)
      }),
    )
    await openPage()
    const u = await openEdit(OTHER_ACTIVE.name)
    const name = screen.getByLabelText(f.nameLabel)
    await u.clear(name)
    await u.type(name, 'Admin Baru')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.updated))
    expect(sink.body).toEqual({ name: 'Admin Baru' })
  })

  it('sends no request when nothing changed', async () => {
    const sink = { calls: 0 }
    server.use(http.patch('*/api/users/:id', () => ((sink.calls += 1), respond(200, OTHER))))
    await openPage()
    const u = await openEdit(OTHER.name)
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    expect(await screen.findByText(f.noChanges)).toBeInTheDocument()
    expect(sink.calls).toBe(0)
  })

  it('shows a duplicate email (409) inline on edit', async () => {
    server.use(http.patch('*/api/users/:id', () => respond(409, USER_ERROR_BODIES.emailTaken)))
    await openPage()
    const u = await openEdit(OTHER.name)
    const email = screen.getByLabelText(f.emailLabel)
    await u.clear(email)
    await u.type(email, 'admin@echo.local')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    expect(await screen.findByText(t.emailTaken)).toBeInTheDocument()
  })

  it('reactivating needs no confirmation; the flag is sent', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch('*/api/users/:id', async (info) => {
        await capture(sink)(info)
        return respond(200, { ...OTHER, isActive: true })
      }),
    )
    await openPage()
    const u = await openEdit(OTHER.name)
    await u.click(screen.getByRole('switch', { name: f.activeLabel }))
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.updated))
    expect(sink.body).toEqual({ isActive: true })
  })

  it('deactivating asks first, naming the user, and sends nothing before confirming', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch('*/api/users/:id', async (info) => {
        await capture(sink)(info)
        return respond(200, { ...OTHER_ACTIVE, isActive: false })
      }),
    )
    await openPage()
    const u = await openEdit(OTHER_ACTIVE.name)
    await u.click(screen.getByRole('switch', { name: f.activeLabel }))
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText(OTHER_ACTIVE.name)).toBeInTheDocument()
    expect(within(confirm).getByText(t.confirmDeactivate.description)).toBeInTheDocument()
    expect(sink.calls).toBe(0)
    await u.click(within(confirm).getByRole('button', { name: messages.common.cancel }))
    expect(sink.calls).toBe(0)
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmDeactivate.action,
      }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.updated))
    expect(sink.body).toEqual({ isActive: false })
  })

  it('shows one Indonesian sentence for a 400 without a field on a role change', async () => {
    server.use(http.patch('*/api/users/:id', () => respond(400, USER_ERROR_BODIES.leaderPembina)))
    await openPage()
    const u = await openEdit(OTHER.name)
    await u.click(screen.getByRole('combobox', { name: f.roleLabel }))
    await u.click(await screen.findByRole('option', { name: messages.roles.PEMBINA }))
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    expect(await screen.findByText(t.roleOrActiveRejected)).toBeInTheDocument()
    expect(screen.queryByText(/team leader/)).not.toBeInTheDocument()
  })

  it('shows the same sentence if the server rejects a self change with 400', async () => {
    // A stale client may still send it; the sentence comes from the response shape only.
    server.use(http.patch('*/api/users/:id', () => respond(400, USER_ERROR_BODIES.selfChange)))
    await openPage()
    const u = await openEdit(OTHER_ACTIVE.name)
    await u.click(screen.getByRole('combobox', { name: f.roleLabel }))
    await u.click(await screen.findByRole('option', { name: messages.roles.MEMBER }))
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    expect(await screen.findByText(t.roleOrActiveRejected)).toBeInTheDocument()
    expect(screen.queryByText(/cannot change/)).not.toBeInTheDocument()
  })

  it('locks role and active on the own account with a hint, and sends only name/email', async () => {
    const sink: { body?: unknown; calls: number } = { calls: 0 }
    server.use(
      http.patch('*/api/users/:id', async (info) => {
        await capture(sink)(info)
        return respond(200, SELF)
      }),
    )
    await openPage()
    const u = await openEdit(SELF.name)
    expect(screen.getByRole('combobox', { name: f.roleLabel })).toBeDisabled()
    expect(screen.getByRole('switch', { name: f.activeLabel })).toBeDisabled()
    expect(screen.getByText(f.selfHint)).toBeInTheDocument()
    const name = screen.getByLabelText(f.nameLabel)
    await u.clear(name)
    await u.type(name, 'Nama Baru')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.updated))
    expect(sink.body).toEqual({ name: 'Nama Baru' })
  })

  it('treats 404 as already gone: toast and closed dialog', async () => {
    server.use(http.patch('*/api/users/:id', () => respond(404, USER_ERROR_BODIES.notFound)))
    await openPage()
    const u = await openEdit(OTHER.name)
    const name = screen.getByLabelText(f.nameLabel)
    await u.clear(name)
    await u.type(name, 'X')
    await u.click(screen.getByRole('button', { name: f.submitEdit }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.gone))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('delete', () => {
  const deleteButton = (name: string) =>
    within(rowOf(name)).getByRole('button', { name: `${t.deleteAria}: ${name}` })
  const confirmButton = async () =>
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: t.confirmDelete.action,
    })

  it('asks first, says it is permanent and what goes with it; cancel sends nothing', async () => {
    const sink = { calls: 0 }
    server.use(
      http.delete(
        '*/api/users/:id',
        () => ((sink.calls += 1), new Response(null, { status: 204 })),
      ),
    )
    await openPage()
    const u = user()
    await u.click(deleteButton(OTHER.name))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(OTHER.name)).toBeInTheDocument()
    expect(dialog).toHaveTextContent(t.confirmDelete.description)
    await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
    expect(sink.calls).toBe(0)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('deletes after confirming (204), removes the row and shows a toast', async () => {
    const ids: string[] = []
    server.use(
      http.delete('*/api/users/:id', ({ params }) => {
        ids.push(String(params.id))
        return new Response(null, { status: 204 })
      }),
    )
    await openPage()
    await user().click(deleteButton(OTHER.name))
    await user().click(await confirmButton())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.deleted))
    expect(ids).toEqual([OTHER.id])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('has no delete button on the own account', async () => {
    await openPage()
    expect(
      within(rowOf(SELF.name)).queryByRole('button', { name: new RegExp(`^${t.deleteAria}`) }),
    ).toBeNull()
    expect(deleteButton(OTHER.name)).toBeInTheDocument()
  })

  it.each([
    [
      '409 USER_HAS_CREATED_RECORDS',
      409,
      USER_ERROR_BODIES.hasCreatedRecords,
      messages.errors.codes.USER_HAS_CREATED_RECORDS,
    ],
    ['400 LAST_ADMIN', 400, USER_ERROR_BODIES.lastAdmin, messages.errors.codes.LAST_ADMIN],
    ['400 without a code (self)', 400, USER_ERROR_BODIES.deleteSelf, t.toast.cannotDeleteSelf],
    ['404', 404, USER_ERROR_BODIES.userNotFound, t.toast.gone],
    ['403', 403, ERROR_BODIES.forbidden, messages.errors.forbidden],
  ])('maps %s to an Indonesian toast and closes the dialog', async (_label, status, body, text) => {
    server.use(http.delete('*/api/users/:id', () => respond(status, body)))
    await openPage()
    await user().click(deleteButton(OTHER.name))
    await user().click(await confirmButton())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(text))
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('ADMIN cannot'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('shows no delete button to a non-admin session', async () => {
    server.use(handlers.me(undefined, ME_BY_ROLE.pembina))
    renderApp('/users', { token: true })
    expect(await screen.findByText(t.noAccessTitle)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(`^${t.deleteAria}`) })).toBeNull()
  })
})

describe('reset password', () => {
  const resetButton = (name: string) =>
    within(rowOf(name)).getByRole('button', { name: `${t.resetAria}: ${name}` })

  it('asks first naming the user; cancel sends nothing', async () => {
    const sink = { calls: 0 }
    server.use(
      http.post(
        '*/api/users/:id/reset-password',
        () => ((sink.calls += 1), new Response(null, { status: 204 })),
      ),
    )
    await openPage()
    const u = user()
    await u.click(resetButton(OTHER.name))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(OTHER.name)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
    expect(sink.calls).toBe(0)
  })

  it('confirming calls the endpoint (204) and shows a toast with no password', async () => {
    const sink = { calls: 0 }
    server.use(
      http.post(
        '*/api/users/:id/reset-password',
        () => ((sink.calls += 1), new Response(null, { status: 204 })),
      ),
    )
    await openPage()
    const u = user()
    await u.click(resetButton(OTHER.name))
    await u.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmReset.action,
      }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.reset))
    expect(sink.calls).toBe(1)
  })

  it('maps 404 to the already-gone message and 403 to the forbidden message', async () => {
    let status = 404
    server.use(
      http.post('*/api/users/:id/reset-password', () =>
        status === 404
          ? respond(404, USER_ERROR_BODIES.notFound)
          : respond(403, ERROR_BODIES.forbidden),
      ),
    )
    await openPage()
    const u = user()
    for (const expected of [t.toast.gone, messages.errors.forbidden]) {
      await u.click(resetButton(OTHER.name))
      await u.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: t.confirmReset.action,
        }),
      )
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expected))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      status = 403
    }
  })

  describe('pagination', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...USER_ADMIN,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Pengguna ${String(i + 1).padStart(2, '0')}`,
      email: `pengguna${i + 1}@example.com`,
    }))

    it('shows 10 users per page and moves with the pager', async () => {
      server.use(http.get('*/api/users', () => HttpResponse.json(many)))
      renderApp('/users', { token: true })
      await screen.findByTestId('users-table')
      expect(within(table()).getAllByRole('row')).toHaveLength(11) // header + 10
      const nav = screen.getByRole('navigation', { name: messages.pagination.label })
      expect(within(nav).getByText(new RegExp(messages.pagination.status(1, 3)))).toBeTruthy()
      await user().click(within(nav).getByRole('button', { name: messages.pagination.next }))
      expect(await within(table()).findByText('Pengguna 11', { selector: 'p' })).toBeTruthy()
      await user().click(within(nav).getByRole('button', { name: messages.pagination.next }))
      expect(within(table()).getAllByRole('row')).toHaveLength(6) // header + 5
      expect(within(nav).getByRole('button', { name: messages.pagination.next })).toHaveProperty(
        'disabled',
        true,
      )
    })

    it('has no pager when everything fits on one page', async () => {
      renderApp('/users', { token: true })
      await screen.findByTestId('users-table')
      expect(screen.queryByTestId('pagination')).toBeNull()
    })
  })
})
