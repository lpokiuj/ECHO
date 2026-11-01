import { z } from 'zod'
import type { UpdateUserBody, User, UserRole } from '@/api/types'
import { messages } from '@/lib/messages'

const v = messages.users.validation
const emailOk = z.email()

export interface UserFormValues {
  name: string
  email: string
  role: UserRole
  isActive: boolean
}

export const EMPTY_VALUES: UserFormValues = { name: '', email: '', role: 'MEMBER', isActive: true }

/** Limits from docs/api/users.md: name not empty, email valid. The server still decides. */
export const userSchema = z.object({
  name: z.string().trim().min(1, v.nameRequired),
  email: z
    .string()
    .trim()
    .min(1, v.emailRequired)
    .refine((value) => emailOk.safeParse(value).success, v.emailInvalid),
  role: z.enum(['ADMIN', 'PEMBINA', 'MEMBER']),
  isActive: z.boolean(),
})

export function valuesFromUser(user: User): UserFormValues {
  return { name: user.name, email: user.email, role: user.role, isActive: user.isActive }
}

/**
 * Only changed fields. For the admin's own account role and isActive are never sent: the
 * server answers 400 to them even when unchanged (users.md).
 */
export function buildUpdateBody(
  original: UserFormValues,
  values: UserFormValues,
  isSelf: boolean,
): UpdateUserBody {
  const body: UpdateUserBody = {}
  const name = values.name.trim()
  const email = values.email.trim()
  if (name !== original.name) body.name = name
  if (email !== original.email) body.email = email
  if (!isSelf) {
    if (values.role !== original.role) body.role = values.role
    if (values.isActive !== original.isActive) body.isActive = values.isActive
  }
  return body
}
