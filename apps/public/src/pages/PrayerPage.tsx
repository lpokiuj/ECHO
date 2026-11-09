import { PageShell } from '@/components/PageShell'
import { site } from '@/content/site'
import { PrayerForm } from '@/features/prayer/PrayerForm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** The prayer request page (F4). */
export function PrayerPage() {
  useDocumentTitle(site.titles.prayer)
  return (
    <PageShell title={site.pages.prayer.title} description={site.pages.prayer.description}>
      <PrayerForm />
    </PageShell>
  )
}
