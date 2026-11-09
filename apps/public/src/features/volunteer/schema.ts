import { z } from 'zod'
import type { VolunteerApplicationBody } from '@/api/types'
import { site } from '@/content/site'
import { VOLUNTEER_LIMITS as L } from './limits'

const copy = site.pages.volunteer.form.errors

/** Client validation mirroring docs/api/public.md. The server stays the authority. */
export const volunteerSchema = z.object({
  fullName: z.string().trim().min(1, copy.fullNameRequired).max(L.fullName, copy.fullNameTooLong(L.fullName)),
  whatsapp: z.string().trim().min(1, copy.whatsappRequired).max(L.whatsapp, copy.whatsappTooLong(L.whatsapp)),
  email: z
    .string()
    .trim()
    .max(L.email, copy.emailTooLong(L.email))
    .refine((value) => value === '' || z.email().safeParse(value).success, copy.emailInvalid),
  bidangIds: z.array(z.string()).max(L.bidangIds, copy.bidangTooMany(L.bidangIds)),
  availability: z.string().trim().max(L.availability, copy.availabilityTooLong(L.availability)),
  message: z.string().trim().max(L.message, copy.messageTooLong(L.message)),
  consent: z.boolean().refine((value) => value === true, copy.consentRequired),
  website: z.string(),
})

export type VolunteerFormInput = z.input<typeof volunteerSchema>
export type VolunteerFormValues = z.output<typeof volunteerSchema>

/** The request body: trimmed text, blank optional fields omitted, the honeypot sent as typed. */
export function toRequestBody(values: VolunteerFormValues): VolunteerApplicationBody {
  const body: VolunteerApplicationBody = {
    fullName: values.fullName.trim(),
    whatsapp: values.whatsapp.trim(),
    consent: true,
  }
  const email = values.email.trim()
  const availability = values.availability.trim()
  const message = values.message.trim()
  if (email) body.email = email
  if (values.bidangIds.length > 0) body.bidangIds = values.bidangIds
  if (availability) body.availability = availability
  if (message) body.message = message
  if (values.website !== '') body.website = values.website
  return body
}
