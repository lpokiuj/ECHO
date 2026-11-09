import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { site } from '@/content/site'

const form = site.pages.prayer.form

/** The ids a control lists in `aria-describedby`: error first, then hint, then any extras. */
export function describedBy(id: string, parts: { hint?: boolean; error?: boolean }, ...extra: string[]) {
  const ids = [parts.error ? `${id}-error` : null, parts.hint ? `${id}-hint` : null, ...extra]
  return ids.filter(Boolean).join(' ') || undefined
}

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  /** The control (Input or Textarea); it carries id, aria-required, aria-invalid, aria-describedby. */
  children: ReactNode
}

/** Label with a required marker or "(opsional)", the control, a hint and an inline error. */
export function FormField({ id, label, required, hint, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {form.requiredMark}
          </span>
        ) : (
          <span className="text-muted-foreground font-normal">{form.optional}</span>
        )}
      </Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
