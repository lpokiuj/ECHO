import { CalendarCheckIcon } from 'lucide-react'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Section } from '@/components/Section'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { useMyAbsences } from './useAttendance'

const t = messages.attendance.mine

/** The caller's own recorded absences (GET /me/absences). */
export function MyAbsencesCard() {
  const q = useMyAbsences()
  return (
    <Section
      id="att-mine"
      title={t.title}
      action={
        q.data ? (
          <Badge variant="info" data-testid="my-absence-count">
            {fillMessage(t.count, { count: q.data.count })}
          </Badge>
        ) : undefined
      }
      className="mb-6"
    >
      <div aria-live="polite">
        {q.isPending ? (
          <ListSkeleton rows={2} />
        ) : q.data === undefined ? (
          <ErrorState
            title={t.errorTitle}
            description={errorMessage(q.error)}
            onRetry={() => void q.refetch()}
            retrying={q.isRefetching}
          />
        ) : q.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarCheckIcon}
            title={t.emptyTitle}
            description={t.emptyDescription}
          />
        ) : (
          <ul aria-label={t.listLabel} className="flex flex-col divide-y">
            {q.data.items.map((item) => (
              <li
                key={item.serviceId}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 font-medium break-words">{item.title}</span>
                <span className="text-muted-foreground">{formatDate(item.startsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}
