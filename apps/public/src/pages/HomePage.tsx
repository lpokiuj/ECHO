import { Link } from 'react-router'
import { PlaceholderBlock } from '@/components/PlaceholderBlock'
import { Section } from '@/components/Section'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'
import { EventsList } from '@/features/events/EventsList'
import { HeroSection } from '@/features/home/HeroSection'
import { LocationSection } from '@/features/home/LocationSection'
import { WorshipSection } from '@/features/home/WorshipSection'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PATHS } from '@/routes/paths'

/**
 * The home page: hero, Ibadah, Lokasi (F2), then Kegiatan, Tentang and the other sections (F3).
 * Section backgrounds alternate plain and muted after the dark hero.
 */
export function HomePage() {
  useDocumentTitle()
  const s = site.sections
  return (
    <>
      <HeroSection />
      <WorshipSection />
      <LocationSection />
      <Section id={s.events.id} title={s.events.title} intro={s.events.intro} tone="muted">
        <EventsList />
      </Section>
      <Section id={s.about.id} title={s.about.title} intro={s.about.intro}>
        <PlaceholderBlock />
      </Section>
      <Section id={s.bidang.id} title={s.bidang.title} intro={s.bidang.intro} tone="muted">
        <PlaceholderBlock />
      </Section>
      <Section id={s.prayer.id} title={s.prayer.title} intro={s.prayer.intro}>
        <Button asChild size="lg">
          <Link to={PATHS.prayer}>{s.prayer.cta}</Link>
        </Button>
      </Section>
      <Section id={s.volunteer.id} title={s.volunteer.title} intro={s.volunteer.intro} tone="muted">
        <Button asChild size="lg">
          <Link to={PATHS.volunteer}>{s.volunteer.cta}</Link>
        </Button>
      </Section>
    </>
  )
}
