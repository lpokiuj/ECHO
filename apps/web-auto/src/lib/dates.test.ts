import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatTime,
  formatTimeRange,
  hasEnded,
  isFuture,
  isTimeInput,
  jakartaDayKey,
  parseInstant,
  toWibInputs,
  toWibIso,
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

describe('form inputs', () => {
  it('converts a WIB date and time to ISO with +07:00', () => {
    expect(toWibIso('2026-12-06', '09:00')).toBe('2026-12-06T09:00:00+07:00')
    // Same instant as the docs example response.
    expect(new Date(toWibIso('2026-12-06', '09:00')).toISOString()).toBe('2026-12-06T02:00:00.000Z')
  })
  it('rejects malformed input instead of guessing', () => {
    expect(() => toWibIso('', '09:00')).toThrow()
    expect(() => toWibIso('2026-12-06', '9am')).toThrow()
    expect(() => toWibIso('2026-13-45', '09:00')).toThrow()
  })
  it('accepts only real 24-hour times', () => {
    for (const ok of ['00:00', '09:05', '23:59']) expect(isTimeInput(ok)).toBe(true)
    for (const bad of ['', '9:00', '24:00', '12:60', '09:00 PM', '0900']) {
      expect(isTimeInput(bad)).toBe(false)
    }
  })
  it('reads an API instant back as WIB inputs, across midnight', () => {
    expect(toWibInputs('2026-12-06T02:00:00.000Z')).toEqual({ date: '2026-12-06', time: '09:00' })
    expect(toWibInputs('2026-12-06T17:30:00.000Z')).toEqual({ date: '2026-12-07', time: '00:30' })
  })
  it('knows whether an instant is in the future', () => {
    const now = Date.parse('2026-12-06T02:00:00.000Z')
    expect(isFuture('2026-12-06T09:00:01+07:00', now)).toBe(true)
    expect(isFuture('2026-12-06T09:00:00+07:00', now)).toBe(false)
  })
})
