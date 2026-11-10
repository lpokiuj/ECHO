import { Badge } from '@/components/ui/badge'
import { messages } from '@/lib/messages'
import { STATUS_VARIANT, type AnyStatus } from './submissionStatus'

export function StatusBadge({ status }: { status: AnyStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{messages.submissions.statuses[status]}</Badge>
}
