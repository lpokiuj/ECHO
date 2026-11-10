import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { messages } from '@/lib/messages'
import type { AnyStatus } from './submissionStatus'

const ALL = 'ALL'
const t = messages.submissions

interface StatusFilterProps<S extends AnyStatus> {
  statuses: readonly S[]
  value: S | undefined
  onChange: (value: S | undefined) => void
}

export function StatusFilter<S extends AnyStatus>({
  statuses,
  value,
  onChange,
}: StatusFilterProps<S>) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(statuses.find((s) => s === next))}
    >
      <SelectTrigger aria-label={t.statusFilterLabel} className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t.allStatuses}</SelectItem>
        {statuses.map((s) => (
          <SelectItem key={s} value={s}>
            {t.statuses[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
