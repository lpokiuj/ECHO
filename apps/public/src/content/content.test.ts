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
    // The only URL allowed is the Google Maps base used for the Lokasi embed, matched exactly.
    const allowedUrls: string[] = [site.sections.location.map.baseUrl]
    for (const text of [...strings(site), ...eventCopy]) {
      if (!allowedUrls.includes(text)) expect(text).not.toMatch(/https?:\/\//i)
      expect(text).not.toMatch(/\S+@\S+/)
      expect(text.replace(/\D/g, '').length).toBeLessThan(7)
    }
  })
})

describe('home content', () => {
  it('allows exactly the Google Maps base url and a clean placeholder query', () => {
    const map = site.sections.location.map
    expect(map.baseUrl).toBe('https://www.google.com/maps')
    expect(map.query).not.toMatch(/https?:\/\//i)
    expect(map.query).not.toMatch(/\S+@\S+/)
    expect(map.query.replace(/\D/g, '').length).toBeLessThan(7)
    expect(map.title.trim()).not.toBe('')
  })

  it('has unique ids in the worship schedule and expectations', () => {
    const w = site.sections.worship
    for (const items of [w.schedule.items, w.expect.items]) {
      const ids = items.map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('lists the nav items in page order after the hero', () => {
    const order = ['ibadah', 'lokasi', 'acara', 'tentang', 'pertama-kali', 'kontak']
    const anchors = site.nav.items.filter((i) => i.to.startsWith('/#')).map((i) => i.id)
    expect(anchors).toEqual(order)
  })

  it('keeps the home sections in plan order, and the nav anchors a subsequence of it', () => {
    const pageOrder = Object.values(site.sections).map((s) => s.id)
    expect(pageOrder).toEqual([
      'ibadah',
      'lokasi',
      'acara',
      'tentang',
      'pertama-kali',
      'kontak',
      'persembahan',
    ])
    const anchors = site.nav.items.filter((i) => i.to.startsWith('/#')).map((i) => i.id)
    expect(pageOrder.filter((id) => (anchors as string[]).includes(id))).toEqual(anchors)
  })

  it('has unique ids in the bidang overview and the FAQ', () => {
    for (const items of [site.sections.about.bidang.items, site.sections.faq.items]) {
      const ids = items.map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('no real bank, phone or contact numbers', () => {
  const eventCopy = events.flatMap((e) => [e.id, e.title, e.location, e.description])

  it('has no long digit runs, phone prefixes or grouped numbers in any string', () => {
    for (const raw of [...strings(site), ...eventCopy]) {
      // A standalone year (the footer copyright sample) is the only 4-digit number allowed.
      const text = raw.replace(/\b(?:19|20)\d{2}\b/g, '')
      expect(text).not.toMatch(/\d{4,}/)
      expect(text).not.toMatch(/(\+62|\b0)8\d/)
      expect(text).not.toMatch(/\d{3,}[\s.-]\d{3,}/)
    }
  })

  it('keeps every contact, giving and social value an obvious placeholder', () => {
    const g = site.sections.giving
    const values = [
      site.contact.address,
      site.contact.whatsapp,
      site.contact.email,
      ...site.socials.items.map((i) => i.handle),
      g.bank.bankName.value,
      g.bank.accountName.value,
      g.bank.accountNumber.value,
      g.qris.placeholder,
    ]
    for (const value of values) expect(value).toMatch(/akan diisi$/)
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
