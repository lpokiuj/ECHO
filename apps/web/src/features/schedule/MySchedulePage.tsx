import { useState } from 'react'
import type { MyScheduleItem } from '@/api/types'
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
import { useMySchedule } from './useSchedule'

const t = messages.schedule

function EndedBadge({ item }: { item: MyScheduleItem }) {
  return hasEnded(item.endsAt) ? <Badge variant="secondary">{t.ended}</Badge> : null
}

function ItemTable({ items }: { items: MyScheduleItem[] }) {
  return (
    <div className="hidden md:block" data-testid="schedule-table">
      <Table aria-label={t.listLabelMine}>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.service}</TableHead>
            <TableHead>{t.columns.date}</TableHead>
            <TableHead>{t.columns.time}</TableHead>
            <TableHead>{t.columns.team}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.serviceId}>
              <TableCell className="font-medium whitespace-normal">
                <span className="break-words">{s.title}</span> <EndedBadge item={s} />
              </TableCell>
              <TableCell>{formatDate(s.startsAt)}</TableCell>
              <TableCell>{formatTimeRange(s.startsAt, s.endsAt)}</TableCell>
              <TableCell>
                <Badge variant="outline">{s.teamName}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ItemCards({ items }: { items: MyScheduleItem[] }) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={t.listLabelMine}
      data-testid="schedule-cards"
    >
      {items.map((s) => (
        <li key={s.serviceId}>
          <Card>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 text-lg font-semibold break-words">{s.title}</h2>
                <EndedBadge item={s} />
              </div>
              <p className="text-muted-foreground text-base">
                {formatDate(s.startsAt)}
                <br />
                {formatTimeRange(s.startsAt, s.endsAt)}
              </p>
              <p className="flex items-center gap-2 text-base">
                <span className="text-muted-foreground">{t.team}:</span>
                <Badge variant="outline">{s.teamName}</Badge>
              </p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function MySchedulePage() {
  useDocumentTitle(t.myTitle)
  const [includePast, setIncludePast] = useState(false)
  const query = useMySchedule(includePast)
  return (
    <>
      <PageHeader title={t.myTitle} description={t.myDescription} />
      <IncludePastToggle checked={includePast} onCheckedChange={setIncludePast} />
      <ScheduleBody
        query={query}
        includePast={includePast}
        onShowPast={() => setIncludePast(true)}
        emptyTitle={t.emptyMineTitle}
        emptyDescription={t.emptyMineDescription}
      >
        {(items) => (
          <>
            <ItemTable items={items} />
            <ItemCards items={items} />
          </>
        )}
      </ScheduleBody>
    </>
  )
}
