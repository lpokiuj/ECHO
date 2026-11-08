import type { ServiceSchedule } from '@/api/types'
import { useMe } from '@/features/auth/useMe'

/** True when the logged-in user is in the service's assignments. */
export function useIsAssigned(service: ServiceSchedule): boolean {
  const me = useMe()
  return service.assignments.some((a) => a.userId === me.data?.id)
}
