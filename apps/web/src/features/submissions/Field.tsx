import type { ReactNode } from 'react'

/** One labelled value in a detail. Values are text, never HTML; line breaks are kept. */
export function Field({
  label,
  wide = false,
  children,
}: {
  label: string
  /** Spans both columns from 640px. */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? 'flex flex-col gap-1 sm:col-span-2' : 'flex flex-col gap-1'}>
      <dt className="text-muted-foreground text-sm font-medium">{label}</dt>
      <dd className="text-base break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}
