import type { ReactNode } from 'react'

/** Announces async results to assistive technology. Pass the message as children. */
export function LiveRegion({ children }: { children?: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  )
}
