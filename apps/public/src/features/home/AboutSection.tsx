import { HandHeartIcon, MusicIcon, SparklesIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { Section } from '@/components/Section'
import { site } from '@/content/site'

// Icons are presentation, not copy: keyed by the content item id.
const BIDANG_ICONS: Record<string, LucideIcon> = {
  'bidang-1': UsersIcon,
  'bidang-2': MusicIcon,
  'bidang-3': HandHeartIcon,
}

/** Tentang Kami: vision, short story and the bidang overview. Static text, not the API. */
export function AboutSection() {
  const copy = site.sections.about
  return (
    <Section id={copy.id} title={copy.title} intro={copy.intro}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-primary-soft text-secondary-foreground rounded-2xl p-6 sm:p-8">
          <h3 className="text-xl font-bold">{copy.vision.title}</h3>
          <p className="mt-3 text-lg">{copy.vision.text}</p>
        </div>
        <div className="bg-card rounded-2xl border p-6 sm:p-8">
          <h3 className="text-xl font-bold">{copy.story.title}</h3>
          {copy.story.paragraphs.map((text) => (
            <p key={text} className="text-muted-foreground mt-3">
              {text}
            </p>
          ))}
        </div>
      </div>

      <h3 className="mt-12 text-xl font-bold">{copy.bidang.title}</h3>
      <p className="text-muted-foreground mt-2 max-w-2xl">{copy.bidang.intro}</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {copy.bidang.items.map((item) => {
          const Icon = BIDANG_ICONS[item.id] ?? SparklesIcon
          return (
            <li key={item.id} className="bg-card rounded-2xl border p-6">
              <span className="bg-primary-soft text-secondary-foreground flex size-11 items-center justify-center rounded-xl">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-lg font-bold">{item.name}</p>
              <p className="text-muted-foreground mt-1">{item.text}</p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
