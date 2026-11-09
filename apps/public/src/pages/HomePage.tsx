import { Section } from '@/components/Section'
import { site } from '@/content/site'
import { EventsList } from '@/features/events/EventsList'
import { AboutSection } from '@/features/home/AboutSection'
import { ContactSection } from '@/features/home/ContactSection'
import { FaqSection } from '@/features/home/FaqSection'
import { GivingSection } from '@/features/home/GivingSection'
import { HeroSection } from '@/features/home/HeroSection'
import { LocationSection } from '@/features/home/LocationSection'
import { WorshipSection } from '@/features/home/WorshipSection'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * The home page, in plan order: hero, Ibadah, Lokasi, Acara, Tentang Kami, Pertama Kali?, Kontak,
 * Persembahan. Section backgrounds alternate plain and muted after the dark hero.
 */
export function HomePage() {
  useDocumentTitle()
  const events = site.sections.events
  return (
    <>
      <HeroSection />
      <WorshipSection />
      <LocationSection />
      <Section id={events.id} title={events.title} intro={events.intro} tone="muted">
        <EventsList />
      </Section>
      <AboutSection />
      <FaqSection />
      <ContactSection />
      <GivingSection />
    </>
  )
}
