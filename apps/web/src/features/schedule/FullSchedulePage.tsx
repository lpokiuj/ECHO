import { useState } from 'react'
import type { ScheduleAssignment, ServiceSchedule } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatTimeRange, hasEnded } from '@/lib/dates'
import { messages } from '@/lib/messages'
import { IncludePastToggle } from './IncludePastToggle'
import { ScheduleBody } from './ScheduleBody'
import { useServices } from './useSchedule'

const t = messages.schedule

interface TeamGroup {
  teamId: string
  teamName: string
  names: string[]
}

/** Groups assignments by team, keeping the API order (teamName, then name). */
function groupByTeam(assignments: ScheduleAssignment[]): TeamGroup[] {
  const groups: TeamGroup[] = []
  for (const a of assignments) {
    const last = groups.find((g) => g.teamId === a.teamId)
    if (last) last.names.push(a.name)
    else groups.push({ teamId: a.teamId, teamName: a.teamName, names: [a.name] })
  }
  return groups
}

function People({ service }: { service: ServiceSchedule }) {
  const groups = groupByTeam(service.assignments)
  if (groups.length === 0) {
    return <p className="text-muted-foreground">{t.noAssignees}</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.teamId} aria-label={g.teamName}>
          <h3 className="font-medium break-words">{g.teamName}</h3>
          <ul className="mt-1 list-disc pl-5">
            {g.names.map((name, i) => (
              <li key={`${i}-${name}`} className="break-words">
                {name}
              </li>
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">{service.title}</DialogTitle>
          <DialogDescription>{t.detailDescription}</DialogDescription>
        </DialogHeader>
        <People service={service} />
      </DialogContent>
    </Dialog>
  )
}

function EndedBadge({ service }: { service: ServiceSchedule }) {
  return hasEnded(service.endsAt) ? <Badge variant="secondary">{t.ended}</Badge> : null
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
