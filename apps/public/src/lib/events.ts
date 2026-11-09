import { events, type EventItem } from '@/content/events'

export type { EventItem }

/**
 * The only way the app reads events. Async on purpose: today it returns the static list from
 * `src/content/events.ts`; later it can call the API without changing any component.
 */
export async function getEvents(): Promise<EventItem[]> {
  return [...events]
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((event) => ({ ...event }))
}

/**
 * The events a visitor should see: sorted by start time, past events hidden. "Past" means
 * `startsAt < now` (an event starting exactly now is still shown). Events with an invalid date are
 * dropped. `now` is injected (a Date or epoch milliseconds) so tests do not depend on the clock.
 */
export function upcomingEvents(list: readonly EventItem[], now: number | Date): EventItem[] {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  return list
    .map((event) => ({ event, time: Date.parse(event.startsAt) }))
    .filter(({ time }) => !Number.isNaN(time) && time >= nowMs)
    .sort((a, b) => a.time - b.time)
    .map(({ event }) => ({ ...event }))
}
