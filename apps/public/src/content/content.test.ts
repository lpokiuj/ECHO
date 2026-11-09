import { describe, expect, it } from 'vitest'
import { events } from './events'
import { site } from './site'

/** Every string in a content value (functions are called with a sample year). */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'function') return strings((value as (year: number) => unknown)(2030))
  if (Array.isArray(value)) return value.flatMap(strings)
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings)
  return []
}

describe('site content', () => {
  const sectionIds = Object.values(site.sections).map((s) => s.id)

  it('has unique section ids', () => {
    const ids = [site.hero.id, ...sectionIds]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('points every nav item at a home section or a known route', () => {
    for (const item of site.nav.items) {
      if (item.to.startsWith('/#')) expect(sectionIds).toContain(item.to.slice(2))
      else expect(['/doa', '/relawan']).toContain(item.to)
    }
    expect(['/doa', '/relawan']).toContain(site.nav.cta.to)
  })

  it('contains no real-looking facts: no URLs, emails, phone-like digit runs', () => {
    // `startsAt` is a date, not a fact; every other event field is copy.
    const eventCopy = events.flatMap((e) => [e.id, e.title, e.location, e.description])
    for (const text of [...strings(site), ...eventCopy]) {
      expect(text).not.toMatch(/https?:\/\//i)
      expect(text).not.toMatch(/\S+@\S+/)
      expect(text.replace(/\D/g, '').length).toBeLessThan(7)
    }
  })
})

describe('events content', () => {
  it('has unique ids and ISO 8601 dates with an explicit offset, marked as examples', () => {
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length)
    for (const event of events) {
      expect(event.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/)
      expect(Number.isNaN(Date.parse(event.startsAt))).toBe(false)
      expect(event.title).toContain('(contoh)')
    }
  })
})
