import type { UseQueryResult } from '@tanstack/react-query'
import { CalendarOffIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { messages } from '@/lib/messages'

interface ScheduleBodyProps<T> {
  query: UseQueryResult<T[]>
  includePast: boolean
  onShowPast: () => void
  emptyTitle: string
  emptyDescription: string
  children: (items: T[]) => ReactNode
}

/** Loading, error with retry, empty, and data states shared by both schedule pages. */
export function ScheduleBody<T>({
  query,
  includePast,
  onShowPast,
  emptyTitle,
  emptyDescription,
  children,
}: ScheduleBodyProps<T>) {
  const { data, isPending, isError, error, refetch, isRefetching } = query
  const pager = usePagination(data ?? [], { resetKey: includePast })
  return (
    <div aria-live="polite">
      {isPending ? (
        <ListSkeleton rows={4} />
      ) : data === undefined ? (
        <ErrorState
          title={messages.schedule.loadErrorTitle}
          description={isError ? errorMessage(error) : messages.schedule.loadErrorDescription}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={CalendarOffIcon}
          title={includePast ? messages.schedule.emptyPastTitle : emptyTitle}
          description={includePast ? messages.schedule.emptyPastDescription : emptyDescription}
          action={
            includePast ? undefined : (
              <Button variant="outline" onClick={onShowPast}>
                {messages.schedule.emptyShowPast}
              </Button>
            )
          }
        />
      ) : (
        <>
          {children(pager.pageItems)}
          <Pagination {...pager} />
        </>
      )}
    </div>
  )
}
