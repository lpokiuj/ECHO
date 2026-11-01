import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTeam,
  getTeamMembers,
  getTeams,
  putTeamMember,
  removeTeamMember,
  renameTeam,
} from '@/api/client'
import { ME_KEY } from '@/features/auth/useMe'
import { MY_SCHEDULE_KEY, SERVICES_KEY } from '@/features/schedule/useSchedule'

export const TEAMS_KEY = ['teams'] as const
export const teamMembersKey = (teamId: string) => ['team-members', teamId] as const
/** Prefix of every assign-screen candidates query (see features/assign/useAssign.ts). */
const CANDIDATES_KEY = ['candidates'] as const

/** GET /teams: every team ordered by name, no pagination. */
export function useTeams() {
  return useQuery({ queryKey: TEAMS_KEY, queryFn: getTeams, retry: false })
}

/** GET /teams/:id/members, inactive members included. */
export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: teamMembersKey(teamId),
    queryFn: () => getTeamMembers(teamId),
    retry: false,
  })
}

/** Marks queries stale and returns at once: refetches run in the background. */
function useInvalidate() {
  const client = useQueryClient()
  return (...keys: (readonly unknown[])[]) => {
    for (const queryKey of keys) void client.invalidateQueries({ queryKey })
  }
}

export function useCreateTeam() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => invalidate(TEAMS_KEY),
  })
}

export function useRenameTeam() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTeam(id, name),
    // The team name appears in schedules, candidates and the memberships of GET /me.
    onSuccess: () => invalidate(TEAMS_KEY, SERVICES_KEY, MY_SCHEDULE_KEY, CANDIDATES_KEY, ME_KEY),
    // A 404 means the team is gone; the list must refresh then too.
    onError: () => invalidate(TEAMS_KEY),
  })
}

/** After any roster change (success or failure) these views may have changed. */
function useRefreshRoster(teamId: string) {
  const invalidate = useInvalidate()
  return () =>
    invalidate(
      teamMembersKey(teamId),
      // Leader status drives the nav of the changed user (GET /me).
      ME_KEY,
      CANDIDATES_KEY,
      SERVICES_KEY,
      MY_SCHEDULE_KEY,
    )
}

/** Add a plain member (isLeader false) or change the leader flag. Always sends isLeader. */
export function usePutMember(teamId: string) {
  const refresh = useRefreshRoster(teamId)
  return useMutation({
    mutationFn: ({ userId, isLeader }: { userId: string; isLeader: boolean }) =>
      putTeamMember(teamId, userId, isLeader),
    onSettled: refresh,
  })
}

/** Also deletes this team's future assignments of the user, so schedules refresh too. */
export function useRemoveMember(teamId: string) {
  const refresh = useRefreshRoster(teamId)
  return useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSettled: refresh,
  })
}
