import { ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { Team } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { ListCard } from '@/components/ListCard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMe } from '@/features/auth/useMe'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'
import { TeamFormDialog } from './TeamFormDialog'
import { useDeleteTeam, useTeams } from './useTeams'

const t = messages.teams

function TeamLink({ team }: { team: Team }) {
  return (
    <Link
      to={PATHS.team(team.id)}
      aria-label={`${t.openAria}: ${team.name}`}
      className="focus-visible:ring-ring/50 hover:text-primary flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md font-medium outline-none focus-visible:ring-3"
    >
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
        <UsersIcon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 text-base break-words">{team.name}</span>
      <ChevronRightIcon
        className="text-muted-foreground ml-auto size-4 shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
}

interface Actions {
  onRename: (team: Team) => void
  /** Present only for ADMIN. */
  onDelete?: (team: Team) => void
}

function RowActions({ team, onRename, onDelete }: Actions & { team: Team }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.renameAria}: ${team.name}`}
        onClick={() => onRename(team)}
      >
        <PencilIcon />
      </Button>
      {onDelete ? (
        <Button
          variant="outline"
          size="icon"
          aria-label={`${t.deleteAria}: ${team.name}`}
          onClick={() => onDelete(team)}
        >
          <Trash2Icon />
        </Button>
      ) : null}
    </div>
  )
}

function TeamTable({ teams, ...actions }: { teams: Team[] } & Actions) {
  return (
    <div className="hidden md:block" data-testid="teams-table">
      <Table aria-label={t.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.team}</TableHead>
            <TableHead>{t.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
              <TableCell className="whitespace-normal">
                <TeamLink team={team} />
              </TableCell>
              <TableCell>
                <RowActions team={team} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TeamCards({ teams, ...actions }: { teams: Team[] } & Actions) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabel}
      data-testid="teams-cards"
    >
      {teams.map((team) => (
        <li key={team.id}>
          <ListCard
            title={<TeamLink team={team} />}
            actions={<RowActions team={team} {...actions} />}
          />
        </li>
      ))}
    </ul>
  )
}

export function TeamsPage() {
  useDocumentTitle(t.title)
  const { data, isPending, isError, error, refetch, isRefetching } = useTeams()
  const pager = usePagination(data ?? [])
  const [formOpen, setFormOpen] = useState(false)
  const [renaming, setRenaming] = useState<Team | undefined>()
  const [deleting, setDeleting] = useState<Team | undefined>()
  const me = useMe()
  const remove = useDeleteTeam()
  const onDelete = me.data?.role === 'ADMIN' ? setDeleting : undefined

  async function confirmDelete() {
    if (!deleting || remove.isPending) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(t.toast.deleted)
    } catch (error) {
      toast.error(normalizeError(error).kind === 'notFound' ? t.toast.gone : errorMessage(error))
    }
    setDeleting(undefined)
  }

  const openCreate = () => {
    setRenaming(undefined)
    setFormOpen(true)
  }
  const openRename = (team: Team) => {
    setRenaming(team)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Button className="max-sm:w-full" onClick={openCreate}>
            <PlusIcon aria-hidden="true" />
            {t.addTeam}
          </Button>
        }
      />
      <div aria-live="polite">
        {isPending ? (
          <ListSkeleton rows={4} />
        ) : data === undefined ? (
          <ErrorState
            title={t.loadErrorTitle}
            description={isError ? errorMessage(error) : undefined}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={openCreate}>{t.addTeam}</Button>}
          />
        ) : (
          <>
            <TeamTable teams={pager.pageItems} onRename={openRename} onDelete={onDelete} />
            <TeamCards teams={pager.pageItems} onRename={openRename} onDelete={onDelete} />
            <Pagination {...pager} />
          </>
        )}
      </div>
      <TeamFormDialog open={formOpen} onOpenChange={setFormOpen} team={renaming} />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title={t.confirmDelete.title}
        description={
          deleting ? (
            <>
              <strong className="break-words">{deleting.name}</strong>
              <br />
              {t.confirmDelete.description}
            </>
          ) : null
        }
        confirmLabel={t.confirmDelete.action}
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
