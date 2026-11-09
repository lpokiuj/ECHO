import { Outlet, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { AssignPage } from '@/features/assign/AssignPage'
import { AttendancePage } from '@/features/attendance/AttendancePage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ErrorPage } from '@/features/errors/ErrorPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { FullSchedulePage } from '@/features/schedule/FullSchedulePage'
import { MySchedulePage } from '@/features/schedule/MySchedulePage'
import { ServicesPage } from '@/features/services/ServicesPage'
import { TeamDetailPage } from '@/features/teams/TeamDetailPage'
import { TeamsPage } from '@/features/teams/TeamsPage'
import { UsersPage } from '@/features/users/UsersPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import {
  PublicOnly,
  RequireAuth,
  RequireLeader,
  RequireRole,
  RequirePasswordChange,
} from './guards'
import { messages } from '@/lib/messages'
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
              { path: PATHS.attendance.slice(1), element: <AttendancePage /> },
              {
                element: <RequireRole roles={['ADMIN', 'PEMBINA']} />,
                children: [{ path: PATHS.services.slice(1), element: <ServicesPage /> }],
              },
              {
                element: (
                  <RequireRole
                    roles={['ADMIN']}
                    noAccessTitle={messages.users.noAccessTitle}
                    noAccessDescription={messages.users.noAccessDescription}
                  />
                ),
                children: [{ path: PATHS.users.slice(1), element: <UsersPage /> }],
              },
              {
                element: (
                  <RequireRole
                    roles={['ADMIN']}
                    noAccessTitle={messages.teams.noAccessTitle}
                    noAccessDescription={messages.teams.noAccessDescription}
                  />
                ),
                children: [
                  { path: PATHS.teams.slice(1), element: <TeamsPage /> },
                  { path: `${PATHS.teams.slice(1)}/:teamId`, element: <TeamDetailPage /> },
                ],
              },
              {
                element: <RequireLeader />,
                children: [{ path: PATHS.assign.slice(1), element: <AssignPage /> }],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]

// Keep Vite's trailing slash ("/volunteer-portal/"): home is then "/volunteer-portal/", which the
// dev and preview servers can serve on a hard refresh ("/volunteer-portal" is a 404 there).
export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })
