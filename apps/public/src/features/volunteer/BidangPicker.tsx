import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { site } from '@/content/site'
import type { Bidang } from '@/api/types'

const copy = site.pages.volunteer.form
const optional = site.pages.prayer.form.optional

interface BidangPickerProps {
  status: 'pending' | 'error' | 'success'
  bidang: Bidang[] | undefined
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  error?: string
}

/** Multi-select of bidang as a checkbox group. Loading, failed and empty never block the form. */
export function BidangPicker({ status, bidang, value, onChange, disabled, error }: BidangPickerProps) {
  const hasOptions = status === 'success' && bidang !== undefined && bidang.length > 0

  if (status === 'pending') {
    return (
      <div role="status" aria-label={copy.bidang.loading} className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }
  if (!hasOptions) {
    return (
      <p role="status" className="text-muted-foreground bg-muted rounded-lg p-3 text-sm">
        {status === 'error' ? copy.bidang.failed : copy.bidang.empty}
      </p>
    )
  }

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((v) => v !== id))

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby="bidang-hint">
      <legend className="mb-2 text-sm leading-none font-medium">
        {copy.bidang.legend}
        <span className="text-muted-foreground ml-2 font-normal">{optional}</span>
      </legend>
      <p id="bidang-hint" className="text-muted-foreground text-sm">
        {copy.bidang.hint}
      </p>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {bidang.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <Checkbox
              id={`bidang-${item.id}`}
              checked={value.includes(item.id)}
              onCheckedChange={(checked) => toggle(item.id, checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={`bidang-${item.id}`} className="min-h-11 flex-1 text-base leading-snug">
              {item.name}
            </Label>
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
