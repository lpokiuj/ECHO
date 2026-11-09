import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { errorMessage } from '@/api/errors'
import { describedBy, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { site } from '@/content/site'
import { cn } from '@/lib/utils'
import { PRAYER_LIMITS } from './limits'
import { PrayerSuccess } from './PrayerSuccess'
import {
  prayerSchema,
  toRequestBody,
  type PrayerFormInput,
  type PrayerFormValues,
} from './schema'
import { useSubmitPrayerRequest } from './usePrayerRequest'

const copy = site.pages.prayer.form

const DEFAULTS: PrayerFormInput = {
  name: '',
  wantsFollowUp: false,
  contact: '',
  content: '',
  consent: false,
  website: '',
}

// The live region only changes when the remaining count crosses a 100-character band, so a screen
// reader hears a few announcements instead of one per key.
const NEAR_LIMIT = 300

function counterAnnouncement(count: number): string {
  const remaining = PRAYER_LIMITS.content - count
  if (remaining < 0) return copy.errors.contentTooLong(PRAYER_LIMITS.content)
  if (remaining > NEAR_LIMIT) return ''
  return copy.counterNearLimit(Math.ceil(remaining / 100) * 100)
}

/** The prayer request form: idle, submitting, error banner (data kept) and success screen. */
export function PrayerForm() {
  const mutation = useSubmitPrayerRequest()
  const focusName = useRef(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    trigger,
    clearErrors,
    formState: { errors, isSubmitted },
  } = useForm<PrayerFormInput, unknown, PrayerFormValues>({
    resolver: zodResolver(prayerSchema),
    defaultValues: DEFAULTS,
  })
  const wantsFollowUp = useWatch({ control, name: 'wantsFollowUp' })
  const content = useWatch({ control, name: 'content' })
  const pending = mutation.isPending
  const count = content.trim().length
  const overLimit = count > PRAYER_LIMITS.content

  // Toggling the follow-up box after a failed submit updates the contact error right away.
  useEffect(() => {
    if (!isSubmitted) return
    if (wantsFollowUp) void trigger('contact')
    else clearErrors('contact')
  }, [wantsFollowUp, isSubmitted, trigger, clearErrors])

  useEffect(() => {
    if (!mutation.isSuccess && focusName.current) {
      focusName.current = false
      setFocus('name')
    }
  }, [mutation.isSuccess, setFocus])

  const onSubmit = (values: PrayerFormValues) => {
    if (mutation.isPending) return
    mutation.reset()
    mutation.mutate(toRequestBody(values))
  }

  if (mutation.isSuccess) {
    return (
      <PrayerSuccess
        onAgain={() => {
          focusName.current = true
          reset(DEFAULTS)
          mutation.reset()
        }}
      />
    )
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-busy={pending || undefined}
      className="relative flex max-w-2xl flex-col gap-6"
    >
      <p className="text-muted-foreground text-sm">{copy.requiredLegend}</p>

      <FormField id="name" label={copy.nameLabel} hint={copy.nameHint} error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          readOnly={pending}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name', { hint: true, error: !!errors.name })}
          {...register('name')}
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="wantsFollowUp"
            render={({ field }) => (
              <Checkbox
                id="wantsFollowUp"
                ref={field.ref}
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
                onBlur={field.onBlur}
                disabled={pending}
                aria-describedby="wantsFollowUp-hint"
              />
            )}
          />
          <Label htmlFor="wantsFollowUp" className="min-h-11 flex-1 text-base leading-snug">
            {copy.followUpLabel}
          </Label>
        </div>
        <p id="wantsFollowUp-hint" className="text-muted-foreground text-sm">
          {copy.followUpHint}
        </p>
      </div>

      <FormField
        id="contact"
        label={copy.contactLabel}
        required={wantsFollowUp}
        hint={copy.contactHint}
        error={errors.contact?.message}
      >
        <Input
          id="contact"
          autoComplete="off"
          readOnly={pending}
          aria-required={wantsFollowUp || undefined}
          aria-invalid={errors.contact ? true : undefined}
          aria-describedby={describedBy('contact', { hint: true, error: !!errors.contact })}
          {...register('contact')}
        />
      </FormField>

      <FormField
        id="content"
        label={copy.contentLabel}
        required
        hint={copy.contentHint}
        error={errors.content?.message}
      >
        <Textarea
          id="content"
          rows={6}
          readOnly={pending}
          aria-required="true"
          aria-invalid={errors.content ? true : undefined}
          aria-describedby={describedBy(
            'content',
            { hint: true, error: !!errors.content },
            'content-counter',
          )}
          {...register('content')}
        />
        <p
          id="content-counter"
          className={cn('text-sm', overLimit ? 'text-destructive' : 'text-muted-foreground')}
        >
          {count} {copy.counter.of} {PRAYER_LIMITS.content} {copy.counter.unit}
        </p>
        <p role="status" className="sr-only">
          {counterAnnouncement(count)}
        </p>
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id="consent"
                ref={field.ref}
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
                onBlur={field.onBlur}
                disabled={pending}
                aria-required="true"
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={describedBy('consent', { error: !!errors.consent }, 'consent-note')}
              />
            )}
          />
          <Label htmlFor="consent" className="min-h-11 flex-1 text-base leading-snug">
            {copy.consentLabel}
            <span aria-hidden="true" className="text-destructive">
              {copy.requiredMark}
            </span>
          </Label>
        </div>
        <p id="consent-note" className="text-muted-foreground text-sm">
          {copy.privacyNote}
        </p>
        {errors.consent ? (
          <p id="consent-error" role="alert" className="text-destructive text-sm">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot: off screen, not announced, not in the tab order. Bots fill it, people never see it. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="website">{copy.honeypotLabel}</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {mutation.isError ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-4 text-sm"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage(mutation.error)}</p>
        </div>
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto sm:self-start">
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  )
}
