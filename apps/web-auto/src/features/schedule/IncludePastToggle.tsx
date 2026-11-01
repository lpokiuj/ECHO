import { Switch } from '@/components/ui/switch'
import { messages } from '@/lib/messages'

interface IncludePastToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** The whole row is the label, so the touch target is at least 44px tall. */
export function IncludePastToggle({ checked, onCheckedChange }: IncludePastToggleProps) {
  return (
    <label className="mb-4 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-base">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      {messages.schedule.includePast}
    </label>
  )
}
