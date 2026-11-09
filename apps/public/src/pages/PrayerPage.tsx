import { PageShell } from '@/components/PageShell'
import { PlaceholderBlock } from '@/components/PlaceholderBlock'
import { site } from '@/content/site'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Placeholder route for the prayer request form (built in F4). */
export function PrayerPage() {
  useDocumentTitle(site.titles.prayer)
  return (
    <PageShell title={site.pages.prayer.title} description={site.pages.prayer.description}>
      <PlaceholderBlock />
    </PageShell>
  )
}
