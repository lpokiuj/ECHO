import { errorMessage, normalizeError } from '@/api/errors'
import { messages } from '@/lib/messages'

const e = messages.teams.errors

/**
 * Indonesian text for a failed PUT /teams/:id/members/:userId. The two documented 400s
 * (inactive user, PEMBINA as leader) have no code or field name, so they are told apart by
 * what was sent: isLeader true can only be the PEMBINA rule, a plain add only the inactive rule
 * (teams.md). The backend's English text is never read.
 */
export function memberPutMessage(error: unknown, sentLeader: boolean): string {
  const err = normalizeError(error)
  if (err.kind === 'validation' && Object.keys(err.fieldErrors).length === 0) {
    return sentLeader ? e.pembinaLeader : e.inactiveUser
  }
  return errorMessage(err)
}
