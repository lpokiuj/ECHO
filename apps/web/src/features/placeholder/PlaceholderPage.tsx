import { CalendarDaysIcon, CalendarRangeIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { HomeRecap } from '@/features/attendance/HomeRecap'
import { useMe } from '@/features/auth/useMe'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'

const TILES = [
  {
    to: PATHS.mySchedule,
    icon: CalendarDaysIcon,
    title: messages.nav.mySchedule,
    description: messages.placeholder.mineDescription,
  },
  {
    to: PATHS.fullSchedule,
    icon: CalendarRangeIcon,
    title: messages.nav.fullSchedule,
    description: messages.placeholder.fullDescription,
  },
]

export function PlaceholderPage() {
  useDocumentTitle()
  const { data: me } = useMe()
  return (
    <>
      <PageHeader
        title={messages.placeholder.title}
        description={messages.placeholder.description}
      />
      {me ? (
        <p className="flex flex-wrap items-center gap-2 text-base">
          <span>{messages.placeholder.greeting}</span>
          <span className="font-medium">{me.name}</span>
          <RoleBadge role={me.role} />
        </p>
      ) : null}
      <nav aria-label={messages.placeholder.linksLabel} className="mt-6 grid gap-4 sm:grid-cols-2">
        {TILES.map(({ to, icon: Icon, title, description }, index) => (
          <Link
            key={to}
            to={to}
            aria-describedby={`home-tile-${index}`}
            className="bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-h-20 items-center gap-4 rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
          >
            <span className="bg-primary-soft text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-semibold">{title}</span>
              <span
                aria-hidden="true"
                id={`home-tile-${index}`}
                className="text-muted-foreground text-base"
              >
                {description}
              </span>
            </span>
            <ChevronRightIcon
              className="text-muted-foreground ml-auto size-4 shrink-0 max-sm:hidden"
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
      {me ? (
        <div className="mt-6">
          <HomeRecap me={me} />
        </div>
      ) : null}
    </>
  )
}
