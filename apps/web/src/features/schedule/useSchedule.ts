import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getMySchedule, getServices } from '@/api/client'

export const SERVICES_KEY = ['services'] as const
export const MY_SCHEDULE_KEY = ['my-schedule'] as const

/** GET /services. Later features invalidate the `['services']` prefix. */
export function useServices(includePast: boolean) {
  return useQuery({
    queryKey: [...SERVICES_KEY, { includePast }],
    queryFn: () => getServices(includePast),
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** GET /me/schedule. */
export function useMySchedule(includePast: boolean) {
  return useQuery({
    queryKey: [...MY_SCHEDULE_KEY, { includePast }],
    queryFn: () => getMySchedule(includePast),
    placeholderData: keepPreviousData,
    retry: false,
  })
}
