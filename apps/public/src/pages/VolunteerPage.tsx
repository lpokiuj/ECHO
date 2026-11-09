import { PageShell } from '@/components/PageShell'
import { site } from '@/content/site'
import { VolunteerForm } from '@/features/volunteer/VolunteerForm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** The volunteer registration page (F5). */
export function VolunteerPage() {
  useDocumentTitle(site.titles.volunteer)
  return (
    <PageShell title={site.pages.volunteer.title} description={site.pages.volunteer.description}>
      <VolunteerForm />
    </PageShell>
  )
}
