import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { usePagination } from './usePagination'

const items = Array.from({ length: 25 }, (_, i) => i + 1)

function setup(url: string, resetKey?: unknown) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  )
  return renderHook(
    ({ key }: { key?: unknown }) => ({
      pager: usePagination(items, { resetKey: key }),
      search: useLocation().search,
    }),
    { wrapper, initialProps: { key: resetKey } },
  )
}

describe('usePagination', () => {
  it('slices 10 per page', () => {
    const { result } = setup('/')
    expect(result.current.pager.totalPages).toBe(3)
    expect(result.current.pager.totalItems).toBe(25)
    expect(result.current.pager.pageItems).toEqual(items.slice(0, 10))
  })

  it('reads the page from the URL and omits page 1', () => {
    const { result } = setup('/?page=3')
    expect(result.current.pager.pageItems).toEqual([21, 22, 23, 24, 25])
    act(() => result.current.pager.setPage(2))
    expect(result.current.search).toBe('?page=2')
    act(() => result.current.pager.setPage(1))
    expect(result.current.search).toBe('')
  })

  it.each(['0', '-4', 'abc', '', '99'])('clamps page=%s', (raw) => {
    const { result } = setup(`/?page=${raw}`)
    const expected = raw === '99' ? 3 : 1
    expect(result.current.pager.page).toBe(expected)
  })

  it('returns to page 1 when the reset key changes', () => {
    const { result, rerender } = setup('/?page=2', false)
    expect(result.current.pager.page).toBe(2)
    rerender({ key: true })
    expect(result.current.pager.page).toBe(1)
    expect(result.current.search).toBe('')
  })
})
