// The one date helper module. Display is always Asia/Jakarta, id-ID, 24-hour, with "WIB".
import { messages } from './messages.ts'

const TIME_ZONE = 'Asia/Jakarta'
const LOCALE = 'id-ID'
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Parses an ISO 8601 string. Strings without Z or an offset are rejected, never guessed. */
export function parseInstant(iso: string): Date {
  if (!HAS_OFFSET.test(iso)) throw new Error('Date string has no timezone')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date string')
  return date
}

/** "Minggu, 1 November 2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(parseInstant(iso))
}

/** "10.00" (Jakarta, 24-hour, no label) */
function clock(date: Date): string {
  const parts = timeFormat.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('hour')}.${get('minute')}`
}

/** "10.00 WIB" */
export function formatTime(iso: string): string {
  return `${clock(parseInstant(iso))} ${messages.dates.wib}`
}

/** "10.00 - 12.00 WIB" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${clock(parseInstant(startsAt))} - ${clock(parseInstant(endsAt))} ${messages.dates.wib}`
}

/** Calendar day in Jakarta as "2026-11-01", for grouping. */
export function jakartaDayKey(iso: string): string {
  return dayKeyFormat.format(parseInstant(iso))
}

/** True once the service's end has passed. */
export function hasEnded(endsAt: string, now: number = Date.now()): boolean {
  return parseInstant(endsAt).getTime() <= now
}
