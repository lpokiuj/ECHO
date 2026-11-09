import { site } from '@/content/site'

const formatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Shows an ISO 8601 instant in Asia/Jakarta with a "WIB" label. Never parses offset-less text. */
export function formatEventDate(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  return `${formatter.format(time)} ${site.sections.events.timezoneLabel}`
}
