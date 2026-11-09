import { useMutation } from '@tanstack/react-query'
import { submitPrayerRequest } from '@/api/client'
import type { PrayerRequestBody } from '@/api/types'

/** Sends one prayer request. No retries (the queryClient default), so a click is one request. */
export function useSubmitPrayerRequest() {
  return useMutation({ mutationFn: (body: PrayerRequestBody) => submitPrayerRequest(body) })
}
