import { describe, expect, it } from 'vitest'
import { VOLUNTEER_LIMITS as L } from './limits'
import { toRequestBody, volunteerSchema, type VolunteerFormInput } from './schema'

const valid: VolunteerFormInput = {
  fullName: 'e2e-test',
  whatsapp: '0812',
  email: '',
  bidangIds: [],
  availability: '',
  message: '',
  consent: true,
  website: '',
}

const parse = (over: Partial<VolunteerFormInput>) => volunteerSchema.safeParse({ ...valid, ...over })
const fails = (over: Partial<VolunteerFormInput>, path: string) => {
  const result = parse(over)
  return !result.success && result.error.issues.some((i) => i.path[0] === path)
}

describe('volunteerSchema', () => {
  it('accepts the minimal valid form', () => {
    expect(parse({}).success).toBe(true)
  })

  it('requires fullName and whatsapp (whitespace counts as empty)', () => {
    expect(fails({ fullName: '  ' }, 'fullName')).toBe(true)
    expect(fails({ whatsapp: '' }, 'whatsapp')).toBe(true)
  })

  it('requires consent to be true', () => {
    expect(fails({ consent: false }, 'consent')).toBe(true)
  })

  it.each([
    ['fullName', L.fullName],
    ['whatsapp', L.whatsapp],
    ['email', L.email],
    ['availability', L.availability],
    ['message', L.message],
  ] as const)('enforces the %s limit at the boundary', (field, max) => {
    const text = field === 'email' ? (n: number) => `${'a'.repeat(n - 6)}@b.com` : (n: number) => 'a'.repeat(n)
    expect(fails({ [field]: text(max) }, field)).toBe(false)
    expect(fails({ [field]: text(max + 1) }, field)).toBe(true)
  })

  it('allows an empty email and rejects invalid ones', () => {
    expect(fails({ email: '' }, 'email')).toBe(false)
    expect(fails({ email: 'a@b.com' }, 'email')).toBe(false)
    for (const bad of ['abc', 'a@b', 'a b@c.com', '@c.com']) {
      expect(fails({ email: bad }, 'email')).toBe(true)
    }
  })

  it('allows at most 20 bidang', () => {
    expect(fails({ bidangIds: Array.from({ length: 20 }, (_, i) => `id${i}`) }, 'bidangIds')).toBe(false)
    expect(fails({ bidangIds: Array.from({ length: 21 }, (_, i) => `id${i}`) }, 'bidangIds')).toBe(true)
  })
})

describe('toRequestBody', () => {
  it('omits blank optionals and an empty bidang list', () => {
    expect(toRequestBody({ ...valid, fullName: ' e2e-test ' })).toEqual({
      fullName: 'e2e-test',
      whatsapp: '0812',
      consent: true,
    })
  })

  it('keeps trimmed optionals, bidang ids and the honeypot', () => {
    const body = toRequestBody({
      ...valid,
      email: ' a@b.com ',
      bidangIds: ['x'],
      availability: ' Minggu ',
      message: ' Halo ',
      website: 'spam',
    })
    expect(body).toEqual({
      fullName: 'e2e-test',
      whatsapp: '0812',
      consent: true,
      email: 'a@b.com',
      bidangIds: ['x'],
      availability: 'Minggu',
      message: 'Halo',
      website: 'spam',
    })
  })
})
