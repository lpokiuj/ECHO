import { ArrowLeftIcon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { TeamMember } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Pagination } from '@/components/Pagination'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePagination } from '@/hooks/usePagination'
import { fillMessage, messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'
import { AddMemberDialog } from './AddMemberDialog'
import { MemberCards, MemberTable } from './MemberList'
import { memberPutMessage } from './memberErrors'
import { usePutMember, useRemoveMember, useTeamMembers, useTeams } from './useTeams'

const t = messages.teams
const d = t.detail

export function TeamDetailPage() {
  const { teamId = '' } = useParams()
  const teams = useTeams()
  const members = useTeamMembers(teamId)
  const put = usePutMember(teamId)
  const remove = useRemoveMember(teamId)
  const pager = usePagination(members.data ?? [])
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<TeamMember | undefined>()
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const team = teams.data?.find((x) => x.id === teamId)
  const teamName = team?.name ?? t.title
  useDocumentTitle(teamName)
  const memberIds = useMemo(
    () => new Set((members.data ?? []).map((m) => m.userId)),
    [members.data],
  )

  // 404 (unknown team) and 400 (malformed uuid) both mean there is no such team.
  const memberKind = members.isError ? normalizeError(members.error).kind : null
  const notFound = memberKind === 'notFound' || memberKind === 'validation'

  async function toggleLeader(member: TeamMember) {
    if (busyUserId !== null) return
    const wanted = !member.isLeader
    setBusyUserId(member.userId)
    try {
      await put.mutateAsync({ userId: member.userId, isLeader: wanted })
      toast.success(
        fillMessage(wanted ? t.toast.leaderSet : t.toast.leaderUnset, { name: member.name }),
      )
    } catch (error) {
      toast.error(memberPutMessage(error, wanted))
    } finally {
      setBusyUserId(null)
    }
  }

  async function confirmRemove() {
    if (!removing || remove.isPending) return
    const member = removing
    try {
      const result = await remove.mutateAsync(member.userId)
      const count = result.removedAssignments.length
      toast.success(
        fillMessage(count > 0 ? t.toast.memberRemovedWithAssignments : t.toast.memberRemoved, {
          name: member.name,
          count,
        }),
      )
    } catch (error) {
      toast.error(
        normalizeError(error).kind === 'notFound' ? t.toast.memberGone : errorMessage(error),
      )
    }
    setRemoving(undefined)
  }

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link to={PATHS.teams}>
        <ArrowLeftIcon aria-hidden="true" />
        {d.back}
      </Link>
    </Button>
  )

  if (notFound) {
    return (
      <>
        {back}
        <ErrorState title={d.notFoundTitle} description={d.notFoundDescription} />
      </>
    )
  }

  const data = members.data
  return (
    <>
      {back}
      <PageHeader
        title={teamName}
        description={d.description}
        action={
          <Button className="max-sm:w-full" onClick={() => setAdding(true)} disabled={!data}>
            <UserPlusIcon aria-hidden="true" />
            {d.addMember}
          </Button>
        }
      />
      <div aria-live="polite">
        {members.isPending ? (
          <ListSkeleton rows={3} />
        ) : data === undefined ? (
          <ErrorState
            title={d.loadErrorTitle}
            description={errorMessage(members.error)}
            onRetry={() => void members.refetch()}
            retrying={members.isRefetching}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={d.emptyTitle}
            description={d.emptyDescription}
            action={<Button onClick={() => setAdding(true)}>{d.addMember}</Button>}
          />
        ) : (
          <>
            <MemberTable
              members={pager.pageItems}
              busyUserId={busyUserId}
              onToggleLeader={(m) => void toggleLeader(m)}
              onRemove={setRemoving}
            />
            <MemberCards
              members={pager.pageItems}
              busyUserId={busyUserId}
              onToggleLeader={(m) => void toggleLeader(m)}
              onRemove={setRemoving}
            />
            <Pagination {...pager} />
          </>
        )}
      </div>
      <AddMemberDialog
        open={adding}
        onOpenChange={setAdding}
        teamId={teamId}
        memberIds={memberIds}
      />
      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoving(undefined)
        }}
        title={
          removing
            ? fillMessage(t.confirmRemove.title, { name: removing.name, team: teamName })
            : ''
        }
        description={
          removing
            ? fillMessage(t.confirmRemove.description, { name: removing.name, team: teamName })
            : null
        }
        confirmLabel={t.confirmRemove.action}
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmRemove()}
      />
    </>
  )
}
