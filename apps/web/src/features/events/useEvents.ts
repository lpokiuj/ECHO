import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEvent, deleteEvent, getEvents, updateEvent } from '@/api/client'
import type { CreateEventBody, UpdateEventBody } from '@/api/types'

/** Prefix of every events query. */
export const EVENTS_KEY = ['events'] as const

/** GET /admin/events: every event, newest start first (the API's order is kept). */
export function useEvents() {
  return useQuery({
    queryKey: [...EVENTS_KEY, 'admin'],
    queryFn: getEvents,
    retry: false,
  })
}

function useRefreshEvents() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: EVENTS_KEY })
}

export function useCreateEvent() {
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (body: CreateEventBody) => createEvent(body),
    onSuccess: refresh,
  })
}

export function useUpdateEvent() {
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEventBody }) => updateEvent(id, body),
    onSuccess: refresh,
  })
}

export function useDeleteEvent() {
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: refresh,
    // A 404 means it is already gone; the list must refresh then too.
    onError: refresh,
  })
}
