import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { queryClient } from '@/api/queryClient'
import { subscribe } from '@/api/session'
import { PATHS } from './paths'

/** Bridges session events (401, password change required) to the router. Renders nothing. */
export function SessionEvents() {
  const navigate = useNavigate()

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === 'unauthorized') {
          queryClient.clear()
          void navigate(PATHS.login, { replace: true })
        } else {
          void navigate(PATHS.changePassword, { replace: true })
        }
      }),
    [navigate],
  )

  return null
}
