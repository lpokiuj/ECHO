import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError, errorMessage, normalizeError } from '@/api/errors'
import type { ServiceSchedule } from '@/api/types'
import { FormField } from '@/features/auth/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toWibIso } from '@/lib/dates'
import { messages } from '@/lib/messages'
import {
  EMPTY_VALUES,
  buildUpdateBody,
  serviceSchema,
  valuesFromService,
  type ServiceFormValues,
} from './serviceSchema'
import { useCreateService, useUpdateService } from './useServiceMutations'

const t = messages.services
const f = t.form

interface ServiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  service?: ServiceSchedule
}

export function ServiceFormDialog({ open, onOpenChange, service }: ServiceFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so every opening starts from fresh values. */}
        {open ? <ServiceForm service={service} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

// Server field names to the form field that shows the message.
const FIELD_MAP = { title: 'title', startsAt: 'startDate', endsAt: 'endDate' } as const

function ServiceForm({ service, onDone }: { service?: ServiceSchedule; onDone: () => void }) {
  const editing = service !== undefined
  const original = useMemo(() => (service ? valuesFromService(service) : undefined), [service])
  const startLocked = editing && startedAlready(service)
  const schema = useMemo(() => serviceSchema({ original }), [original])
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: original ?? EMPTY_VALUES,
  })
  const create = useCreateService()
  const update = useUpdateService()
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending
  const { errors } = form.formState

  function showServerError(error: unknown) {
    const e = normalizeError(error)
    const message = errorMessage(e)
    toast.error(message)
    if (e.kind === 'notFound') {
      toast.error(t.toast.gone)
      onDone()
      return
    }
    let placed = false
    if (e instanceof ApiError) {
      for (const [serverField, text] of Object.entries(e.fieldErrors)) {
        const field = FIELD_MAP[serverField as keyof typeof FIELD_MAP]
        if (field) {
          form.setError(field, { message: text })
          placed = true
        }
      }
    }
    setFormError(placed ? null : message)
  }

  async function onSubmit(values: ServiceFormValues) {
    setFormError(null)
    try {
      if (service && original) {
        const body = buildUpdateBody(original, values)
        if (Object.keys(body).length === 0) {
          setFormError(f.noChanges)
          return
        }
        await update.mutateAsync({ id: service.id, body })
        toast.success(t.toast.updated)
      } else {
        await create.mutateAsync({
          title: values.title.trim(),
          startsAt: toWibIso(values.startDate, values.startTime),
          endsAt: toWibIso(values.endDate, values.endTime),
        })
        toast.success(t.toast.created)
      }
      onDone()
    } catch (error) {
      showServerError(error)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? f.editTitle : f.createTitle}</DialogTitle>
        <DialogDescription>{f.description}</DialogDescription>
      </DialogHeader>
      <FormField
        id="service-title"
        label={f.titleLabel}
        hint={f.titleHint}
        error={errors.title?.message}
        autoComplete="off"
        {...form.register('title')}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="service-start-date"
          type="date"
          label={f.startDate}
          error={errors.startDate?.message}
          disabled={startLocked}
          {...form.register('startDate')}
        />
        <FormField
          id="service-start-time"
          type="time"
          label={f.startTime}
          error={errors.startTime?.message}
          disabled={startLocked}
          {...form.register('startTime')}
        />
        <FormField
          id="service-end-date"
          type="date"
          label={f.endDate}
          error={errors.endDate?.message}
          {...form.register('endDate')}
        />
        <FormField
          id="service-end-time"
          type="time"
          label={f.endTime}
          error={errors.endTime?.message}
          {...form.register('endTime')}
        />
      </div>
      {startLocked ? <p className="text-muted-foreground text-sm">{f.startLocked}</p> : null}
      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          {messages.common.cancel}
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? f.submitEdit : f.submitCreate}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Started means the start instant is now or past. */
function startedAlready(service: ServiceSchedule): boolean {
  return new Date(service.startsAt).getTime() <= Date.now()
}
