import { PageShell } from '@/components/PageShell'
import { PlaceholderBlock } from '@/components/PlaceholderBlock'
import { site } from '@/content/site'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Placeholder route for the volunteer registration form (built in F5). */
export function VolunteerPage() {
  useDocumentTitle(site.titles.volunteer)
  return (
    <PageShell title={site.pages.volunteer.title} description={site.pages.volunteer.description}>
      <PlaceholderBlock />
    </PageShell>
  )
}
