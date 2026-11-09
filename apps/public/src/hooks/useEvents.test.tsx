import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { events } from '@/content/events'
import { site } from '@/content/site'
import { EventsList } from '@/features/events/EventsList'
import { getEvents } from '@/lib/events'

vi.mock('@/lib/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/events')>()
  return { ...actual, getEvents: vi.fn(actual.getEvents) }
})

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EventsList />
    </QueryClientProvider>,
  )
}

describe('EventsList (useEvents)', () => {
  it('shows loading, then the events from getEvents()', async () => {
    renderList()
    expect(screen.getByRole('status')).toHaveTextContent(site.states.loading)
    for (const event of events) {
      expect(await screen.findByRole('heading', { name: event.title })).toBeInTheDocument()
    }
    expect(screen.getAllByText(new RegExp(site.sections.events.timezoneLabel))).not.toHaveLength(0)
  })

  it('shows the empty state', async () => {
    vi.mocked(getEvents).mockResolvedValueOnce([])
    renderList()
    expect(await screen.findByText(site.sections.events.empty)).toBeInTheDocument()
  })

  it('shows an error without raw text, and a retry that recovers', async () => {
    vi.mocked(getEvents).mockRejectedValueOnce(new Error('boom'))
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent(site.sections.events.error)
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    vi.mocked(getEvents).mockResolvedValueOnce([])
    await userEvent.click(screen.getByRole('button', { name: site.states.retry }))
    expect(await screen.findByText(site.sections.events.empty)).toBeInTheDocument()
  })
})

describe('EventsList (upcoming only, fixed clock)', () => {
  afterEach(() => vi.useRealTimers())

  const [first, second, third] = events
  // Between the first and the second event: the first is past.
  const between = Date.parse(first!.startsAt) + 24 * 60 * 60 * 1000

  it('hides past events and lists the upcoming ones in order', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: between })
    renderList()
    expect(await screen.findByRole('heading', { name: second!.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: third!.title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: first!.title })).not.toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual([second!.title, third!.title])
  })

  it('shows the empty state when every event is past', async () => {
    const last = Math.max(...events.map((e) => Date.parse(e.startsAt)))
    vi.useFakeTimers({ toFake: ['Date'], now: last + 1000 })
    renderList()
    expect(await screen.findByText(site.sections.events.empty)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})
