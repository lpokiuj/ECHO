import { describe, expect, it } from 'vitest'
import { formatEventDate } from './dates'

describe('formatEventDate', () => {
  it('shows the instant in Asia/Jakarta with a WIB label', () => {
    // 03:00 UTC is 10:00 WIB
    const text = formatEventDate('2030-01-05T03:00:00Z')
    expect(text).toContain('10.00')
    expect(text).toContain('2030')
    expect(text.endsWith('WIB')).toBe(true)
  })

  it('returns an empty string for an unparseable value', () => {
    expect(formatEventDate('not a date')).toBe('')
  })
})
