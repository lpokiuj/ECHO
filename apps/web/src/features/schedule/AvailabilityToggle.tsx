import { useRef } from 'react'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { ServiceSchedule } from '@/api/types'
import { Switch } from '@/components/ui/switch'
import { useMe } from '@/features/auth/useMe'
import { isFuture } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { useSetAvailability } from './useAvailability'

const t = messages.availability

/**
 * "Saya tidak bisa hadir" for one upcoming service. Not shown once the service has started or
 * when the caller is already assigned (the server would answer 409 either way).
 */
export function AvailabilityToggle({ service }: { service: ServiceSchedule }) {
  const me = useMe()
  const mutation = useSetAvailability(service.id)
  const sending = useRef(false)
  const assigned = service.assignments.some((a) => a.userId === me.data?.id)

  if (!isFuture(service.startsAt)) return null
  if (assigned) return <p className="text-muted-foreground text-base">{t.assignedNote}</p>

  async function change(next: boolean) {
    if (sending.current) return
    sending.current = true
    try {
      await mutation.mutateAsync(next)
      toast.success(next ? t.marked : t.unmarked)
    } catch (error) {
      const e = normalizeError(error)
      if (e.code === 'SERVICE_ALREADY_STARTED') toast.error(t.startedGone)
      else if (e.status === 404 && !e.code) toast.error(t.serviceGone)
      else toast.error(errorMessage(e))
    } finally {
      sending.current = false
    }
  }

  const checked = service.unavailable
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-base">
        <Switch
          checked={checked}
          disabled={mutation.isPending}
          aria-label={fillMessage(t.toggleAria, { service: service.title })}
          onCheckedChange={(value) => void change(value)}
        />
        {t.toggleLabel}
      </label>
      <p className="text-muted-foreground text-sm">{t.help}</p>
    </div>
  )
}
