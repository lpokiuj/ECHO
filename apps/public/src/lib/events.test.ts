import { describe, expect, it } from 'vitest'
import { events } from '@/content/events'
import { getEvents } from './events'

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
