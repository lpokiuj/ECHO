import { Link } from 'react-router'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PATHS } from '@/routes/paths'

export function NotFoundPage() {
  useDocumentTitle(site.titles.notFound)
  return (
    <PageShell title={site.pages.notFound.title} description={site.pages.notFound.description}>
      <Button asChild size="lg">
        <Link to={PATHS.home}>{site.pages.notFound.back}</Link>
      </Button>
    </PageShell>
  )
}
