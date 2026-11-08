import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { ScheduleAssignment, ServiceSchedule } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/features/auth/useMe'
import { AvailabilityToggle } from './AvailabilityToggle'
import { useUpdateNote } from '@/features/assign/useAssign'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatTimeRange, hasEnded, isFuture } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { IncludePastToggle } from './IncludePastToggle'
import { ScheduleBody } from './ScheduleBody'
import { useServices } from './useSchedule'

const t = messages.schedule
const NOTE_MAX = 1000

interface TeamGroup {
  teamId: string
  teamName: string
  members: ScheduleAssignment[]
}

/** Groups assignments by team, keeping the API order (teamName, then name). */
function groupByTeam(assignments: ScheduleAssignment[]): TeamGroup[] {
  const groups: TeamGroup[] = []
  for (const a of assignments) {
    const last = groups.find((g) => g.teamId === a.teamId)
    if (last) last.members.push(a)
    else groups.push({ teamId: a.teamId, teamName: a.teamName, members: [a] })
  }
  return groups
}

interface NoteEditorProps {
  service: ServiceSchedule
  member: ScheduleAssignment
  onDone: () => void
}

function NoteEditor({ service, member, onDone }: NoteEditorProps) {
  const [value, setValue] = useState(member.notes)
  const update = useUpdateNote(service.id, member.teamId)
  const sending = useRef(false)
  const id = `note-edit-${member.userId}`

  async function save(event: FormEvent) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    try {
      await update.mutateAsync({ userId: member.userId, notes: value })
      toast.success(t.noteSaved)
      onDone()
    } catch (error) {
      const e = normalizeError(error)
      if (e.status === 404 && !e.code) {
        toast.error(t.noteAssignmentGone)
        onDone()
      } else toast.error(errorMessage(e))
    } finally {
      sending.current = false
    }
  }

  return (
    <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => void save(e)}>
      <Label htmlFor={id}>{fillMessage(t.noteFieldLabel, { name: member.name })}</Label>
      <Textarea
        id={id}
        value={value}
        maxLength={NOTE_MAX}
        rows={3}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {fillMessage(t.noteCounter, { count: value.length, max: NOTE_MAX })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={update.isPending}>
          {t.noteSave}
        </Button>
        <Button type="button" variant="outline" disabled={update.isPending} onClick={onDone}>
          {messages.common.cancel}
        </Button>
      </div>
    </form>
  )
}

function Person({
  service,
  member,
  canEdit,
}: {
  service: ServiceSchedule
  member: ScheduleAssignment
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  return (
    <li className="py-3 break-words first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <UserAvatar name={member.name} />
        <span className="min-w-0 flex-1 font-medium">
          {member.name}
          {member.isAbsentTaker ? (
            <Badge variant="outline" className="ml-2">
              {messages.assign.taker.badge}
            </Badge>
          ) : null}
        </span>
        {canEdit && !editing ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={fillMessage(t.editNoteAria, { name: member.name })}
            onClick={() => setEditing(true)}
          >
            {t.editNote}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <NoteEditor service={service} member={member} onDone={() => setEditing(false)} />
      ) : member.notes !== '' ? (
        <p className="bg-muted text-foreground border-primary mt-2 rounded-md border-l-4 px-3 py-2 text-base whitespace-pre-wrap sm:ml-13">
          <span className="font-semibold">{t.notesLabel}: </span>
          {member.notes}
        </p>
      ) : null}
    </li>
  )
}

function People({ service }: { service: ServiceSchedule }) {
  const me = useMe()
  const leaderOf = new Set(
    (me.data?.memberships ?? []).filter((m) => m.isLeader).map((m) => m.teamId),
  )
  // Notes can only change before the service starts (the server answers 409 afterwards).
  const editable = isFuture(service.startsAt)
  const groups = groupByTeam(service.assignments)
  if (groups.length === 0) {
    return <p className="text-muted-foreground">{t.noAssignees}</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section
          key={g.teamId}
          aria-label={g.teamName}
          className="overflow-hidden rounded-lg border"
        >
          <div className="bg-muted/60 flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold tracking-wide break-words uppercase">
              {g.teamName}
            </h3>
            <Badge variant="secondary">
              {fillMessage(t.memberCount, { count: g.members.length })}
            </Badge>
          </div>
          <ul className="flex list-none flex-col divide-y px-4 py-3">
            {g.members.map((m) => (
              <Person
                key={m.userId}
                service={service}
                member={m}
                canEdit={editable && leaderOf.has(g.teamId)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function DetailButton({ service }: { service: ServiceSchedule }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`${t.detail} ${service.title}`}>
          {t.detail}
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] overflow-hidden max-sm:max-h-[80dvh] sm:max-h-[calc(100dvh-4rem)] sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="min-w-0 break-words">{service.title}</DialogTitle>
            <EndedBadge service={service} />
          </div>
          <dl className="text-muted-foreground flex flex-col gap-1 text-base">
            <div className="flex items-center gap-2">
              <dt className="sr-only">{t.columns.date}</dt>
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              <dd>{formatDate(service.startsAt)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">{t.columns.time}</dt>
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <dd>{formatTimeRange(service.startsAt, service.endsAt)}</dd>
            </div>
          </dl>
          <DialogDescription>{t.detailDescription}</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 min-h-0 overflow-y-auto px-4">
          <div className="mb-4">
            <AvailabilityToggle service={service} />
          </div>
          <People service={service} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EndedBadge({ service }: { service: ServiceSchedule }) {
  if (hasEnded(service.endsAt)) return <Badge variant="secondary">{t.ended}</Badge>
  return service.unavailable ? <Badge variant="warning">{messages.availability.badge}</Badge> : null
}

function ServiceTable({ services }: { services: ServiceSchedule[] }) {
  return (
    <div className="hidden md:block" data-testid="schedule-table">
      <Table aria-label={t.listLabelFull}>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.service}</TableHead>
            <TableHead>{t.columns.date}</TableHead>
            <TableHead>{t.columns.time}</TableHead>
            <TableHead>{t.columns.detail}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="align-top font-medium whitespace-normal">
                <span className="break-words">{s.title}</span> <EndedBadge service={s} />
              </TableCell>
              <TableCell className="align-top">{formatDate(s.startsAt)}</TableCell>
              <TableCell className="align-top">{formatTimeRange(s.startsAt, s.endsAt)}</TableCell>
              <TableCell className="align-top">
                <DetailButton service={s} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ServiceCards({ services }: { services: ServiceSchedule[] }) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabelFull}
      data-testid="schedule-cards"
    >
      {services.map((s) => (
        <li key={s.id}>
          <Card>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 text-lg font-semibold break-words">{s.title}</h2>
                <EndedBadge service={s} />
              </div>
              <p className="text-muted-foreground text-base">
                {formatDate(s.startsAt)}
                <br />
                {formatTimeRange(s.startsAt, s.endsAt)}
              </p>
              <div>
                <DetailButton service={s} />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function FullSchedulePage() {
  useDocumentTitle(t.fullTitle)
  const [includePast, setIncludePast] = useState(false)
  const query = useServices(includePast)
  return (
    <>
      <PageHeader title={t.fullTitle} description={t.fullDescription} />
      <IncludePastToggle checked={includePast} onCheckedChange={setIncludePast} />
      <ScheduleBody
        query={query}
        includePast={includePast}
        onShowPast={() => setIncludePast(true)}
        emptyTitle={t.emptyFullTitle}
        emptyDescription={t.emptyFullDescription}
      >
        {(services) => (
          <>
            <ServiceTable services={services} />
            <ServiceCards services={services} />
          </>
        )}
      </ScheduleBody>
    </>
  )
}
