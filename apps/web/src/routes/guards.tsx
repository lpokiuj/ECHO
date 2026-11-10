import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { errorMessage } from '@/api/errors'
import { getToken } from '@/api/session'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserRole } from '@/api/types'
import { useMe } from '@/features/auth/useMe'
import { messages } from '@/lib/messages'
import { PATHS } from './paths'

function FullPageState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center px-4">{children}</div>
}

function SessionSkeleton() {
  return (
    <FullPageState>
      <div role="status" className="w-full max-w-md">
        <span className="sr-only">{messages.auth.sessionLoading}</span>
        <Skeleton className="h-48 w-full" />
      </div>
    </FullPageState>
  )
}

/** Login page: a logged-in visitor is sent on (the auth guards then pick the right page). */
export function PublicOnly({ children }: { children: ReactNode }) {
  if (getToken()) return <Navigate to={PATHS.home} replace />
  return children
}

/** Shared by the two guards below: waits for GET /me, shows an error with retry if it fails. */
function useGuardedMe() {
  const me = useMe()
  if (!getToken()) return { kind: 'redirect' } as const
  if (me.isError) {
    return {
      kind: 'node',
      node: (
        <FullPageState>
          <ErrorState
            title={messages.auth.sessionErrorTitle}
            description={errorMessage(me.error)}
            onRetry={() => void me.refetch()}
            retrying={me.isFetching}
          />
        </FullPageState>
      ),
    } as const
  }
  if (!me.data) return { kind: 'node', node: <SessionSkeleton /> } as const
  return { kind: 'ready', me: me.data } as const
}

/** Everything inside the app shell: needs a session, and no pending password change. */
export function RequireAuth() {
  const guard = useGuardedMe()
  if (guard.kind === 'redirect') return <Navigate to={PATHS.login} replace />
  if (guard.kind === 'node') return guard.node
  if (guard.me.mustChangePassword) return <Navigate to={PATHS.changePassword} replace />
  return <Outlet />
}

/** The forced change page: needs a session and a pending change; otherwise goes home. */
export function RequirePasswordChange({ children }: { children: ReactNode }) {
  const guard = useGuardedMe()
  if (guard.kind === 'redirect') return <Navigate to={PATHS.login} replace />
  if (guard.kind === 'node') return guard.node
  if (!guard.me.mustChangePassword) return <Navigate to={PATHS.home} replace />
  return children
}

/** UX only: hides a page from other roles. The backend still answers 403 to every call. */
export function RequireRole({
  roles,
  noAccessTitle = messages.services.noAccessTitle,
  noAccessDescription = messages.services.noAccessDescription,
  redirectTo,
}: {
  roles: readonly UserRole[]
  noAccessTitle?: string
  noAccessDescription?: string
  /** Send other roles to this path (replace) instead of showing the no-access state. */
  redirectTo?: string
}) {
  const me = useMe()
  if (!me.data) return <Outlet />
  if (roles.includes(me.data.role)) return <Outlet />
  if (redirectTo) return <Navigate to={redirectTo} replace />
  return <ErrorState title={noAccessTitle} description={noAccessDescription} />
}

/** UX only: the assign screen is for users with any isLeader membership. The backend still answers 403. */
export function RequireLeader() {
  const me = useMe()
  if (!me.data) return <Outlet />
  if (me.data.memberships.some((m) => m.isLeader)) return <Outlet />
  return (
    <ErrorState
      title={messages.assign.noAccessTitle}
      description={messages.assign.noAccessDescription}
    />
  )
}
