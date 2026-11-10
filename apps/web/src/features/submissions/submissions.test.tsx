import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fillMessage, messages } from '@/lib/messages'
import {
  ME_BY_ROLE,
  PRAYER_REQUEST_EXAMPLE,
  SUBMISSION_COUNTS_EXAMPLE,
  SUBMISSION_ERROR_BODIES,
  VOLUNTEER_APPLICATION_EXAMPLE,
  handlers,
  respond,
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

const t = messages.submissions
const P = PRAYER_REQUEST_EXAMPLE
const V = VOLUNTEER_APPLICATION_EXAMPLE
const prayerDetail = `/prayer-requests/${P.id}`
const volunteerDetail = `/volunteer-applications/${V.id}`

beforeEach(() => {
  toast.success.mockClear()
  toast.error.mockClear()
  server.use(
    handlers.me(undefined, ME_BY_ROLE.pembina),
    http.get('*/api/admin/prayer-requests', () => HttpResponse.json([])),
  )
})

const user = () => userEvent.setup()
const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

/** A counter around a handler, to count refetches. */
function counted<T>(body: () => T) {
  const sink = { calls: 0, urls: [] as string[] }
  return {
    sink,
    run: ({ request }: { request: Request }) => {
      sink.calls += 1
      sink.urls.push(request.url)
      return HttpResponse.json(body() as Record<string, unknown>)
    },
  }
}

describe('route guard and nav', () => {
  it('redirects a MEMBER and a leader home and never loads the lists', async () => {
    for (const me of [ME_BY_ROLE.member, ME_BY_ROLE.leader]) {
      const lists = counted(() => [P])
      server.use(
        handlers.me(undefined, me),
        http.get('*/api/admin/prayer-requests', lists.run),
        http.get('*/api/admin/volunteer-applications', lists.run),
      )
      for (const path of ['/prayer-requests', '/volunteer-applications', prayerDetail]) {
        const { router, unmount } = renderApp(path, { token: true })
        await heading(messages.placeholder.title)
        expect(router.state.location.pathname).toBe('/')
        unmount()
      }
      expect(lists.sink.calls).toBe(0)
    }
  })

  it('shows both nav entries with NEW badges to PEMBINA and none to a MEMBER', async () => {
    server.use(handlers.counts(SUBMISSION_COUNTS_EXAMPLE))
    renderApp('/prayer-requests', { token: true })
    const nav = await screen.findByRole('navigation', { name: messages.nav.label })
    expect(
      await within(nav).findByRole('link', { name: `${messages.nav.prayerRequests}, ${t.newCount(3)}` }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole('link', { name: `${messages.nav.volunteerApplications}, ${t.newCount(1)}` }),
    ).toBeInTheDocument()
  })

  it('hides the badge of a type whose NEW count is 0', async () => {
    const counts = counted(() => ({ prayerRequestsNew: 0, volunteerApplicationsNew: 2 }))
    server.use(http.get('*/api/admin/submissions/counts', counts.run))
    renderApp('/prayer-requests', { token: true })
    const nav = await screen.findByRole('navigation', { name: messages.nav.label })
    await within(nav).findByRole('link', {
      name: `${messages.nav.volunteerApplications}, ${t.newCount(2)}`,
    })
    expect(within(nav).getByRole('link', { name: messages.nav.prayerRequests })).toBeInTheDocument()
    expect(within(nav).queryByText(t.newCount(0))).toBeNull()
  })

  it('does not request counts for a MEMBER', async () => {
    const counts = counted(() => SUBMISSION_COUNTS_EXAMPLE)
    server.use(
      handlers.me(undefined, ME_BY_ROLE.member),
      http.get('*/api/admin/submissions/counts', counts.run),
    )
    renderApp('/prayer-requests', { token: true })
    await screen.findByRole('navigation', { name: messages.nav.label })
    expect(counts.sink.calls).toBe(0)
    expect(screen.queryByRole('link', { name: new RegExp(messages.nav.prayerRequests) })).toBeNull()
  })

  it('refetches the counts when the window regains focus', async () => {
    const counts = counted(() => SUBMISSION_COUNTS_EXAMPLE)
    server.use(http.get('*/api/admin/submissions/counts', counts.run))
    renderApp('/prayer-requests', { token: true })
    await screen.findByRole('link', { name: new RegExp(t.newCount(3)) })
    const before = counts.sink.calls
    act(() => focusManager.setFocused(false))
    act(() => focusManager.setFocused(true))
    await waitFor(() => expect(counts.sink.calls).toBeGreaterThan(before))
  })

  it('shows no badge, and no crash, when the counts call fails', async () => {
    server.use(
      http.get('*/api/admin/submissions/counts', () => respond(500, { statusCode: 500 })),
    )
    renderApp('/prayer-requests', { token: true })
    const nav = await screen.findByRole('navigation', { name: messages.nav.label })
    expect(await within(nav).findByRole('link', { name: messages.nav.prayerRequests })).toBeVisible()
    expect(within(nav).queryByText(/baru$/)).toBeNull()
  })
})

describe('prayer request list', () => {
  it('lists requests as table and cards, a missing name reads "Tanpa nama"', async () => {
    server.use(
      http.get('*/api/admin/prayer-requests', () =>
        HttpResponse.json([P, { ...P, id: 'other', name: null }]),
      ),
    )
    renderApp('/prayer-requests', { token: true })
    await heading(t.prayer.title)
    const table = await screen.findByTestId('prayer-table')
    expect(within(table).getByText('Budi')).toBeInTheDocument()
    expect(within(table).getByText(t.noName)).toBeInTheDocument()
    expect(within(table).getAllByText(t.statuses.NEW)).toHaveLength(2)
    expect(within(screen.getByTestId('prayer-cards')).getAllByRole('listitem')).toHaveLength(2)
    expect(
      within(table).getByRole('link', { name: `${t.prayer.detailAria}: Budi` }),
    ).toHaveAttribute('href', `/prayer-requests/${P.id}`)
  })

  it('sends the chosen status as ?status= and keeps it in the URL', async () => {
    const list = counted(() => [P])
    server.use(http.get('*/api/admin/prayer-requests', list.run))
    const { router } = renderApp('/prayer-requests', { token: true })
    await screen.findByTestId('prayer-table')
    const u = user()
    await u.click(screen.getByRole('combobox', { name: t.statusFilterLabel }))
    await u.click(await screen.findByRole('option', { name: t.statuses.IN_PROGRESS }))
    await waitFor(() => expect(list.sink.urls.some((x) => x.endsWith('?status=IN_PROGRESS'))).toBe(true))
    expect(router.state.location.search).toBe('?status=IN_PROGRESS')
  })

  it('ignores an unknown ?status= and shows everything', async () => {
    const list = counted(() => [P])
    server.use(http.get('*/api/admin/prayer-requests', list.run))
    renderApp('/prayer-requests?status=CONTACTED', { token: true })
    await screen.findByTestId('prayer-table')
    expect(list.sink.urls.every((x) => !x.includes('status='))).toBe(true)
  })

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get('*/api/admin/prayer-requests', async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json([P])
      }),
    )
    const { container } = renderApp('/prayer-requests', { token: true })
    await heading(t.prayer.title)
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    await screen.findByTestId('prayer-table')
  })

  it('has an empty state, and a different one with a filter', async () => {
    server.use(http.get('*/api/admin/prayer-requests', () => HttpResponse.json([])))
    renderApp('/prayer-requests', { token: true })
    expect(await screen.findByText(t.prayer.emptyTitle)).toBeInTheDocument()
  })

  it('has a filtered empty state with a way back to all statuses', async () => {
    server.use(http.get('*/api/admin/prayer-requests', () => HttpResponse.json([])))
    renderApp('/prayer-requests?status=DONE', { token: true })
    expect(await screen.findByText(t.prayer.emptyFilteredTitle)).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: t.allStatuses }))
    expect(await screen.findByText(t.prayer.emptyTitle)).toBeInTheDocument()
  })

  it('shows an error with retry, in Indonesian, never the backend text', async () => {
    let fail = true
    server.use(
      http.get('*/api/admin/prayer-requests', () =>
        fail ? respond(403, SUBMISSION_ERROR_BODIES.forbidden) : HttpResponse.json([P]),
      ),
    )
    renderApp('/prayer-requests', { token: true })
    expect(await screen.findByText(t.prayer.loadErrorTitle)).toBeInTheDocument()
    expect(screen.getByText(messages.errors.forbidden)).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).toBeNull()
    fail = false
    await user().click(screen.getByRole('button', { name: messages.common.retry }))
    expect(await screen.findByTestId('prayer-table')).toBeInTheDocument()
  })
})

describe('volunteer application list and detail', () => {
  beforeEach(() => {
    server.use(http.get('*/api/admin/volunteer-applications', () => HttpResponse.json([V])))
  })

  it('lists applications', async () => {
    renderApp('/volunteer-applications', { token: true })
    const table = await screen.findByTestId('volunteer-table')
    expect(within(table).getByText('Sari')).toBeInTheDocument()
    expect(within(table).getByText('0813')).toBeInTheDocument()
  })

  it('shows the bidang names and "Tidak diisi" for empty fields', async () => {
    renderApp(volunteerDetail, { token: true })
    await screen.findByText('Sari')
    expect(screen.getByText('Music, Worship')).toBeInTheDocument()
    expect(screen.getAllByText(t.noValue).length).toBeGreaterThan(0)
  })

  it('shows "Tidak ada" when no bidang were chosen', async () => {
    server.use(
      http.get('*/api/admin/volunteer-applications', () => HttpResponse.json([{ ...V, bidang: [] }])),
    )
    renderApp(volunteerDetail, { token: true })
    await screen.findByText('Sari')
    expect(screen.getByText(t.none)).toBeInTheDocument()
  })

  it('changes the status through the select and sends only the status', async () => {
    const patch = { calls: 0, body: undefined as unknown }
    server.use(
      http.patch('*/api/admin/volunteer-applications/:id', async ({ request }) => {
        patch.calls += 1
        patch.body = await request.json()
        return HttpResponse.json({ ...V, status: 'CONTACTED' })
      }),
    )
    renderApp(volunteerDetail, { token: true })
    await screen.findByText('Sari')
    const u = user()
    await u.click(screen.getByRole('combobox', { name: t.statusLabel }))
    await u.click(await screen.findByRole('option', { name: t.statuses.CONTACTED }))
    await u.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.saved))
    expect(patch.body).toEqual({ status: 'CONTACTED' })
  })
})

describe('prayer request detail', () => {
  function serve(items: unknown[] = [P]) {
    const counts = counted(() => SUBMISSION_COUNTS_EXAMPLE)
    const lists = counted(() => items)
    server.use(
      http.get('*/api/admin/prayer-requests', lists.run),
      http.get('*/api/admin/submissions/counts', counts.run),
    )
    return { counts: counts.sink, lists: lists.sink }
  }

  it('shows the fields, the note and the handler', async () => {
    serve([
      {
        ...P,
        adminNote: 'Call on Sunday',
        status: 'IN_PROGRESS',
        handledBy: { id: 'u1', name: 'Pak Andi' },
        handledAt: '2026-03-02T03:00:00.000Z',
      },
    ])
    renderApp(prayerDetail, { token: true })
    expect(await screen.findByText('Please pray')).toBeInTheDocument()
    expect(screen.getByLabelText(t.noteLabel)).toHaveValue('Call on Sunday')
    expect(screen.getByText(/Pak Andi/)).toHaveTextContent('02 Maret 2026')
    expect(screen.getByText(/Pak Andi/)).toHaveTextContent('WIB')
  })

  it('renders stored text as text, not HTML', async () => {
    serve([{ ...P, content: '<b>bold</b> <img src=x onerror=alert(1)>' }])
    renderApp(prayerDetail, { token: true })
    expect(await screen.findByText(/<b>bold<\/b>/)).toBeInTheDocument()
    expect(document.querySelector('main b, main img')).toBeNull()
  })

  it('disables Simpan until something changes', async () => {
    serve()
    renderApp(prayerDetail, { token: true })
    await screen.findByText('Please pray')
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
    expect(screen.getByText(t.noChanges)).toBeInTheDocument()
  })

  it('saves a note only, trimmed, then refetches lists and counts', async () => {
    const seen = serve()
    const sent: unknown[] = []
    server.use(
      http.patch('*/api/admin/prayer-requests/:id', async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ ...P, adminNote: 'Called', handledAt: '2026-03-02T03:00:00.000Z' })
      }),
    )
    renderApp(prayerDetail, { token: true })
    await screen.findByText('Please pray')
    const u = user()
    await u.type(screen.getByLabelText(t.noteLabel), '  Called  ')
    const lists = seen.lists.calls
    const counts = seen.counts.calls
    await u.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.toast.saved))
    expect(sent).toEqual([{ adminNote: 'Called' }])
    await waitFor(() => expect(seen.counts.calls).toBeGreaterThan(counts))
    await waitFor(() => expect(seen.lists.calls).toBeGreaterThan(lists))
  })

  it('sends null when an existing note is cleared', async () => {
    serve([{ ...P, adminNote: 'Old' }])
    const sent: unknown[] = []
    server.use(
      http.patch('*/api/admin/prayer-requests/:id', async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ ...P, adminNote: null })
      }),
    )
    renderApp(prayerDetail, { token: true })
    await screen.findByText('Please pray')
    const u = user()
    await u.clear(screen.getByLabelText(t.noteLabel))
    await u.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(sent).toEqual([{ adminNote: null }]))
  })

  it('sends status and note together', async () => {
    serve()
    const sent: unknown[] = []
    server.use(
      http.patch('*/api/admin/prayer-requests/:id', async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ ...P, status: 'DONE', adminNote: 'x' })
      }),
    )
    renderApp(prayerDetail, { token: true })
    await screen.findByText('Please pray')
    const u = user()
    await u.click(screen.getByRole('combobox', { name: t.statusLabel }))
    await u.click(await screen.findByRole('option', { name: t.statuses.DONE }))
    await u.type(screen.getByLabelText(t.noteLabel), 'x')
    await u.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(sent).toEqual([{ status: 'DONE', adminNote: 'x' }]))
  })

  it('maps a 400 on save to Indonesian text', async () => {
    serve()
    server.use(
      http.patch('*/api/admin/prayer-requests/:id', () =>
        respond(400, SUBMISSION_ERROR_BODIES.emptyPatch),
      ),
    )
    renderApp(prayerDetail, { token: true })
    await screen.findByText('Please pray')
    const u = user()
    await u.type(screen.getByLabelText(t.noteLabel), 'x')
    await u.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(messages.errors.validation))
  })

  it('on a 404 while saving: toast, back to the list', async () => {
    serve()
    server.use(
      http.patch('*/api/admin/prayer-requests/:id', () =>
        respond(404, SUBMISSION_ERROR_BODIES.prayerNotFound),
      ),
    )
    const { router } = renderApp(prayerDetail, { token: true })
    await screen.findByText('Please pray')
    const u = user()
    await u.type(screen.getByLabelText(t.noteLabel), 'x')
    await u.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.gone))
    await waitFor(() => expect(router.state.location.pathname).toBe('/prayer-requests'))
  })

  it('shows a not-found state for an unknown id', async () => {
    serve()
    renderApp('/prayer-requests/unknown', { token: true })
    expect(await screen.findByText(t.notFoundTitle)).toBeInTheDocument()
  })

  it('shows an error state with retry when the list fails', async () => {
    server.use(http.get('*/api/admin/prayer-requests', () => respond(500, { statusCode: 500 })))
    renderApp(prayerDetail, { token: true })
    expect(await screen.findByText(t.prayer.loadErrorTitle)).toBeInTheDocument()
    expect(screen.getByText(messages.errors.server)).toBeInTheDocument()
  })

  describe('delete', () => {
    const deleteName = `${t.prayer.deleteAria}: Budi`

    it('always asks first and says the deletion is permanent; cancel deletes nothing', async () => {
      serve()
      const del = counted(() => ({}))
      server.use(http.delete('*/api/admin/prayer-requests/:id', del.run))
      renderApp(prayerDetail, { token: true })
      await screen.findByText('Please pray')
      const u = user()
      await u.click(screen.getByRole('button', { name: deleteName }))
      const dialog = await screen.findByRole('alertdialog')
      expect(within(dialog).getByText(t.confirmDelete.title)).toBeInTheDocument()
      expect(within(dialog).getByText(t.confirmDelete.description)).toBeInTheDocument()
      expect(within(dialog).getByText('Budi')).toBeInTheDocument()
      await u.click(within(dialog).getByRole('button', { name: messages.common.cancel }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(del.sink.calls).toBe(0)
      expect(screen.getByText('Please pray')).toBeInTheDocument()
    })

    it('deletes once (even on a double click), returns to the list and refreshes list and counts', async () => {
      const seen = serve()
      let calls = 0
      server.use(
        http.delete('*/api/admin/prayer-requests/:id', async () => {
          calls += 1
          await new Promise((r) => setTimeout(r, 30))
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const { router } = renderApp(prayerDetail, { token: true })
      await screen.findByText('Please pray')
      const u = user()
      await u.click(screen.getByRole('button', { name: deleteName }))
      const confirm = within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.confirmDelete.action,
      })
      const lists = seen.lists.calls
      const counts = seen.counts.calls
      await u.dblClick(confirm)
      await waitFor(() => expect(router.state.location.pathname).toBe('/prayer-requests'))
      expect(calls).toBe(1)
      expect(toast.success).toHaveBeenCalledWith(t.toast.deleted)
      await waitFor(() => expect(seen.counts.calls).toBeGreaterThan(counts))
      await waitFor(() => expect(seen.lists.calls).toBeGreaterThan(lists))
    })

    it('maps a 403 to Indonesian text and stays on the page', async () => {
      serve()
      server.use(
        http.delete('*/api/admin/prayer-requests/:id', () =>
          respond(403, SUBMISSION_ERROR_BODIES.forbidden),
        ),
      )
      const { router } = renderApp(prayerDetail, { token: true })
      await screen.findByText('Please pray')
      const u = user()
      await u.click(screen.getByRole('button', { name: deleteName }))
      await u.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: t.confirmDelete.action,
        }),
      )
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(messages.errors.forbidden))
      expect(router.state.location.pathname).toBe(prayerDetail)
    })

    it('on a 404 tells the item is gone and goes to the list', async () => {
      serve()
      server.use(
        http.delete('*/api/admin/prayer-requests/:id', () =>
          respond(404, SUBMISSION_ERROR_BODIES.prayerNotFound),
        ),
      )
      const { router } = renderApp(prayerDetail, { token: true })
      await screen.findByText('Please pray')
      const u = user()
      await u.click(screen.getByRole('button', { name: deleteName }))
      await u.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: t.confirmDelete.action,
        }),
      )
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.toast.gone))
      await waitFor(() => expect(router.state.location.pathname).toBe('/prayer-requests'))
    })
  })
})

describe('volunteer delete', () => {
  it('confirms, then deletes and returns to the list', async () => {
    server.use(http.get('*/api/admin/volunteer-applications', () => HttpResponse.json([V])))
    const del = counted(() => ({}))
    server.use(
      http.delete('*/api/admin/volunteer-applications/:id', () => {
        del.sink.calls += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderApp(volunteerDetail, { token: true })
    await screen.findByText('Sari')
    const u = user()
    await u.click(screen.getByRole('button', { name: `${t.volunteer.deleteAria}: Sari` }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(t.confirmDelete.description)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: t.confirmDelete.action }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/volunteer-applications'))
    expect(del.sink.calls).toBe(1)
  })
})

describe('messages', () => {
  it('fills the handled-by template', () => {
    expect(fillMessage(t.handledByAt, { name: 'A', date: 'd', time: 't' })).toBe('Oleh A, d, t')
  })
})
