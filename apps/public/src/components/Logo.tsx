import { site } from '@/content/site'
import { cn } from '@/lib/utils'

/**
 * The one logo: the "E" mark (same glyph as public/favicon.svg) plus the "ECHO" wordmark.
 * To change the logo, edit this file and public/favicon.svg only.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <path
          className="fill-primary-foreground"
          d="M10 9h12v3.2H13.4v3.2H21v3.2h-7.6v3.2H22V25H10z"
        />
      </svg>
      <span className="text-xl font-extrabold tracking-wide">{site.brand.name}</span>
    </span>
  )
}
