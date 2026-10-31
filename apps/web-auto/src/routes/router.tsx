import { createBrowserRouter } from 'react-router'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'

export const router = createBrowserRouter([{ path: '/', element: <PlaceholderPage /> }])
