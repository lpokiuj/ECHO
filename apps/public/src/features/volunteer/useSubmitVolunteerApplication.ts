import { useMutation } from '@tanstack/react-query'
import { submitVolunteerApplication } from '@/api/client'
import type { VolunteerApplicationBody } from '@/api/types'

/** Sends one application. No retries (the queryClient default), so a click is one request. */
export function useSubmitVolunteerApplication() {
  return useMutation({
    mutationFn: (body: VolunteerApplicationBody) => submitVolunteerApplication(body),
  })
}
