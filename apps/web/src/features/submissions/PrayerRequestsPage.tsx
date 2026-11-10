import { CalendarIcon, HandHeartIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { PrayerRequest } from '@/api/types'
import { ListCard, MetaItem } from '@/components/ListCard'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import { messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'
import { StatusBadge } from './StatusBadge'
import { SubmissionListShell } from './SubmissionListShell'
import { PRAYER_STATUSES } from './submissionStatus'
import { usePrayerRequests } from './useSubmissions'

const t = messages.submissions
const p = t.prayer

const nameOf = (r: PrayerRequest) => r.name ?? t.noName

function DetailLink({ r }: { r: PrayerRequest }) {
  return (
    <Button asChild variant="outline" size="sm" className="max-lg:min-h-11">
      <Link to={PATHS.prayerRequest(r.id)} aria-label={`${p.detailAria}: ${nameOf(r)}`}>
        {t.detail}
      </Link>
    </Button>
  )
}

function PrayerTable({ items }: { items: PrayerRequest[] }) {
  return (
    <div className="hidden md:block" data-testid="prayer-table">
      <Table aria-label={p.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{p.columns.name}</TableHead>
            <TableHead>{p.columns.content}</TableHead>
            <TableHead>{p.columns.status}</TableHead>
            <TableHead>{p.columns.date}</TableHead>
            <TableHead>{p.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium whitespace-normal break-words">{nameOf(r)}</TableCell>
              <TableCell className="max-w-xs truncate">{r.content}</TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell>{formatDate(r.createdAt)}</TableCell>
              <TableCell>
                <DetailLink r={r} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Cards({ items }: { items: PrayerRequest[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label={p.listLabel} data-testid="prayer-cards">
      {items.map((r) => (
        <li key={r.id}>
          <ListCard
            title={<p className="text-base font-medium break-words">{nameOf(r)}</p>}
            badges={<StatusBadge status={r.status} />}
            meta={<MetaItem icon={CalendarIcon}>{formatDate(r.createdAt)}</MetaItem>}
            actions={<DetailLink r={r} />}
          >
            <p className="line-clamp-2 text-base break-words">{r.content}</p>
          </ListCard>
        </li>
      ))}
    </ul>
  )
}

export function PrayerRequestsPage() {
  return (
    <SubmissionListShell
      title={p.title}
      description={p.description}
      loadErrorTitle={p.loadErrorTitle}
      emptyTitle={p.emptyTitle}
      emptyDescription={p.emptyDescription}
      emptyFilteredTitle={p.emptyFilteredTitle}
      emptyFilteredDescription={p.emptyFilteredDescription}
      icon={HandHeartIcon}
      statuses={PRAYER_STATUSES}
      useList={usePrayerRequests}
      renderTable={(items) => <PrayerTable items={items} />}
      renderCards={(items) => <Cards items={items} />}
    />
  )
}
