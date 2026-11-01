import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assignUsers, getCandidates, unassignUser, updateAssignmentNote } from '@/api/client'
import { normalizeError } from '@/api/errors'
import { ME_KEY } from '@/features/auth/useMe'
import { MY_SCHEDULE_KEY, SERVICES_KEY } from '@/features/schedule/useSchedule'

export const candidatesKey = (serviceId: string, teamId: string) =>
  ['candidates', serviceId, teamId] as const

export function useCandidates(serviceId: string, teamId: string) {
  return useQuery({
    queryKey: candidatesKey(serviceId, teamId),
    queryFn: () => getCandidates(serviceId, teamId),
    retry: false,
  })
}

/**
 * After EVERY assign or unassign response (success, 400, 403, 404, 409, network) the
 * candidates are refetched, and the schedules too. A 403 also refreshes GET /me
 * (the leader flag may have been removed).
 */
function useRefreshAfter(serviceId: string, teamId: string) {
  const client = useQueryClient()
  return (error: unknown | null) => {
    const refreshes = [
      client.invalidateQueries({ queryKey: candidatesKey(serviceId, teamId) }),
      client.invalidateQueries({ queryKey: SERVICES_KEY }),
      client.invalidateQueries({ queryKey: MY_SCHEDULE_KEY }),
    ]
    if (error !== null && normalizeError(error).status === 403) {
      refreshes.push(client.invalidateQueries({ queryKey: ME_KEY }))
    }
    return Promise.all(refreshes)
  }
}

export function useAssign(serviceId: string, teamId: string) {
  const refresh = useRefreshAfter(serviceId, teamId)
  return useMutation({
    mutationFn: ({ userIds, notes }: { userIds: string[]; notes: Record<string, string> }) =>
      assignUsers(serviceId, teamId, userIds, notes),
    onSettled: (_data, error) => refresh(error),
  })
}

export function useUnassign(serviceId: string, teamId: string) {
  const refresh = useRefreshAfter(serviceId, teamId)
  return useMutation({
    mutationFn: (userId: string) => unassignUser(serviceId, teamId, userId),
    onSettled: (_data, error) => refresh(error),
  })
}

export function useUpdateNote(serviceId: string, teamId: string) {
  const refresh = useRefreshAfter(serviceId, teamId)
  return useMutation({
    mutationFn: ({ userId, notes }: { userId: string; notes: string }) =>
      updateAssignmentNote(serviceId, teamId, userId, notes),
    onSettled: (_data, error) => refresh(error),
  })
}
