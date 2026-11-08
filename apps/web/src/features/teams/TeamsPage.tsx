import { ChevronRightIcon, PencilIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import type { Team } from '@/api/types'
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
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'
import { TeamFormDialog } from './TeamFormDialog'
import { useTeams } from './useTeams'

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

function RenameButton({ team, onRename }: { team: Team; onRename: (team: Team) => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`${t.renameAria}: ${team.name}`}
      onClick={() => onRename(team)}
    >
      <PencilIcon />
    </Button>
  )
}

function TeamTable({ teams, onRename }: { teams: Team[]; onRename: (team: Team) => void }) {
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
                <RenameButton team={team} onRename={onRename} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TeamCards({ teams, onRename }: { teams: Team[]; onRename: (team: Team) => void }) {
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
            inlineAction={<RenameButton team={team} onRename={onRename} />}
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
            <TeamTable teams={pager.pageItems} onRename={openRename} />
            <TeamCards teams={pager.pageItems} onRename={openRename} />
            <Pagination {...pager} />
          </>
        )}
      </div>
      <TeamFormDialog open={formOpen} onOpenChange={setFormOpen} team={renaming} />
    </>
  )
}
