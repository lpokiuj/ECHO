import { useQuery } from '@tanstack/react-query'
import { getEvents } from '@/lib/events'

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: getEvents })
}
