import { useState } from 'react'
import type { ScheduleAssignment, ServiceSchedule } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
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
    return <span className="text-muted-foreground">{t.noAssignees}</span>
  }
  return (
    <ul className="flex flex-col gap-1">
      {groups.map((g) => (
        <li key={g.teamId} className="break-words">
          <span className="font-medium">{g.teamName}:</span> {g.names.join(', ')}
        </li>
      ))}
    </ul>
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
            <TableHead>{t.columns.people}</TableHead>
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
              <TableCell className="align-top whitespace-normal">
                <People service={s} />
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
              <People service={s} />
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
