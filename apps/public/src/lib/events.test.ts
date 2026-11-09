import { describe, expect, it } from 'vitest'
import { events } from '@/content/events'
import { getEvents, upcomingEvents } from './events'

describe('getEvents', () => {
  it('resolves the static list, sorted by start time', async () => {
    const result = await getEvents()
    expect(result).toHaveLength(events.length)
    const times = result.map((e) => Date.parse(e.startsAt))
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('returns copies, so callers cannot change the source', async () => {
    const first = await getEvents()
    first[0]!.title = 'changed'
    first.pop()
    const second = await getEvents()
    expect(second).toHaveLength(events.length)
    expect(second.map((e) => e.title)).not.toContain('changed')
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
