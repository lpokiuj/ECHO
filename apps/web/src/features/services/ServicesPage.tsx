import { CalendarPlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { ServiceSchedule } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
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
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { IncludePastToggle } from '@/features/schedule/IncludePastToggle'
import { ScheduleBody } from '@/features/schedule/ScheduleBody'
import { useServices } from '@/features/schedule/useSchedule'
import { formatDate, formatTimeRange, hasEnded } from '@/lib/dates'
import { messages } from '@/lib/messages'
import { ServiceFormDialog } from './ServiceFormDialog'
import { useDeleteService } from './useServiceMutations'

const t = messages.services

interface RowActionsProps {
  service: ServiceSchedule
  onEdit: (service: ServiceSchedule) => void
  onDelete: (service: ServiceSchedule) => void
}

function RowActions({ service, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.editAria}: ${service.title}`}
        onClick={() => onEdit(service)}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={`${t.deleteAria}: ${service.title}`}
        onClick={() => onDelete(service)}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

function EndedBadge({ service }: { service: ServiceSchedule }) {
  return hasEnded(service.endsAt) ? (
    <Badge variant="secondary">{messages.schedule.ended}</Badge>
  ) : null
}

function ServiceTable({
  services,
  ...actions
}: { services: ServiceSchedule[] } & Omit<RowActionsProps, 'service'>) {
  return (
    <div className="hidden md:block" data-testid="services-table">
      <Table aria-label={t.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.service}</TableHead>
            <TableHead>{t.columns.date}</TableHead>
            <TableHead>{t.columns.time}</TableHead>
            <TableHead>{t.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium whitespace-normal">
                <span className="break-words">{s.title}</span> <EndedBadge service={s} />
              </TableCell>
              <TableCell>{formatDate(s.startsAt)}</TableCell>
              <TableCell>{formatTimeRange(s.startsAt, s.endsAt)}</TableCell>
              <TableCell>
                <RowActions service={s} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ServiceCards({
  services,
  ...actions
}: { services: ServiceSchedule[] } & Omit<RowActionsProps, 'service'>) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabel}
      data-testid="services-cards"
    >
      {services.map((s) => (
        <li key={s.id}>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 text-lg font-semibold break-words">{s.title}</h2>
                <EndedBadge service={s} />
              </div>
              <p className="text-muted-foreground text-base">
                {formatDate(s.startsAt)}
                <br />
                {formatTimeRange(s.startsAt, s.endsAt)}
              </p>
              <RowActions service={s} {...actions} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function ServicesPage() {
  useDocumentTitle(t.title)
  const [includePast, setIncludePast] = useState(false)
  const query = useServices(includePast)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceSchedule | undefined>()
  const [deleting, setDeleting] = useState<ServiceSchedule | undefined>()
  const remove = useDeleteService()

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }
  const openEdit = (service: ServiceSchedule) => {
    setEditing(service)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting || remove.isPending) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(t.toast.deleted)
    } catch (error) {
      toast.error(errorMessage(error))
    }
    setDeleting(undefined)
  }

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Button className="max-sm:w-full" onClick={openCreate}>
            <CalendarPlusIcon aria-hidden="true" />
            {t.add}
          </Button>
        }
      />
      <IncludePastToggle checked={includePast} onCheckedChange={setIncludePast} />
      <ScheduleBody
        query={query}
        includePast={includePast}
        onShowPast={() => setIncludePast(true)}
        emptyTitle={t.emptyTitle}
        emptyDescription={t.emptyDescription}
      >
        {(services) => (
          <>
            <ServiceTable services={services} onEdit={openEdit} onDelete={setDeleting} />
            <ServiceCards services={services} onEdit={openEdit} onDelete={setDeleting} />
          </>
        )}
      </ScheduleBody>
      <ServiceFormDialog open={formOpen} onOpenChange={setFormOpen} service={editing} />
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
              {formatDate(deleting.startsAt)}, {formatTimeRange(deleting.startsAt, deleting.endsAt)}
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
