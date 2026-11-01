import { CrownIcon, UserMinusIcon } from 'lucide-react'
import type { TeamMember } from '@/api/types'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { messages } from '@/lib/messages'

const d = messages.teams.detail

export interface MemberActions {
  /** The member whose request is in flight, if any. */
  busyUserId: string | null
  onToggleLeader: (member: TeamMember) => void
  onRemove: (member: TeamMember) => void
}

function Identity({ member }: { member: TeamMember }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar name={member.name} />
      <div className="min-w-0">
        <p className="text-base font-medium break-words">{member.name}</p>
        <p className="text-muted-foreground text-sm break-all">{member.email}</p>
      </div>
    </div>
  )
}

function StatusBadges({ member }: { member: TeamMember }) {
  return (
    <>
      {member.isLeader ? (
        <Badge>{d.leaderBadge}</Badge>
      ) : (
        <Badge variant="outline">{d.volunteerBadge}</Badge>
      )}
      {member.isActive ? null : <Badge variant="secondary">{d.inactiveBadge}</Badge>}
    </>
  )
}

function RowActions({
  member,
  busyUserId,
  onToggleLeader,
  onRemove,
}: MemberActions & { member: TeamMember }) {
  const busy = busyUserId === member.userId
  const disabled = busyUserId !== null
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        loading={busy}
        disabled={disabled}
        aria-label={`${member.isLeader ? d.unmakeLeaderAria : d.makeLeaderAria}: ${member.name}`}
        onClick={() => onToggleLeader(member)}
      >
        <CrownIcon aria-hidden="true" />
        {member.isLeader ? d.unmakeLeader : d.makeLeader}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={`${d.removeAria}: ${member.name}`}
        onClick={() => onRemove(member)}
      >
        <UserMinusIcon aria-hidden="true" />
        {d.remove}
      </Button>
    </div>
  )
}

export function MemberTable({ members, ...actions }: { members: TeamMember[] } & MemberActions) {
  return (
    <div className="hidden md:block" data-testid="members-table">
      <Table aria-label={d.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{d.columns.member}</TableHead>
            <TableHead>{d.columns.status}</TableHead>
            <TableHead>{d.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.userId}>
              <TableCell className="whitespace-normal">
                <Identity member={m} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <StatusBadges member={m} />
                </div>
              </TableCell>
              <TableCell>
                <RowActions member={m} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function MemberCards({ members, ...actions }: { members: TeamMember[] } & MemberActions) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={d.listLabel}
      data-testid="members-cards"
    >
      {members.map((m) => (
        <li key={m.userId}>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Identity member={m} />
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadges member={m} />
              </div>
              <RowActions member={m} {...actions} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
