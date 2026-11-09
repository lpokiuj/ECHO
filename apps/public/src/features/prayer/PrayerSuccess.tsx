import { CheckCircle2Icon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'

const copy = site.pages.prayer.success

interface PrayerSuccessProps {
  onAgain: () => void
}

/** The success screen. Focus moves to its heading so keyboard and screen reader users land on it. */
export function PrayerSuccess({ onAgain }: PrayerSuccessProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <div
      role="status"
      className="border-border bg-card flex max-w-2xl flex-col items-start gap-4 rounded-2xl border p-6 sm:p-8"
    >
      <CheckCircle2Icon className="text-success size-10" aria-hidden="true" />
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-extrabold tracking-tight outline-none sm:text-3xl"
      >
        {copy.title}
      </h2>
      <p className="text-muted-foreground text-lg">{copy.message}</p>
      <Button type="button" variant="outline" size="lg" onClick={onAgain}>
        {copy.again}
      </Button>
    </div>
  )
}
