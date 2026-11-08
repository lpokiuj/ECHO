import { CalendarCheckIcon } from 'lucide-react'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { useMyAbsences } from './useAttendance'

const t = messages.attendance.mine

/** The caller's own recorded absences (GET /me/absences). */
export function MyAbsencesCard() {
  const q = useMyAbsences()
  return (
    <section aria-labelledby="att-mine" className="mb-10">
      <h2 id="att-mine" className="mb-3 flex flex-wrap items-center gap-3 text-xl font-semibold">
        {t.title}
        {q.data ? (
          <Badge variant="info" data-testid="my-absence-count">
            {fillMessage(t.count, { count: q.data.count })}
          </Badge>
        ) : null}
      </h2>
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
          <ul aria-label={t.listLabel} className="flex flex-col divide-y rounded-lg border">
            {q.data.items.map((item) => (
              <li
                key={item.serviceId}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="min-w-0 font-medium break-words">{item.title}</span>
                <span className="text-muted-foreground">{formatDate(item.startsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
