import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearAbsence,
  designateAbsentTaker,
  getMemberAbsences,
  getMyAbsences,
  getTeamAbsences,
  recordAbsence,
} from '@/api/client'
import { normalizeError } from '@/api/errors'
import { ME_KEY } from '@/features/auth/useMe'
import { SERVICES_KEY } from '@/features/schedule/useSchedule'

export const MY_ABSENCES_KEY = ['my-absences'] as const
export const teamAbsencesKey = (teamId: string) => ['team-absences', teamId] as const

export function useMyAbsences() {
  return useQuery({ queryKey: MY_ABSENCES_KEY, queryFn: getMyAbsences, retry: false })
}

export function useTeamAbsences(teamId: string) {
  return useQuery({
    queryKey: teamAbsencesKey(teamId),
    queryFn: () => getTeamAbsences(teamId),
    enabled: teamId !== '',
    retry: false,
  })
}

export function useMemberAbsences(teamId: string, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['member-absences', teamId, userId],
    queryFn: () => getMemberAbsences(teamId, userId),
    enabled,
    retry: false,
  })
}

/** Designating changes `isAbsentTaker` in /services and the candidates; a 403 refreshes /me. */
export function useDesignateTaker(serviceId: string, teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => designateAbsentTaker(serviceId, teamId, userId),
    onSettled: (_data, error) => {
      const refreshes = [
        client.invalidateQueries({ queryKey: SERVICES_KEY }),
        client.invalidateQueries({ queryKey: ['candidates', serviceId, teamId] }),
      ]
      if (error && normalizeError(error).status === 403) {
        refreshes.push(client.invalidateQueries({ queryKey: ME_KEY }))
      }
      return Promise.all(refreshes)
    },
  })
}

/** PUT (absent) or DELETE (present again) one absence. Counts are refreshed after every response. */
export function useRecordAbsence(serviceId: string, teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, absent }: { userId: string; absent: boolean }) =>
      absent ? recordAbsence(serviceId, teamId, userId) : clearAbsence(serviceId, teamId, userId),
    onSettled: (_data, error) => {
      const refreshes = [
        client.invalidateQueries({ queryKey: MY_ABSENCES_KEY }),
        client.invalidateQueries({ queryKey: teamAbsencesKey(teamId) }),
        client.invalidateQueries({ queryKey: ['member-absences', teamId] }),
      ]
      if (error) {
        const status = normalizeError(error).status
        if (status === 403 || status === 404 || status === 400) {
          refreshes.push(client.invalidateQueries({ queryKey: SERVICES_KEY }))
        }
        if (status === 403) refreshes.push(client.invalidateQueries({ queryKey: ME_KEY }))
      }
      return Promise.all(refreshes)
    },
  })
}
