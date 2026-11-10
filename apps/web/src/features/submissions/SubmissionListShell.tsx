import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePagination } from '@/hooks/usePagination'
import { messages } from '@/lib/messages'
import { StatusFilter } from './StatusFilter'
import { parseStatus, type AnyStatus } from './submissionStatus'

interface Query<T> {
  data: T[] | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
  isRefetching: boolean
}

interface ShellProps<T, S extends AnyStatus> {
  title: string
  description: string
  loadErrorTitle: string
  emptyTitle: string
  emptyDescription: string
  emptyFilteredTitle: string
  emptyFilteredDescription: string
  icon: LucideIcon
  statuses: readonly S[]
  /** Called with the parsed `?status=`; returns the query for it. */
  useList(status: S | undefined): Query<T>
  renderTable(items: T[]): ReactNode
  renderCards(items: T[]): ReactNode
}

/** Shared list screen: header, status filter (in `?status=`), states, table/cards, pager. */
export function SubmissionListShell<T, S extends AnyStatus>({
  title,
  description,
  loadErrorTitle,
  emptyTitle,
  emptyDescription,
  emptyFilteredTitle,
  emptyFilteredDescription,
  icon,
  statuses,
  useList,
  renderTable,
  renderCards,
}: ShellProps<T, S>) {
  useDocumentTitle(title)
  const [params, setParams] = useSearchParams()
  const status = parseStatus(params.get('status'), statuses)
  const query = useList(status)
  const pager = usePagination(query.data ?? [], { resetKey: status })

  const setStatus = (next: S | undefined) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        if (next) copy.set('status', next)
        else copy.delete('status')
        copy.delete('page')
        return copy
      },
      { replace: true },
    )

  const { data, isPending, isError, error, refetch, isRefetching } = query
  const Icon = icon
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mb-4">
        <StatusFilter statuses={statuses} value={status} onChange={setStatus} />
      </div>
      <div aria-live="polite">
        {isPending ? (
          <ListSkeleton rows={4} />
        ) : data === undefined ? (
          <ErrorState
            title={loadErrorTitle}
            description={isError ? errorMessage(error) : undefined}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={status ? emptyFilteredTitle : emptyTitle}
            description={status ? emptyFilteredDescription : emptyDescription}
            action={
              status ? (
                <Button variant="outline" onClick={() => setStatus(undefined)}>
                  {messages.submissions.allStatuses}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {renderTable(pager.pageItems)}
            {renderCards(pager.pageItems)}
            <Pagination {...pager} />
          </>
        )}
      </div>
    </>
  )
}
