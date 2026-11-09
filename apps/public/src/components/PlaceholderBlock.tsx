import { site } from '@/content/site'

/** A neutral stand-in for content that F2 and F3 will fill. */
export function PlaceholderBlock() {
  return (
    <div className="border-border text-muted-foreground flex min-h-32 items-center justify-center rounded-2xl border border-dashed p-6 text-center">
      {site.states.placeholder}
    </div>
  )
}
