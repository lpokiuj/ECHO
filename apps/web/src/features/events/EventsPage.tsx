import {
  CalendarHeartIcon,
  CalendarIcon,
  CalendarPlusIcon,
  ClockIcon,
  MapPinIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { EventItem } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListCard, MetaItem } from '@/components/ListCard'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatTime, hasEnded } from '@/lib/dates'
import { messages } from '@/lib/messages'
import { EventFormDialog } from './EventFormDialog'
import { useDeleteEvent, useEvents } from './useEvents'

const t = messages.events

interface RowActionsProps {
  event: EventItem
  onEdit: (event: EventItem) => void
  onDelete: (event: EventItem) => void
}

function RowActions({ event, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.editAria}: ${event.title}`}
        onClick={() => onEdit(event)}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.deleteAria}: ${event.title}`}
        onClick={() => onDelete(event)}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

function PastBadge({ event }: { event: EventItem }) {
  return hasEnded(event.startsAt) ? <Badge variant="secondary">{t.past}</Badge> : null
}

type Actions = Omit<RowActionsProps, 'event'>

function EventTable({ events, ...actions }: { events: EventItem[] } & Actions) {
  return (
    <div className="hidden md:block" data-testid="events-table">
      <Table aria-label={t.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.event}</TableHead>
            <TableHead>{t.columns.date}</TableHead>
            <TableHead>{t.columns.time}</TableHead>
            <TableHead>{t.columns.location}</TableHead>
            <TableHead>{t.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium whitespace-normal">
                <span className="break-words">{e.title}</span> <PastBadge event={e} />
              </TableCell>
              <TableCell>{formatDate(e.startsAt)}</TableCell>
              <TableCell>{formatTime(e.startsAt)}</TableCell>
              <TableCell className="whitespace-normal">
                <span className="break-words">{e.location}</span>
              </TableCell>
              <TableCell>
                <RowActions event={e} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EventCards({ events, ...actions }: { events: EventItem[] } & Actions) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabel}
      data-testid="events-cards"
    >
      {events.map((e) => (
        <li key={e.id}>
          <ListCard
            title={<h2 className="text-lg font-semibold break-words">{e.title}</h2>}
            badges={<PastBadge event={e} />}
            meta={
              <>
                <MetaItem icon={CalendarIcon}>{formatDate(e.startsAt)}</MetaItem>
                <MetaItem icon={ClockIcon}>{formatTime(e.startsAt)}</MetaItem>
                <MetaItem icon={MapPinIcon}>{e.location}</MetaItem>
              </>
            }
            actions={<RowActions event={e} {...actions} />}
          />
        </li>
      ))}
    </ul>
  )
}

export function EventsPage() {
  useDocumentTitle(t.title)
  const query = useEvents()
  const { data, isPending, isError, error, refetch, isRefetching } = query
  const pager = usePagination(data ?? [])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventItem | undefined>()
  const [deleting, setDeleting] = useState<EventItem | undefined>()
  const remove = useDeleteEvent()

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }
  const openEdit = (event: EventItem) => {
    setEditing(event)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting || remove.isPending) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(t.toast.deleted)
    } catch (e) {
      toast.error(errorMessage(e))
    }
    setDeleting(undefined)
  }

  const addButton = (
    <Button className="max-sm:w-full" onClick={openCreate}>
      <CalendarPlusIcon aria-hidden="true" />
      {t.add}
    </Button>
  )

  return (
    <>
      <PageHeader title={t.title} description={t.description} action={addButton} />
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
            icon={CalendarHeartIcon}
            title={t.emptyTitle}
            description={t.emptyDescription}
          />
        ) : (
          <>
            <EventTable events={pager.pageItems} onEdit={openEdit} onDelete={setDeleting} />
            <EventCards events={pager.pageItems} onEdit={openEdit} onDelete={setDeleting} />
            <Pagination {...pager} />
          </>
        )}
      </div>
      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title={t.confirmDelete.title}
        description={
          deleting ? (
            <>
              <strong className="break-words">{deleting.title}</strong>
              <br />
              {formatDate(deleting.startsAt)}, {formatTime(deleting.startsAt)}
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
