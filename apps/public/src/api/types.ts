// Types for docs/api/public.md. One module; never hand-edit generated types (there are none).

/** GET /public/bidang */
export interface Bidang {
  id: string
  name: string
}

/** POST /public/prayer-requests. `website` is the honeypot: leave it empty. */
export interface PrayerRequestBody {
  content: string
  consent: boolean
  name?: string
  contact?: string
  wantsFollowUp?: boolean
  website?: string
}

/** POST /public/volunteer-applications. `website` is the honeypot: leave it empty. */
export interface VolunteerApplicationBody {
  fullName: string
  whatsapp: string
  consent: boolean
  email?: string
  bidangIds?: string[]
  availability?: string
  message?: string
  website?: string
}

/** 201 body of both POSTs. */
export interface SubmissionResult {
  ok: true
}

/** GET /public/events: one upcoming event. `startsAt` is an ISO 8601 UTC string. */
export interface EventItem {
  id: string
  title: string
  startsAt: string
  location: string
  description: string
}
