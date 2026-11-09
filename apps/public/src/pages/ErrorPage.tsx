import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Route error boundary: shows a generic message, never the error text. */
export function ErrorPage() {
  useDocumentTitle(site.titles.error)
  return (
    <main id="main" className="min-h-svh">
      <PageShell title={site.pages.error.title} description={site.pages.error.description}>
        <Button size="lg" onClick={() => window.location.reload()}>
          {site.pages.error.reload}
        </Button>
      </PageShell>
    </main>
  )
}
