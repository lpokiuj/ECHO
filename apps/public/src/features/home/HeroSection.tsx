import { ArrowDownIcon, ClockIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'

/** The home hero: name, tagline, next service time and the two main buttons. */
export function HeroSection() {
  const hero = site.hero
  return (
    <section
      id={hero.id}
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
      <div className="max-w-site relative mx-auto w-full px-4 py-16 sm:px-6 sm:py-28">
        <h1
          id="hero-title"
          className="max-w-3xl text-5xl leading-tight font-extrabold tracking-tight sm:text-7xl"
        >
          {hero.title}
        </h1>
        <p className="mt-5 max-w-xl text-xl font-medium">{site.brand.tagline}</p>
        <p className="bg-primary-foreground/10 mt-6 inline-flex max-w-full items-start gap-2 rounded-2xl px-4 py-3 text-sm">
          <ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">{hero.nextService.label}</span>
            {': '}
            {hero.nextService.value}
          </span>
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
            <Link to={hero.primaryCta.to}>
              {hero.primaryCta.label}
              <ArrowDownIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground h-12 bg-transparent px-6 text-base dark:bg-transparent"
          >
            <Link to={hero.secondaryCta.to}>{hero.secondaryCta.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
