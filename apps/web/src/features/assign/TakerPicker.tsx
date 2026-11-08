import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import { Section } from '@/components/Section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDesignateTaker } from '@/features/attendance/useAttendance'
import { fillMessage, messages } from '@/lib/messages'

const t = messages.assign.taker

export interface TakerMember {
  userId: string
  name: string
}

interface TakerPickerProps {
  serviceId: string
  teamId: string
  /** Members assigned by this team. */
  members: TakerMember[]
  /** userId of the current taker, if any. */
  currentId?: string
  idPrefix: string
  /** Heading level; 3 when nested in another Section. */
  headingLevel?: 2 | 3
}

/** Leader or ADMIN picks the one absent-taker of a team for a service. Allowed before and after the start. */
export function TakerPicker({
  serviceId,
  teamId,
  members,
  currentId,
  idPrefix,
  headingLevel = 2,
}: TakerPickerProps) {
  const designate = useDesignateTaker(serviceId, teamId)
  const [choice, setChoice] = useState<string | undefined>()
  const sending = useRef(false)
  const current = members.find((m) => m.userId === currentId)
  const value = choice ?? currentId ?? ''
  const id = `${idPrefix}-taker`

  async function save() {
    if (sending.current || value === '' || value === currentId) return
    sending.current = true
    try {
      await designate.mutateAsync(value)
      toast.success(t.saved)
      setChoice(undefined)
    } catch (error) {
      const e = normalizeError(error)
      if (e.code === 'INVALID_USERS') {
        toast.error(t.invalid)
        setChoice(undefined)
      } else toast.error(errorMessage(e))
    } finally {
      sending.current = false
    }
  }

  return (
    <Section
      id={`${id}-title`}
      title={t.title}
      description={t.description}
      headingLevel={headingLevel}
      className={
        headingLevel === 2
          ? 'mt-6'
          : 'mt-6 rounded-none border-0 border-t bg-transparent p-0 pt-6 sm:p-0 sm:pt-6'
      }
    >
      <p className="flex flex-wrap items-center gap-2" aria-live="polite">
        {current ? (
          <>
            <Badge variant="secondary">{t.badge}</Badge>
            <span className="font-medium break-words">
              {fillMessage(t.current, { name: current.name })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{t.none}</span>
        )}
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={id}>{t.label}</Label>
          <Select value={value} onValueChange={setChoice} disabled={members.length === 0}>
            <SelectTrigger id={id} className="h-auto min-h-11 w-full py-2">
              <SelectValue placeholder={t.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="max-sm:w-full"
          loading={designate.isPending}
          disabled={value === '' || value === currentId}
          onClick={() => void save()}
        >
          {t.save}
        </Button>
      </div>
    </Section>
  )
}
