import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError, errorMessage, normalizeError } from '@/api/errors'
import type { EventItem } from '@/api/types'
import { FormField } from '@/features/auth/FormField'
import { DateField } from '@/features/services/DateField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { messages } from '@/lib/messages'
import {
  EMPTY_VALUES,
  buildCreateBody,
  buildUpdateBody,
  eventSchema,
  valuesFromEvent,
  type EventFormValues,
} from './eventSchema'
import { useCreateEvent, useUpdateEvent } from './useEvents'

const t = messages.events
const f = t.form

interface EventFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  event?: EventItem
}

export function EventFormDialog({ open, onOpenChange, event }: EventFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so every opening starts from fresh values. */}
        {open ? <EventForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

// Server field names to the form field that shows the message.
const FIELD_MAP = {
  title: 'title',
  startsAt: 'date',
  location: 'location',
  description: 'description',
} as const

function EventForm({ event, onDone }: { event?: EventItem; onDone: () => void }) {
  const editing = event !== undefined
  const original = useMemo(() => (event ? valuesFromEvent(event) : undefined), [event])
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: original ?? EMPTY_VALUES,
  })
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending
  const { errors } = form.formState
  const date = useWatch({ control: form.control, name: 'date' })

  function showServerError(error: unknown) {
    const e = normalizeError(error)
    const message = errorMessage(e)
    if (e.kind === 'notFound') {
      toast.error(t.toast.gone)
      onDone()
      return
    }
    toast.error(message)
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

  async function onSubmit(values: EventFormValues) {
    setFormError(null)
    try {
      if (event && original) {
        const body = buildUpdateBody(original, values)
        if (Object.keys(body).length === 0) {
          setFormError(f.noChanges)
          return
        }
        await update.mutateAsync({ id: event.id, body })
        toast.success(t.toast.updated)
      } else {
        await create.mutateAsync(buildCreateBody(values))
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
        id="event-title"
        label={f.titleLabel}
        hint={f.titleHint}
        error={errors.title?.message}
        autoComplete="off"
        {...form.register('title')}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          id="event-date"
          value={date}
          label={f.date}
          error={errors.date?.message}
          {...form.register('date')}
        />
        <FormField
          id="event-time"
          type="text"
          inputMode="numeric"
          placeholder={f.timePlaceholder}
          maxLength={5}
          autoComplete="off"
          label={f.time}
          error={errors.time?.message}
          {...form.register('time')}
        />
      </div>
      <FormField
        id="event-location"
        label={f.locationLabel}
        hint={f.locationHint}
        error={errors.location?.message}
        autoComplete="off"
        {...form.register('location')}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-description">{f.descriptionLabel}</Label>
        <Textarea
          id="event-description"
          rows={4}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description ? 'event-description-error' : 'event-description-hint'
          }
          {...form.register('description')}
        />
        {errors.description ? (
          <p id="event-description-error" role="alert" className="text-destructive text-sm">
            {errors.description.message}
          </p>
        ) : (
          <p id="event-description-hint" className="text-muted-foreground text-sm">
            {f.descriptionHint}
          </p>
        )}
      </div>
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
