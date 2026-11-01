import { z } from 'zod'
import type { Service, UpdateServiceBody } from '@/api/types'
import { isFuture, isTimeInput, toWibInputs, toWibIso } from '@/lib/dates'
import { messages } from '@/lib/messages'

const v = messages.services.validation

export const TITLE_MAX = 150

export interface ServiceFormValues {
  title: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

export const EMPTY_VALUES: ServiceFormValues = {
  title: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
}

/** Form values for an existing service, read in Asia/Jakarta. */
export function valuesFromService(
  service: Service | { title: string; startsAt: string; endsAt: string },
) {
  const start = toWibInputs(service.startsAt)
  const end = toWibInputs(service.endsAt)
  return {
    title: service.title,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  }
}

interface SchemaOptions {
  /** Values the form started with (edit only). An unchanged start is not checked for "future". */
  original?: ServiceFormValues
  now?: () => number
}

const startChanged = (a: ServiceFormValues, b?: ServiceFormValues) =>
  !b || a.startDate !== b.startDate || a.startTime !== b.startTime

/** Limits from docs/api/services.md. Client validation is a convenience; the server still decides. */
export function serviceSchema({ original, now = Date.now }: SchemaOptions = {}) {
  return z
    .object({
      title: z.string().trim().min(1, v.required).max(TITLE_MAX, v.titleTooLong),
      startDate: z.string().min(1, v.required),
      startTime: z.string().min(1, v.required).refine(isTimeInput, v.timeFormat),
      endDate: z.string().min(1, v.required),
      endTime: z.string().min(1, v.required).refine(isTimeInput, v.timeFormat),
    })
    .superRefine((values, ctx) => {
      if (!values.startDate || !values.endDate) return
      if (!isTimeInput(values.startTime) || !isTimeInput(values.endTime)) return
      const start = toWibIso(values.startDate, values.startTime)
      const end = toWibIso(values.endDate, values.endTime)
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: v.endAfterStart })
      }
      if (startChanged(values, original) && !isFuture(start, now())) {
        ctx.addIssue({ code: 'custom', path: ['startDate'], message: v.startFuture })
      }
    })
}

/**
 * PATCH body with only the changed fields. An unchanged startsAt is never sent: a start that
 * is now or past is rejected even when unchanged. Any time change also sends endsAt.
 */
export function buildUpdateBody(
  original: ServiceFormValues,
  next: ServiceFormValues,
): UpdateServiceBody {
  const body: UpdateServiceBody = {}
  const title = next.title.trim()
  if (title !== original.title) body.title = title
  const startDiffers = startChanged(next, original)
  const endDiffers = next.endDate !== original.endDate || next.endTime !== original.endTime
  if (startDiffers) body.startsAt = toWibIso(next.startDate, next.startTime)
  if (startDiffers || endDiffers) body.endsAt = toWibIso(next.endDate, next.endTime)
  return body
}
