import type { MeResponse } from '@/api/types'
import { useTeams } from '@/features/teams/useTeams'
import { TeamRecap, type TeamOption } from './TeamRecap'

function AdminRecap() {
  const teams = useTeams()
  if (teams.data === undefined) return null
  const options: TeamOption[] = teams.data.map((x) => ({ teamId: x.id, teamName: x.name }))
  return options.length > 0 ? <TeamRecap teams={options} /> : null
}

/** Team recap for the home page: every team for ADMIN and PEMBINA, the led teams for a team leader. */
export function HomeRecap({ me }: { me: MeResponse }) {
  if (me.role === 'ADMIN' || me.role === 'PEMBINA') return <AdminRecap />
  const led = me.memberships
    .filter((m) => m.isLeader)
    .map(({ teamId, teamName }) => ({ teamId, teamName }))
  return led.length > 0 ? <TeamRecap teams={led} /> : null
}
