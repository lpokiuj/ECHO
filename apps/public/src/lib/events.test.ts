import { existsSync } from 'node:fs'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { eventsExample } from '@/test/handlers'
import { server } from '@/test/setup'
import { getEvents, upcomingEvents } from './events'

describe('getEvents', () => {
  it('reads GET /api/public/events through the client, as the API returned it', async () => {
    let url = ''
    let auth: string | null = 'unset'
    server.use(
      http.get('*/api/public/events', ({ request }) => {
        url = new URL(request.url).pathname
        auth = request.headers.get('Authorization')
        return HttpResponse.json(eventsExample)
      }),
    )
    expect(await getEvents()).toEqual(eventsExample)
    expect(url).toBe('/api/public/events')
    expect(auth).toBeNull()
  })

  it('exposes only the five contract fields in the example', () => {
    for (const event of eventsExample) {
      expect(Object.keys(event).sort()).toEqual(
        ['description', 'id', 'location', 'startsAt', 'title'].sort(),
      )
      expect(event.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/)
    }
  })

  it('rejects when the API fails', async () => {
    server.use(http.get('*/api/public/events', () => HttpResponse.json({}, { status: 500 })))
    await expect(getEvents()).rejects.toBeInstanceOf(ApiError)
  })

  it('no longer has static event data in the content folder', () => {
    expect(existsSync(new URL('../content/events.ts', import.meta.url))).toBe(false)
  })
})

describe('upcomingEvents', () => {
  const make = (id: string, startsAt: string) => ({
    id,
    title: id,
    startsAt,
    location: 'Lokasi akan diisi',
    description: 'Deskripsi akan diisi.',
  })
  const now = Date.parse('2030-06-01T00:00:00+07:00')
  const past = make('past', '2030-05-31T10:00:00+07:00')
  const edge = make('edge', '2030-06-01T00:00:00+07:00')
  const soon = make('soon', '2030-06-02T10:00:00+07:00')
  const later = make('later', '2030-07-01T10:00:00+07:00')

  it('sorts ascending, even when the input is shuffled', () => {
    expect(upcomingEvents([later, soon, edge], now).map((e) => e.id)).toEqual([
      'edge',
      'soon',
      'later',
    ])
  })

  it('hides past events and keeps one that starts exactly now', () => {
    expect(upcomingEvents([past, edge, soon], now).map((e) => e.id)).toEqual(['edge', 'soon'])
  })

  it('accepts now as a Date', () => {
    expect(upcomingEvents([past, soon], new Date(now)).map((e) => e.id)).toEqual(['soon'])
  })

  it('drops events with an invalid date and returns [] for no events', () => {
    expect(upcomingEvents([make('bad', 'not a date'), soon], now).map((e) => e.id)).toEqual([
      'soon',
    ])
    expect(upcomingEvents([], now)).toEqual([])
    expect(upcomingEvents([past], now)).toEqual([])
  })

  it('does not mutate the input and returns copies', () => {
    const input = [later, soon]
    const result = upcomingEvents(input, now)
    expect(input.map((e) => e.id)).toEqual(['later', 'soon'])
    result[0]!.title = 'changed'
    expect(soon.title).toBe('soon')
  })
})
