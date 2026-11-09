import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { errorMessage } from '@/api/errors'
import { describedBy, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { site } from '@/content/site'
import { BidangPicker } from './BidangPicker'
import {
  toRequestBody,
  volunteerSchema,
  type VolunteerFormInput,
  type VolunteerFormValues,
} from './schema'
import { useBidang } from './useBidang'
import { useSubmitVolunteerApplication } from './useSubmitVolunteerApplication'
import { VolunteerSuccess } from './VolunteerSuccess'

const copy = site.pages.volunteer.form
const legend = site.pages.prayer.form.requiredLegend
const requiredMark = site.pages.prayer.form.requiredMark

const DEFAULTS: VolunteerFormInput = {
  fullName: '',
  whatsapp: '',
  email: '',
  bidangIds: [],
  availability: '',
  message: '',
  consent: false,
  website: '',
}

/** The volunteer form: idle, submitting, error banner (data kept) and success screen. */
export function VolunteerForm() {
  const mutation = useSubmitVolunteerApplication()
  const bidang = useBidang()
  const focusName = useRef(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<VolunteerFormInput, unknown, VolunteerFormValues>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: DEFAULTS,
  })
  const pending = mutation.isPending

  useEffect(() => {
    if (!mutation.isSuccess && focusName.current) {
      focusName.current = false
      setFocus('fullName')
    }
  }, [mutation.isSuccess, setFocus])

  const onSubmit = (values: VolunteerFormValues) => {
    if (mutation.isPending) return
    mutation.reset()
    mutation.mutate(toRequestBody(values))
  }

  if (mutation.isSuccess) {
    return (
      <VolunteerSuccess
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
      <p className="text-muted-foreground text-sm">{legend}</p>

      <FormField id="fullName" label={copy.fullNameLabel} required error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          readOnly={pending}
          aria-required="true"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={describedBy('fullName', { error: !!errors.fullName })}
          {...register('fullName')}
        />
      </FormField>

      <FormField
        id="whatsapp"
        label={copy.whatsappLabel}
        required
        hint={copy.whatsappHint}
        error={errors.whatsapp?.message}
      >
        <Input
          id="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          readOnly={pending}
          aria-required="true"
          aria-invalid={errors.whatsapp ? true : undefined}
          aria-describedby={describedBy('whatsapp', { hint: true, error: !!errors.whatsapp })}
          {...register('whatsapp')}
        />
      </FormField>

      <FormField id="email" label={copy.emailLabel} hint={copy.emailHint} error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          readOnly={pending}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email', { hint: true, error: !!errors.email })}
          {...register('email')}
        />
      </FormField>

      <Controller
        control={control}
        name="bidangIds"
        render={({ field }) => (
          <BidangPicker
            status={bidang.status}
            bidang={bidang.data}
            value={field.value}
            onChange={field.onChange}
            disabled={pending}
            error={errors.bidangIds?.message}
          />
        )}
      />

      <FormField
        id="availability"
        label={copy.availabilityLabel}
        hint={copy.availabilityHint}
        error={errors.availability?.message}
      >
        <Textarea
          id="availability"
          rows={3}
          readOnly={pending}
          aria-invalid={errors.availability ? true : undefined}
          aria-describedby={describedBy('availability', {
            hint: true,
            error: !!errors.availability,
          })}
          {...register('availability')}
        />
      </FormField>

      <FormField
        id="message"
        label={copy.messageLabel}
        hint={copy.messageHint}
        error={errors.message?.message}
      >
        <Textarea
          id="message"
          rows={5}
          readOnly={pending}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message', { hint: true, error: !!errors.message })}
          {...register('message')}
        />
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
              {requiredMark}
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
