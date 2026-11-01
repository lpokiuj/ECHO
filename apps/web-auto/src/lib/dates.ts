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

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/
const TIME_INPUT = /^\d{2}:\d{2}$/

/** Form input (date "YYYY-MM-DD", time "HH:mm", read as Asia/Jakarta) to ISO 8601 with +07:00. */
export function toWibIso(date: string, time: string): string {
  if (!DATE_INPUT.test(date) || !TIME_INPUT.test(time))
    throw new Error('Invalid date or time input')
  const iso = `${date}T${time}:00+07:00`
  if (Number.isNaN(new Date(iso).getTime())) throw new Error('Invalid date or time input')
  return iso
}

const inputFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** An API instant to the Jakarta date and time to prefill form inputs. */
export function toWibInputs(iso: string): { date: string; time: string } {
  const parts = inputFormat.formatToParts(parseInstant(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

/** True when the instant is strictly after `now`. */
export function isFuture(iso: string, now: number = Date.now()): boolean {
  return parseInstant(iso).getTime() > now
}
