import { Outlet, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { DesignPage } from '@/features/design/DesignPage'
import { ErrorPage } from '@/features/errors/ErrorPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { FullSchedulePage } from '@/features/schedule/FullSchedulePage'
import { MySchedulePage } from '@/features/schedule/MySchedulePage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { PublicOnly, RequireAuth, RequirePasswordChange } from './guards'
import { PATHS } from './paths'
import { SessionEvents } from './SessionEvents'

function Root() {
  return (
    <>
      <SessionEvents />
      <Outlet />
    </>
  )
}

export const routes = [
  {
    path: '/',
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: PATHS.login.slice(1),
        element: (
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        ),
      },
      {
        path: PATHS.changePassword.slice(1),
        element: (
          <RequirePasswordChange>
            <ChangePasswordPage />
          </RequirePasswordChange>
        ),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <PlaceholderPage /> },
              { path: PATHS.mySchedule.slice(1), element: <MySchedulePage /> },
              { path: PATHS.fullSchedule.slice(1), element: <FullSchedulePage /> },
              // Dev-only (DECISIONS D-003): remove this route and the nav link in feature 10.
              { path: 'design', element: <DesignPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
