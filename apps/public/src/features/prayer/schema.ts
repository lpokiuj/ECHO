import { z } from 'zod'
import type { PrayerRequestBody } from '@/api/types'
import { site } from '@/content/site'
import { PRAYER_LIMITS } from './limits'

const copy = site.pages.prayer.form.errors

/** Client validation mirroring docs/api/public.md. The server stays the authority. */
export const prayerSchema = z
  .object({
    name: z.string().trim().max(PRAYER_LIMITS.name, copy.nameTooLong(PRAYER_LIMITS.name)),
    wantsFollowUp: z.boolean(),
    contact: z.string().trim().max(PRAYER_LIMITS.contact, copy.contactTooLong(PRAYER_LIMITS.contact)),
    content: z
      .string()
      .trim()
      .min(1, copy.contentRequired)
      .max(PRAYER_LIMITS.content, copy.contentTooLong(PRAYER_LIMITS.content)),
    consent: z.boolean().refine((value) => value === true, copy.consentRequired),
    website: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.wantsFollowUp && values.contact === '') {
      ctx.addIssue({ code: 'custom', path: ['contact'], message: copy.contactRequired })
    }
  })

export type PrayerFormInput = z.input<typeof prayerSchema>
export type PrayerFormValues = z.output<typeof prayerSchema>

/** The request body: trimmed text, blank optional fields omitted, the honeypot sent as typed. */
export function toRequestBody(values: PrayerFormValues): PrayerRequestBody {
  const body: PrayerRequestBody = {
    content: values.content.trim(),
    consent: true,
    wantsFollowUp: values.wantsFollowUp,
  }
  const name = values.name.trim()
  const contact = values.contact.trim()
  if (name) body.name = name
  if (contact) body.contact = contact
  if (values.website !== '') body.website = values.website
  return body
}
