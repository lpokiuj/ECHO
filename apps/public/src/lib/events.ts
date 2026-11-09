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
