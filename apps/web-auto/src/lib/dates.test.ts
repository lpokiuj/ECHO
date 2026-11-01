import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatTime,
  formatTimeRange,
  hasEnded,
  jakartaDayKey,
  parseInstant,
} from './dates'

describe('dates (Asia/Jakarta, id-ID)', () => {
  it('renders a known UTC instant in WIB with Indonesian day and month names', () => {
    expect(formatDate('2026-11-01T03:00:00.000Z')).toBe('Minggu, 1 November 2026')
    expect(formatTime('2026-11-01T03:00:00.000Z')).toBe('10.00 WIB')
    expect(formatTimeRange('2026-11-01T03:00:00.000Z', '2026-11-01T05:00:00.000Z')).toBe(
      '10.00 - 12.00 WIB',
    )
  })
  it('uses Indonesian month names (Desember, Agustus)', () => {
    expect(formatDate('2026-12-06T02:00:00.000Z')).toBe('Minggu, 6 Desember 2026')
    expect(formatDate('2026-08-17T02:00:00.000Z')).toBe('Senin, 17 Agustus 2026')
  })
  it('rolls over to the next day in WIB', () => {
    expect(formatDate('2026-11-01T17:30:00.000Z')).toBe('Senin, 2 November 2026')
    expect(formatTime('2026-11-01T17:30:00.000Z')).toBe('00.30 WIB')
    expect(jakartaDayKey('2026-11-01T17:30:00.000Z')).toBe('2026-11-02')
  })
  it('accepts an explicit offset', () => {
    expect(formatTime('2026-12-06T09:00:00+07:00')).toBe('09.00 WIB')
  })
  it('rejects a date string without a timezone', () => {
    expect(() => parseInstant('2026-11-01T10:00:00')).toThrow()
    expect(() => formatDate('2026-11-01')).toThrow()
  })
  it('knows when a service has ended', () => {
    const now = Date.parse('2026-11-01T04:00:00Z')
    expect(hasEnded('2026-11-01T03:59:59Z', now)).toBe(true)
    expect(hasEnded('2026-11-01T05:00:00Z', now)).toBe(false)
  })
})
