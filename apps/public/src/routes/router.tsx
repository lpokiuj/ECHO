import { createBrowserRouter } from 'react-router'
import { SiteLayout } from '@/components/SiteLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PrayerPage } from '@/pages/PrayerPage'
import { VolunteerPage } from '@/pages/VolunteerPage'
import { PATHS } from './paths'

export const routes = [
  {
    path: '/',
    element: <SiteLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: PATHS.prayer.slice(1), element: <PrayerPage /> },
      { path: PATHS.volunteer.slice(1), element: <VolunteerPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
