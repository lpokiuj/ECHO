import { z } from 'zod'
import { messages } from '@/lib/messages'

const v = messages.teams.validation

export interface TeamFormValues {
  name: string
}

/** Limits from docs/api/teams.md: name trimmed, 1-100 characters. The server still decides. */
export const teamSchema = z.object({
  name: z.string().trim().min(1, v.nameRequired).max(100, v.nameTooLong),
})
