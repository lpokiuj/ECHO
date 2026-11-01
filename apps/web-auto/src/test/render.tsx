import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { queryClient } from '@/api/queryClient'
import { setToken } from '@/api/session'
import { routes } from '@/routes/router'

/** Renders the real route tree. `token` stands in for a logged-in session. */
export function renderApp(path: string, options: { token?: boolean } = {}) {
  if (options.token) setToken('<accessToken>')
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, ...view }
}
