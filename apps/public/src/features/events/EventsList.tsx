import { CalendarIcon, MapPinIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'
import { useEvents } from '@/hooks/useEvents'
import { formatEventDate } from '@/lib/dates'

/** Events from getEvents() with loading, error (retry) and empty states. F3 restyles the cards. */
export function EventsList() {
  const { data, isPending, isError, refetch } = useEvents()
  const copy = site.sections.events

  if (isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        {site.states.loading}
      </p>
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
  if (data.length === 0) return <p className="text-muted-foreground">{copy.empty}</p>

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {data.map((event) => (
        <li key={event.id} className="bg-card rounded-2xl border p-5 shadow-sm">
          <h3 className="text-lg font-bold">{event.title}</h3>
          <p className="text-muted-foreground mt-3 flex items-start gap-2 text-sm">
            <CalendarIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formatEventDate(event.startsAt)}
          </p>
          <p className="text-muted-foreground mt-1 flex items-start gap-2 text-sm">
            <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {event.location}
          </p>
          <p className="mt-3 text-sm">{event.description}</p>
        </li>
      ))}
    </ul>
  )
}
