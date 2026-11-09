import { CalendarIcon, CalendarOffIcon, MapPinIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { site } from '@/content/site'
import { useUpcomingEvents } from '@/hooks/useEvents'
import { formatEventDate } from '@/lib/dates'

/** Upcoming events from getEvents(): loading skeleton, error with retry, empty state, cards. */
export function EventsList() {
  const { data, isPending, isError, refetch } = useUpcomingEvents()
  const copy = site.sections.events

  if (isPending) {
    return (
      <div role="status">
        <span className="sr-only">{site.states.loading}</span>
        <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{copy.error}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          {site.states.retry}
        </Button>
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center">
        <CalendarOffIcon className="size-6" aria-hidden="true" />
        <p>{copy.empty}</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {data.map((event) => (
        <li key={event.id} className="bg-card rounded-2xl border p-6 shadow-sm">
          <h3 className="text-xl font-bold">{event.title}</h3>
          <p className="text-muted-foreground mt-4 flex items-start gap-2 text-sm">
            <CalendarIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formatEventDate(event.startsAt)}
          </p>
          <p className="text-muted-foreground mt-1 flex items-start gap-2 text-sm">
            <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {event.location}
          </p>
          <p className="mt-4 text-sm">{event.description}</p>
        </li>
      ))}
    </ul>
  )
}
