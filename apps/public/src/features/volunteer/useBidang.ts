import { useQuery } from '@tanstack/react-query'
import { getBidang } from '@/api/client'

/** The bidang list for the volunteer form. No retry: a failure just hides the choice. */
export function useBidang() {
  return useQuery({
    queryKey: ['public', 'bidang'],
    queryFn: ({ signal }) => getBidang(signal),
    retry: false,
  })
}
