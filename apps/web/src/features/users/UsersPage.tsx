import { KeyRoundIcon, PencilIcon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { User } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
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
import { useMe } from '@/features/auth/useMe'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { UserFormDialog } from './UserFormDialog'
import { useResetPassword, useUsers } from './useUsers'

const t = messages.users

interface Actions {
  onEdit: (user: User) => void
  onReset: (user: User) => void
}

function StatusBadges({ user, isSelf }: { user: User; isSelf: boolean }) {
  return (
    <>
      <Badge variant={user.isActive ? 'outline' : 'secondary'}>
        {user.isActive ? t.active : t.inactive}
      </Badge>
      {isSelf ? <Badge variant="outline">{t.you}</Badge> : null}
    </>
  )
}

function RowActions({ user, onEdit, onReset }: Actions & { user: User }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.editAria}: ${user.name}`}
        onClick={() => onEdit(user)}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.resetAria}: ${user.name}`}
        onClick={() => onReset(user)}
      >
        <KeyRoundIcon />
      </Button>
    </div>
  )
}

function Identity({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar name={user.name} />
      <div className="min-w-0">
        <p className="text-base font-medium break-words">{user.name}</p>
        <p className="text-muted-foreground text-sm break-all">{user.email}</p>
      </div>
    </div>
  )
}

function UserTable({ users, meId, ...actions }: { users: User[]; meId?: string } & Actions) {
  return (
    <div className="hidden md:block" data-testid="users-table">
      <Table aria-label={t.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.user}</TableHead>
            <TableHead>{t.columns.role}</TableHead>
            <TableHead>{t.columns.status}</TableHead>
            <TableHead>{t.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="whitespace-normal">
                <Identity user={u} />
              </TableCell>
              <TableCell>
                <RoleBadge role={u.role} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <StatusBadges user={u} isSelf={u.id === meId} />
                </div>
              </TableCell>
              <TableCell>
                <RowActions user={u} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function UserCards({ users, meId, ...actions }: { users: User[]; meId?: string } & Actions) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabel}
      data-testid="users-cards"
    >
      {users.map((u) => (
        <li key={u.id}>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Identity user={u} />
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={u.role} />
                <StatusBadges user={u} isSelf={u.id === meId} />
              </div>
              <RowActions user={u} {...actions} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function UsersPage() {
  useDocumentTitle(t.title)
  const query = useUsers()
  const me = useMe()
  const reset = useResetPassword()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | undefined>()
  const [resetting, setResetting] = useState<User | undefined>()

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }
  const openEdit = (user: User) => {
    setEditing(user)
    setFormOpen(true)
  }

  async function confirmReset() {
    if (!resetting || reset.isPending) return
    try {
      await reset.mutateAsync(resetting.id)
      toast.success(t.toast.reset)
    } catch (error) {
      const notFound = normalizeError(error).kind === 'notFound'
      toast.error(notFound ? t.toast.gone : errorMessage(error))
    }
    setResetting(undefined)
  }

  const { data, isPending, isError, error, refetch, isRefetching } = query
  const meId = me.data?.id
  const pager = usePagination(data ?? [])

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Button className="max-sm:w-full" onClick={openCreate}>
            <UserPlusIcon aria-hidden="true" />
            {t.add}
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
            action={<Button onClick={openCreate}>{t.add}</Button>}
          />
        ) : (
          <>
            <UserTable
              users={pager.pageItems}
              meId={meId}
              onEdit={openEdit}
              onReset={setResetting}
            />
            <UserCards
              users={pager.pageItems}
              meId={meId}
              onEdit={openEdit}
              onReset={setResetting}
            />
            <Pagination {...pager} />
          </>
        )}
      </div>
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} meId={meId} />
      <ConfirmDialog
        open={resetting !== undefined}
        onOpenChange={(open) => {
          if (!open) setResetting(undefined)
        }}
        title={t.confirmReset.title}
        description={
          resetting ? (
            <>
              <strong className="break-words">{resetting.name}</strong>
              <br />
              {t.confirmReset.description}
            </>
          ) : null
        }
        confirmLabel={t.confirmReset.action}
        destructive
        pending={reset.isPending}
        onConfirm={() => void confirmReset()}
      />
    </>
  )
}
