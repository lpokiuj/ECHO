import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/useMe'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'

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
      <nav
        aria-label={messages.placeholder.linksLabel}
        className="mt-6 flex flex-col gap-3 sm:flex-row"
      >
        <Button asChild>
          <Link to={PATHS.mySchedule}>{messages.nav.mySchedule}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={PATHS.fullSchedule}>{messages.nav.fullSchedule}</Link>
        </Button>
      </nav>
    </>
  )
}
