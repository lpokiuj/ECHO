import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createService, deleteService, updateService } from '@/api/client'
import type { CreateServiceBody, UpdateServiceBody } from '@/api/types'
import { MY_SCHEDULE_KEY, SERVICES_KEY } from '@/features/schedule/useSchedule'

/** Services appear in both schedules, so every change refreshes both. */
function useRefreshSchedules() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: SERVICES_KEY }),
      client.invalidateQueries({ queryKey: MY_SCHEDULE_KEY }),
    ])
}

export function useCreateService() {
  const refresh = useRefreshSchedules()
  return useMutation({
    mutationFn: (body: CreateServiceBody) => createService(body),
    onSuccess: refresh,
  })
}

export function useUpdateService() {
  const refresh = useRefreshSchedules()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateServiceBody }) => updateService(id, body),
    onSuccess: refresh,
  })
}

export function useDeleteService() {
  const refresh = useRefreshSchedules()
  return useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: refresh,
    // A 404 means it is already gone; the list must refresh then too.
    onError: refresh,
  })
}
