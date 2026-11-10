import type { PrayerRequestStatus, VolunteerApplicationStatus } from '@/api/types'

export type AnyStatus = PrayerRequestStatus | VolunteerApplicationStatus

export const PRAYER_STATUSES: readonly PrayerRequestStatus[] = ['NEW', 'IN_PROGRESS', 'DONE']
export const VOLUNTEER_STATUSES: readonly VolunteerApplicationStatus[] = [
  'NEW',
  'CONTACTED',
  'ACCEPTED',
  'DECLINED',
]

export const STATUS_VARIANT: Record<AnyStatus, 'warning' | 'info' | 'success' | 'secondary'> = {
  NEW: 'warning',
  IN_PROGRESS: 'info',
  CONTACTED: 'info',
  DONE: 'success',
  ACCEPTED: 'success',
  DECLINED: 'secondary',
}

/** Narrows a `?status=` value to one of `allowed`; anything else is "no filter". */
export function parseStatus<S extends string>(
  value: string | null,
  allowed: readonly S[],
): S | undefined {
  return allowed.find((s) => s === value)
}
