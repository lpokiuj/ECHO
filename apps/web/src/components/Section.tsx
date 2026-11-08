import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionProps {
  /** Becomes the heading id, so `aria-labelledby` targets stay stable. Defaults to a generated id. */
  id?: string
  /** Without a title the Section is a plain `div`, not a labelled region. */
  title?: string
  /** One line under the title. */
  description?: string
  /** Shown at the end of the title row, such as a badge or a button. */
  action?: ReactNode
  headingLevel?: 2 | 3
  className?: string
  children: ReactNode
}

/** A grouped block of page content on a card surface. It is the only bordered surface inside. */
export function Section({
  id,
  title,
  description,
  action,
  headingLevel = 2,
  className,
  children,
}: SectionProps) {
  const generated = useId()
  const headingId = id ?? generated
  const surface = cn('bg-card rounded-lg border p-4 sm:p-6', className)
  if (title === undefined) return <div className={surface}>{children}</div>
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section aria-labelledby={headingId} className={surface}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Heading
            id={headingId}
            className={cn('font-semibold', headingLevel === 2 ? 'text-xl' : 'text-lg')}
          >
            {title}
          </Heading>
          {description ? (
            <p className="text-muted-foreground mt-1 text-base">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
