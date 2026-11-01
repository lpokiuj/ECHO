import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { User } from '@/api/types'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { RoleBadge } from '@/components/RoleBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUsers } from '@/features/users/useUsers'
import { fillMessage, messages } from '@/lib/messages'
import { memberPutMessage } from './memberErrors'
import { usePutMember } from './useTeams'

const p = messages.teams.picker

/** Rows rendered at once. With hundreds of users the search narrows the list instead. */
export const PICKER_LIMIT = 50

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  /** User ids already in the team: they are not offered again. */
  memberIds: ReadonlySet<string>
}

export function AddMemberDialog({ open, onOpenChange, teamId, memberIds }: AddMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>{p.description}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: GET /users is fetched on demand and the search resets. */}
        {open ? (
          <Picker teamId={teamId} memberIds={memberIds} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Picker({
  teamId,
  memberIds,
  onDone,
}: {
  teamId: string
  memberIds: ReadonlySet<string>
  onDone: () => void
}) {
  const users = useUsers()
  const put = usePutMember(teamId)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const candidates = useMemo(
    () => (users.data ?? []).filter((u) => !memberIds.has(u.id)),
    [users.data, memberIds],
  )
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [candidates, search])
  const shown = matches.slice(0, PICKER_LIMIT)

  async function add(user: User) {
    if (busyId !== null) return
    setBusyId(user.id)
    setFormError(null)
    try {
      await put.mutateAsync({ userId: user.id, isLeader: false })
      toast.success(fillMessage(messages.teams.toast.memberAdded, { name: user.name }))
      onDone()
    } catch (error) {
      const text = memberPutMessage(error, false)
      setFormError(text)
      toast.error(text)
    } finally {
      setBusyId(null)
    }
  }

  if (users.isPending) return <ListSkeleton rows={3} />
  if (users.data === undefined) {
    return (
      <ErrorState
        title={p.loadError}
        description={errorMessage(users.error)}
        onRetry={() => void users.refetch()}
        retrying={users.isRefetching}
      />
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-search">{p.searchLabel}</Label>
        <div className="relative">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="member-search"
            type="search"
            className="pl-9"
            autoComplete="off"
            aria-describedby="member-search-hint"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p id="member-search-hint" className="text-muted-foreground text-sm">
          {p.searchHint}
        </p>
      </div>
      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
      <div aria-live="polite">
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">{p.allMembers}</p>
        ) : matches.length === 0 ? (
          <p className="text-muted-foreground text-sm">{p.noResults}</p>
        ) : (
          <>
            <ul
              aria-label={p.listLabel}
              className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border"
            >
              {shown.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void add(u)}
                    className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left outline-none focus-visible:ring-3 disabled:opacity-50"
                  >
                    <UserAvatar name={u.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium break-words">{u.name}</span>
                      <span className="text-muted-foreground block text-sm break-all">
                        {u.email}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <RoleBadge role={u.role} />
                        {u.isActive ? null : (
                          <Badge variant="secondary">{messages.teams.detail.inactiveBadge}</Badge>
                        )}
                      </span>
                    </span>
                    <span className="text-primary text-sm font-medium">{p.action}</span>
                  </button>
                </li>
              ))}
            </ul>
            {matches.length > PICKER_LIMIT ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {fillMessage(p.cappedHint, { shown: shown.length, total: matches.length })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
