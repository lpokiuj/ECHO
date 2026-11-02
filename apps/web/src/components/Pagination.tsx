import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Pagination as PaginationState } from '@/hooks/usePagination'
import { messages } from '@/lib/messages'

const t = messages.pagination

/** Previous/next pager. Renders nothing when everything fits on one page. */
export function Pagination({
  page,
  totalPages,
  totalItems,
  setPage,
}: Pick<PaginationState<unknown>, 'page' | 'totalPages' | 'totalItems' | 'setPage'>) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label={t.label}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
      data-testid="pagination"
    >
      <p className="text-muted-foreground text-base" role="status" aria-live="polite">
        {t.status(page, totalPages)} · {t.total(totalItems)}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="max-lg:min-h-11"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
          {t.previous}
        </Button>
        <Button
          variant="outline"
          className="max-lg:min-h-11"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          {t.next}
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
