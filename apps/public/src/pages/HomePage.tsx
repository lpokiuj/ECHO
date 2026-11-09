import { ArrowRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PlaceholderBlock } from '@/components/PlaceholderBlock'
import { Section } from '@/components/Section'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'
import { EventsList } from '@/features/events/EventsList'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PATHS } from '@/routes/paths'

/** The home page shell: a hero plus anchored sections. F2 and F3 fill the section bodies. */
export function HomePage() {
  useDocumentTitle()
  const s = site.sections
  return (
    <>
      <section
        id={site.hero.id}
        aria-labelledby="hero-title"
        className="from-primary to-secondary-foreground text-primary-foreground relative overflow-hidden bg-gradient-to-br"
      >
        <div
          aria-hidden="true"
          className="bg-primary-foreground/10 absolute -right-16 -bottom-24 size-72 rounded-full sm:size-96"
        />
        <div
          aria-hidden="true"
          className="bg-primary-foreground/10 absolute right-24 -bottom-10 size-32 rounded-full max-sm:hidden"
        />
        <div className="max-w-site relative mx-auto w-full px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-semibold tracking-widest uppercase">{site.hero.eyebrow}</p>
          <h1
            id="hero-title"
            className="mt-4 max-w-3xl text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl"
          >
            {site.hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-lg">{site.hero.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
              <Link to={site.hero.primaryCta.to}>
                {site.hero.primaryCta.label}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground h-12 bg-transparent px-6 text-base dark:bg-transparent"
            >
              <Link to={site.hero.secondaryCta.to}>{site.hero.secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </section>

      <Section id={s.about.id} title={s.about.title} intro={s.about.intro}>
        <PlaceholderBlock />
      </Section>
      <Section id={s.worship.id} title={s.worship.title} intro={s.worship.intro} tone="muted">
        <PlaceholderBlock />
      </Section>
      <Section id={s.events.id} title={s.events.title} intro={s.events.intro}>
        <EventsList />
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
