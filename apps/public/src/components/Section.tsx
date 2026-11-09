import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionProps {
  id: string
  title: string
  intro?: string
  /** `muted` alternates the background between sections. */
  tone?: 'plain' | 'muted'
  children?: ReactNode
}

/** A home page section: anchor id, large heading, optional intro, subtle background tone. */
export function Section({ id, title, intro, tone = 'plain', children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-header py-16 sm:py-20',
        tone === 'muted' ? 'bg-muted' : 'bg-background',
      )}
    >
      <div className="max-w-site mx-auto w-full px-4 sm:px-6">
        <h2 id={`${id}-title`} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {intro ? <p className="text-muted-foreground mt-3 max-w-2xl text-lg">{intro}</p> : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  )
}
