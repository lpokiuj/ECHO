import { useQuery } from '@tanstack/react-query'
import { getMe } from '@/api/client'
import { getToken } from '@/api/session'

export const ME_KEY = ['me'] as const

/** GET /me, cached. The one source for role and leader memberships. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: getMe,
    enabled: getToken() !== null,
    staleTime: 60_000,
    retry: false,
  })
}
