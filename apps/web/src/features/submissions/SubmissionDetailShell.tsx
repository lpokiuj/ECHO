import { ArrowLeftIcon, SearchXIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'

const t = messages.submissions

interface ShellProps<T> {
  title: string
  description: string
  loadErrorTitle: string
  listPath: string
  query: {
    item: T | undefined
    data: T[] | undefined
    isPending: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
    isRefetching: boolean
  }
  /** The fields and the editor, rendered once the item is loaded. */
  children(item: T): ReactNode
}

/** Shared detail screen: back link, then loading, error, not found or the item. */
export function SubmissionDetailShell<T>({
  title,
  description,
  loadErrorTitle,
  listPath,
  query,
  children,
}: ShellProps<T>) {
  useDocumentTitle(title)
  const { item, data, isPending, isError, error, refetch, isRefetching } = query
  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link to={listPath}>
        <ArrowLeftIcon aria-hidden="true" />
        {t.back}
      </Link>
    </Button>
  )
  return (
    <>
      {back}
      <PageHeader title={title} description={description} />
      <div aria-live="polite">
        {isPending ? (
          <ListSkeleton rows={3} />
        ) : data === undefined ? (
          <ErrorState
            title={loadErrorTitle}
            description={isError ? errorMessage(error) : undefined}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : item === undefined ? (
          <EmptyState
            icon={SearchXIcon}
            title={t.notFoundTitle}
            description={t.notFoundDescription}
            action={
              <Button asChild variant="outline">
                <Link to={listPath}>{t.back}</Link>
              </Button>
            }
          />
        ) : (
          children(item)
        )}
      </div>
    </>
  )
}
