import { useQuery } from '@tanstack/react-query'
import { getEvents, upcomingEvents } from '@/lib/events'

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: getEvents })
}

/** Same query as `useEvents()`, narrowed to upcoming events (past hidden, sorted). */
export function useUpcomingEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    select: (list) => upcomingEvents(list, Date.now()),
  })
}
