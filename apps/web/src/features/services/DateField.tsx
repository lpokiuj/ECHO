import { CalendarIcon } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, type ComponentProps } from 'react'
import { Label } from '@/components/ui/label'
import { formatDateInput } from '@/lib/dates'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils'

interface DateFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'value'> {
  id: string
  label: string
  /** "YYYY-MM-DD" or empty. */
  value: string
  error?: string
}

/**
 * Date picker. The browser's own picker (a hidden date input) does the choosing, which works
 * at every width; the button shows the chosen date as "08 November 2026" whatever the locale.
 */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { id, label, value, error, disabled, ...inputProps },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)
  const errorId = `${id}-error`

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
      input.click()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-labelledby={`${id}-button-text`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-1 text-left text-base outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 max-lg:h-11',
            !value && 'text-muted-foreground',
          )}
        >
          <span id={`${id}-button-text`} className="min-w-0 truncate">
            <span className="sr-only">{label}: </span>
            {value ? formatDateInput(value) : messages.services.form.datePlaceholder}
          </span>
          <CalendarIcon aria-hidden className="size-4 shrink-0" />
        </button>
        <input
          {...inputProps}
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
})
