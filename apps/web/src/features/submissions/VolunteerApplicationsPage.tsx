import { CalendarIcon, ClipboardListIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { VolunteerApplication } from '@/api/types'
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
import { VOLUNTEER_STATUSES } from './submissionStatus'
import { useVolunteerApplications } from './useSubmissions'

const t = messages.submissions
const v = t.volunteer

function DetailLink({ a }: { a: VolunteerApplication }) {
  return (
    <Button asChild variant="outline" size="sm" className="max-lg:min-h-11">
      <Link to={PATHS.volunteerApplication(a.id)} aria-label={`${v.detailAria}: ${a.fullName}`}>
        {t.detail}
      </Link>
    </Button>
  )
}

function ApplicationTable({ items }: { items: VolunteerApplication[] }) {
  return (
    <div className="hidden md:block" data-testid="volunteer-table">
      <Table aria-label={v.listLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{v.columns.name}</TableHead>
            <TableHead>{v.columns.whatsapp}</TableHead>
            <TableHead>{v.columns.status}</TableHead>
            <TableHead>{v.columns.date}</TableHead>
            <TableHead>{v.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium whitespace-normal break-words">{a.fullName}</TableCell>
              <TableCell>{a.whatsapp}</TableCell>
              <TableCell>
                <StatusBadge status={a.status} />
              </TableCell>
              <TableCell>{formatDate(a.createdAt)}</TableCell>
              <TableCell>
                <DetailLink a={a} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ApplicationCards({ items }: { items: VolunteerApplication[] }) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={v.listLabel}
      data-testid="volunteer-cards"
    >
      {items.map((a) => (
        <li key={a.id}>
          <ListCard
            title={<p className="text-base font-medium break-words">{a.fullName}</p>}
            badges={<StatusBadge status={a.status} />}
            meta={
              <>
                <MetaItem icon={CalendarIcon}>{formatDate(a.createdAt)}</MetaItem>
                <span className="break-all">{a.whatsapp}</span>
              </>
            }
            actions={<DetailLink a={a} />}
          />
        </li>
      ))}
    </ul>
  )
}

export function VolunteerApplicationsPage() {
  return (
    <SubmissionListShell
      title={v.title}
      description={v.description}
      loadErrorTitle={v.loadErrorTitle}
      emptyTitle={v.emptyTitle}
      emptyDescription={v.emptyDescription}
      emptyFilteredTitle={v.emptyFilteredTitle}
      emptyFilteredDescription={v.emptyFilteredDescription}
      icon={ClipboardListIcon}
      statuses={VOLUNTEER_STATUSES}
      useList={useVolunteerApplications}
      renderTable={(items) => <ApplicationTable items={items} />}
      renderCards={(items) => <ApplicationCards items={items} />}
    />
  )
}
