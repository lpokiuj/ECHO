import { z } from 'zod'
import type { EventItem, UpdateEventBody } from '@/api/types'
import { isTimeInput, toWibInputs, toWibIso } from '@/lib/dates'
import { messages } from '@/lib/messages'

const v = messages.events.validation

export const TITLE_MAX = 120
export const LOCATION_MAX = 200
export const DESCRIPTION_MAX = 2000

export interface EventFormValues {
  title: string
  date: string
  time: string
  location: string
  description: string
}

export const EMPTY_VALUES: EventFormValues = {
  title: '',
  date: '',
  time: '',
  location: '',
  description: '',
}

/** Form values for an existing event, read in Asia/Jakarta. */
export function valuesFromEvent(event: EventItem): EventFormValues {
  const start = toWibInputs(event.startsAt)
  return {
    title: event.title,
    date: start.date,
    time: start.time,
    location: event.location,
    description: event.description,
  }
}

/** Limits from docs/api/events.md. Past dates are allowed. The server still decides. */
export const eventSchema = z.object({
  title: z.string().trim().min(1, v.required).max(TITLE_MAX, v.titleTooLong),
  date: z.string().min(1, v.required),
  time: z.string().min(1, v.required).refine(isTimeInput, v.timeFormat),
  location: z.string().trim().min(1, v.required).max(LOCATION_MAX, v.locationTooLong),
  description: z.string().trim().min(1, v.required).max(DESCRIPTION_MAX, v.descriptionTooLong),
})

export function buildCreateBody(values: EventFormValues) {
  return {
    title: values.title.trim(),
    startsAt: toWibIso(values.date, values.time),
    location: values.location.trim(),
    description: values.description.trim(),
  }
}

/** PATCH body with only the changed fields (an empty body is a 400). */
export function buildUpdateBody(original: EventFormValues, next: EventFormValues): UpdateEventBody {
  const body: UpdateEventBody = {}
  const title = next.title.trim()
  const location = next.location.trim()
  const description = next.description.trim()
  if (title !== original.title) body.title = title
  if (next.date !== original.date || next.time !== original.time)
    body.startsAt = toWibIso(next.date, next.time)
  if (location !== original.location) body.location = location
  if (description !== original.description) body.description = description
  return body
}
