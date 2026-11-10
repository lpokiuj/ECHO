import type { SubmissionHandler } from '@/api/types'
import { formatDate, formatTime } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'

const t = messages.submissions

/** Who last handled the item and when ("Belum ditangani" when nobody did). */
export function handledText(
  handledBy: SubmissionHandler | null,
  handledAt: string | null,
): string {
  if (!handledAt) return handledBy ? handledBy.name : t.notHandled
  const when = { date: formatDate(handledAt), time: formatTime(handledAt) }
  return handledBy
    ? fillMessage(t.handledByAt, { name: handledBy.name, ...when })
    : fillMessage(t.handledAtOnly, when)
}
