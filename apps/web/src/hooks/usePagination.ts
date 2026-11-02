import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/** Rows per page on every list. */
export const PAGE_SIZE = 10
const PAGE_PARAM = 'page'

export interface Pagination<T> {
  /** Current page, 1-based, always within [1, totalPages]. */
  page: number
  pageItems: T[]
  totalPages: number
  totalItems: number
  setPage: (page: number) => void
}

/**
 * Client-side pagination (the API has no pagination). The page lives in the URL as `?page=N`
 * (page 1 is omitted). Invalid or out-of-range values are clamped, so removing the last row
 * of the last page lands on the new last page. When `resetKey` changes (a filter), the page
 * goes back to 1.
 */
export function usePagination<T>(
  items: readonly T[],
  options: { pageSize?: number; resetKey?: unknown } = {},
): Pagination<T> {
  const { pageSize = PAGE_SIZE, resetKey } = options
  const [params, setParams] = useSearchParams()
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const raw = Number.parseInt(params.get(PAGE_PARAM) ?? '', 10)
  const page = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), totalPages) : 1

  const setPage = useCallback(
    (next: number) => {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current)
          if (next <= 1) copy.delete(PAGE_PARAM)
          else copy.set(PAGE_PARAM, String(next))
          return copy
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const previousKey = useRef(resetKey)
  useEffect(() => {
    if (previousKey.current !== resetKey) {
      previousKey.current = resetKey
      setPage(1)
    }
  }, [resetKey, setPage])

  const start = (page - 1) * pageSize
  return { page, pageItems: items.slice(start, start + pageSize), totalPages, totalItems, setPage }
}
