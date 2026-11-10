import { getEvents as fetchEvents } from '@/api/client'
import type { EventItem } from '@/api/types'

export type { EventItem }

/** The only way the app reads events: GET /public/events through the API client. */
export async function getEvents(): Promise<EventItem[]> {
  return fetchEvents()
}

/**
 * The events a visitor should see: sorted by start time, past events hidden. "Past" means
 * `startsAt < now` (an event starting exactly now is still shown). Events with an invalid date are
 * dropped. `now` is injected (a Date or epoch milliseconds) so tests do not depend on the clock.
 * The API already returns upcoming events only; this is a client-side safety filter.
 */
export function upcomingEvents(list: readonly EventItem[], now: number | Date): EventItem[] {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  return list
    .map((event) => ({ event, time: Date.parse(event.startsAt) }))
    .filter(({ time }) => !Number.isNaN(time) && time >= nowMs)
    .sort((a, b) => a.time - b.time)
    .map(({ event }) => ({ ...event }))
}
