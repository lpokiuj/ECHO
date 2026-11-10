import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deletePrayerRequest,
  deleteVolunteerApplication,
  getPrayerRequests,
  getSubmissionCounts,
  getVolunteerApplications,
  updatePrayerRequest,
  updateVolunteerApplication,
} from '@/api/client'
import { getToken } from '@/api/session'
import type {
  PrayerRequest,
  PrayerRequestStatus,
  UpdateSubmissionBody,
  VolunteerApplication,
  VolunteerApplicationStatus,
} from '@/api/types'
import { useMe } from '@/features/auth/useMe'

/** Prefix of every inbox query (lists and counts): invalidating it refreshes all of them. */
export const SUBMISSIONS_KEY = ['submissions'] as const
const COUNTS_KEY = [...SUBMISSIONS_KEY, 'counts'] as const

/** NEW counts for the nav badges. ADMIN and PEMBINA only; a failure just shows no badge. */
export function useSubmissionCounts(options: { enabled?: boolean } = {}) {
  const me = useMe()
  const allowed = me.data?.role === 'ADMIN' || me.data?.role === 'PEMBINA'
  return useQuery({
    queryKey: COUNTS_KEY,
    queryFn: getSubmissionCounts,
    enabled: (options.enabled ?? true) && allowed && getToken() !== null,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  })
}

/** GET /admin/prayer-requests, optionally filtered by status. */
export function usePrayerRequests(status?: PrayerRequestStatus) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, 'prayer', { status: status ?? null }],
    queryFn: () => getPrayerRequests(status),
    retry: false,
  })
}

/** There is no GET by id: the detail is found in the unfiltered list. */
export function usePrayerRequest(id: string) {
  const query = usePrayerRequests()
  return { ...query, item: query.data?.find((x) => x.id === id) }
}

export function useVolunteerApplications(status?: VolunteerApplicationStatus) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, 'volunteer', { status: status ?? null }],
    queryFn: () => getVolunteerApplications(status),
    retry: false,
  })
}

export function useVolunteerApplication(id: string) {
  const query = useVolunteerApplications()
  return { ...query, item: query.data?.find((x) => x.id === id) }
}

/** Marks lists and counts stale at once; the refetch runs in the background. */
function useRefreshSubmissions() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
  }
}

type Listed = PrayerRequest | VolunteerApplication

/** Writes the updated item into every cached list that holds it (instant UI before the refetch). */
function usePatchCachedItem() {
  const client = useQueryClient()
  return (kind: 'prayer' | 'volunteer', item: Listed) => {
    client.setQueriesData<Listed[]>({ queryKey: [...SUBMISSIONS_KEY, kind] }, (list) =>
      list?.map((x) => (x.id === item.id ? item : x)),
    )
  }
}

export function useUpdatePrayerRequest() {
  const refresh = useRefreshSubmissions()
  const patch = usePatchCachedItem()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSubmissionBody<PrayerRequestStatus> }) =>
      updatePrayerRequest(id, body),
    onSuccess: (item) => {
      patch('prayer', item)
      refresh()
    },
    onError: refresh,
  })
}

export function useDeletePrayerRequest() {
  const refresh = useRefreshSubmissions()
  return useMutation({
    mutationFn: (id: string) => deletePrayerRequest(id),
    onSuccess: refresh,
    onError: refresh,
  })
}

export function useUpdateVolunteerApplication() {
  const refresh = useRefreshSubmissions()
  const patch = usePatchCachedItem()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: UpdateSubmissionBody<VolunteerApplicationStatus>
    }) => updateVolunteerApplication(id, body),
    onSuccess: (item) => {
      patch('volunteer', item)
      refresh()
    },
    onError: refresh,
  })
}

export function useDeleteVolunteerApplication() {
  const refresh = useRefreshSubmissions()
  return useMutation({
    mutationFn: (id: string) => deleteVolunteerApplication(id),
    onSuccess: refresh,
    onError: refresh,
  })
}
