import { describe, expect, it } from 'vitest'
import { site } from '@/content/site'
import { PRAYER_LIMITS } from './limits'
import { prayerSchema, toRequestBody, type PrayerFormInput } from './schema'

const errors = site.pages.prayer.form.errors

const valid: PrayerFormInput = {
  name: '',
  wantsFollowUp: false,
  contact: '',
  content: 'Mohon doa',
  consent: true,
  website: '',
}

function messagesFor(input: Partial<PrayerFormInput>, path: string): string[] {
  const result = prayerSchema.safeParse({ ...valid, ...input })
  if (result.success) return []
  return result.error.issues.filter((i) => i.path[0] === path).map((i) => i.message)
}

describe('prayerSchema', () => {
  it('accepts a minimal valid request', () => {
    expect(prayerSchema.safeParse(valid).success).toBe(true)
  })

  it('requires content: empty and whitespace-only fail, one character passes', () => {
    expect(messagesFor({ content: '' }, 'content')).toEqual([errors.contentRequired])
    expect(messagesFor({ content: '   \n ' }, 'content')).toEqual([errors.contentRequired])
    expect(messagesFor({ content: 'a' }, 'content')).toEqual([])
  })

  it('limits content to 2000 trimmed characters', () => {
    const max = PRAYER_LIMITS.content
    expect(messagesFor({ content: 'a'.repeat(max) }, 'content')).toEqual([])
    expect(messagesFor({ content: `${'a'.repeat(max)}   ` }, 'content')).toEqual([])
    expect(messagesFor({ content: 'a'.repeat(max + 1) }, 'content')).toEqual([
      errors.contentTooLong(max),
    ])
  })

  it('limits name and contact to 100 characters', () => {
    const max = PRAYER_LIMITS.name
    expect(messagesFor({ name: 'a'.repeat(max) }, 'name')).toEqual([])
    expect(messagesFor({ name: 'a'.repeat(max + 1) }, 'name')).toEqual([errors.nameTooLong(max)])
    expect(messagesFor({ contact: 'a'.repeat(max + 1) }, 'contact')).toEqual([
      errors.contactTooLong(PRAYER_LIMITS.contact),
    ])
  })

  it('requires contact only when follow-up is wanted', () => {
    expect(messagesFor({ wantsFollowUp: false, contact: '' }, 'contact')).toEqual([])
    expect(messagesFor({ wantsFollowUp: true, contact: '' }, 'contact')).toEqual([
      errors.contactRequired,
    ])
    expect(messagesFor({ wantsFollowUp: true, contact: '   ' }, 'contact')).toEqual([
      errors.contactRequired,
    ])
    expect(messagesFor({ wantsFollowUp: true, contact: 'x' }, 'contact')).toEqual([])
  })

  it('requires consent to be exactly true', () => {
    expect(messagesFor({ consent: false }, 'consent')).toEqual([errors.consentRequired])
    expect(messagesFor({ consent: true }, 'consent')).toEqual([])
  })
})

describe('toRequestBody', () => {
  it('trims, omits blank optional fields and leaves out an empty honeypot', () => {
    const values = prayerSchema.parse({ ...valid, content: '  Mohon doa  ', name: '  ' })
    expect(toRequestBody(values)).toEqual({
      content: 'Mohon doa',
      consent: true,
      wantsFollowUp: false,
    })
  })

  it('keeps name, contact (even without follow-up) and a filled honeypot as typed', () => {
    const values = prayerSchema.parse({
      ...valid,
      name: ' e2e-x ',
      contact: ' kontak ',
      website: 'bot',
    })
    expect(toRequestBody(values)).toEqual({
      content: 'Mohon doa',
      consent: true,
      wantsFollowUp: false,
      name: 'e2e-x',
      contact: 'kontak',
      website: 'bot',
    })
  })
})
