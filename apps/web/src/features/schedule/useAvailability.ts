import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearUnavailable, setUnavailable } from '@/api/client'
import { MY_SCHEDULE_KEY, SERVICES_KEY } from './useSchedule'

/** PUT or DELETE the caller's unavailability mark. Services are refetched after every response. */
export function useSetAvailability(serviceId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (unavailable: boolean) =>
      unavailable ? setUnavailable(serviceId) : clearUnavailable(serviceId),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: SERVICES_KEY }),
        client.invalidateQueries({ queryKey: MY_SCHEDULE_KEY }),
      ]),
  })
}
