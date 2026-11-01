import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { DesignPage } from '@/features/design/DesignPage'
import { ErrorPage } from '@/features/errors/ErrorPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { SessionEvents } from './SessionEvents'

export const routes = [
  {
    path: '/',
    element: (
      <>
        <SessionEvents />
        <AppShell />
      </>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <PlaceholderPage /> },
      // Dev-only (DECISIONS D-003): remove this route and the nav link in feature 10.
      { path: 'design', element: <DesignPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
