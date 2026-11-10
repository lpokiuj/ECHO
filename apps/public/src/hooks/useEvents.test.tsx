import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventItem } from '@/api/types'
import { site } from '@/content/site'
import { EventsList } from '@/features/events/EventsList'
import { handlers } from '@/test/handlers'
import { server } from '@/test/setup'

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EventsList />
    </QueryClientProvider>,
  )
}

// The clock is fixed in every test below; the dates are relative to it, not to the real time.
const NOW = Date.parse('2040-06-01T00:00:00+07:00')
const DAY = 24 * 60 * 60 * 1000
const make = (id: string, offsetDays: number): EventItem => ({
  id,
  title: `Acara ${id}`,
  startsAt: new Date(NOW + offsetDays * DAY).toISOString(),
  location: 'Lokasi akan diisi',
  description: 'Deskripsi akan diisi.',
})

describe('EventsList (GET /public/events)', () => {
  afterEach(() => vi.useRealTimers())

  it('shows loading, then the events from the API', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    const list = [make('a', 3), make('b', 10)]
    server.use(handlers.events(list))
    renderList()
    expect(screen.getByRole('status')).toHaveTextContent(site.states.loading)
    for (const event of list) {
      expect(await screen.findByRole('heading', { name: event.title })).toBeInTheDocument()
    }
    expect(screen.getAllByText(new RegExp(site.sections.events.timezoneLabel))).not.toHaveLength(0)
  })

  it('shows the empty state for an empty response', async () => {
    server.use(handlers.events([]))
    renderList()
    expect(await screen.findByText(site.sections.events.empty)).toBeInTheDocument()
  })

  it('shows an error without raw text on a 500, and a retry that recovers', async () => {
    server.use(
      http.get('*/api/public/events', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent(site.sections.events.error)
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    server.use(handlers.events([]))
    await userEvent.click(screen.getByRole('button', { name: site.states.retry }))
    expect(await screen.findByText(site.sections.events.empty)).toBeInTheDocument()
  })

  it('shows the error state on a network failure', async () => {
    server.use(http.get('*/api/public/events', () => HttpResponse.error()))
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent(site.sections.events.error)
  })

  it('renders text from the API as text, never as HTML', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    server.use(handlers.events([{ ...make('x', 2), title: '<b>Tebal</b>' }]))
    renderList()
    expect(await screen.findByRole('heading', { name: '<b>Tebal</b>' })).toBeInTheDocument()
    expect(document.querySelector('h3 b')).toBeNull()
  })
})

describe('EventsList (upcoming only, fixed clock)', () => {
  afterEach(() => vi.useRealTimers())

  it('hides past events and lists the upcoming ones in order', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    server.use(handlers.events([make('late', 20), make('past', -2), make('soon', 5)]))
    renderList()
    expect(await screen.findByRole('heading', { name: 'Acara soon' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Acara past' })).not.toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Acara soon', 'Acara late'])
  })

  it('shows the empty state when every event is past', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    server.use(handlers.events([make('p1', -5), make('p2', -1)]))
    renderList()
    expect(await screen.findByText(site.sections.events.empty)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})
