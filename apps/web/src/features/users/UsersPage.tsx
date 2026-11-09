import { KeyRoundIcon, PencilIcon, Trash2Icon, UserPlusIcon, UsersIcon } from 'lucide-react'
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
import { UserFormDialog } from './UserFormDialog'
import { useDeleteUser, useResetPassword, useUsers } from './useUsers'

const t = messages.users

interface Actions {
  onEdit: (user: User) => void
  onReset: (user: User) => void
  /** Present only for ADMIN; the own account never gets a delete button. */
  onDelete?: (user: User) => void
  meId?: string
}

function StatusBadges({ user, isSelf }: { user: User; isSelf: boolean }) {
  return (
    <>
      <Badge variant={user.isActive ? 'success' : 'secondary'}>
        {user.isActive ? t.active : t.inactive}
      </Badge>
      {isSelf ? <Badge variant="outline">{t.you}</Badge> : null}
    </>
  )
}

function RowActions({ user, onEdit, onReset, onDelete, meId }: Actions & { user: User }) {
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
      {onDelete && user.id !== meId ? (
        <Button
          variant="outline"
          size="icon"
          aria-label={`${t.deleteAria}: ${user.name}`}
          onClick={() => onDelete(user)}
        >
          <Trash2Icon />
        </Button>
      ) : null}
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

function UserTable({ users, ...actions }: { users: User[] } & Actions) {
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
                  <StatusBadges user={u} isSelf={u.id === actions.meId} />
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

function UserCards({ users, ...actions }: { users: User[] } & Actions) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabel}
      data-testid="users-cards"
    >
      {users.map((u) => (
        <li key={u.id}>
          <ListCard
            title={<Identity user={u} />}
            meta={
              <>
                <RoleBadge role={u.role} />
                <StatusBadges user={u} isSelf={u.id === actions.meId} />
              </>
            }
            actions={<RowActions user={u} {...actions} />}
          />
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
  const remove = useDeleteUser()
  const [deleting, setDeleting] = useState<User | undefined>()
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

  async function confirmDelete() {
    if (!deleting || remove.isPending) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(t.toast.deleted)
    } catch (error) {
      const e = normalizeError(error)
      // Only the own account answers a 400 without a code, and the button is hidden for it.
      if (e.kind === 'notFound') toast.error(t.toast.gone)
      else if (e.kind === 'validation' && !e.code) toast.error(t.toast.cannotDeleteSelf)
      else toast.error(errorMessage(error))
    }
    setDeleting(undefined)
  }

  const { data, isPending, isError, error, refetch, isRefetching } = query
  const meId = me.data?.id
  const onDelete = me.data?.role === 'ADMIN' ? setDeleting : undefined
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
              onDelete={onDelete}
            />
            <UserCards
              users={pager.pageItems}
              meId={meId}
              onEdit={openEdit}
              onReset={setResetting}
              onDelete={onDelete}
            />
            <Pagination {...pager} />
          </>
        )}
      </div>
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} meId={meId} />
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
