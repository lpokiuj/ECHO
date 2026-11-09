import {
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  MusicIcon,
  SmileIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { Section } from '@/components/Section'
import { site } from '@/content/site'

// Icons are presentation, not copy: keyed by the content item id.
const EXPECT_ICONS: Record<string, LucideIcon> = {
  musik: MusicIcon,
  firman: BookOpenIcon,
  komunitas: UsersIcon,
  ramah: SmileIcon,
}

/** Ibadah: the service schedule and what to expect. Static content, so no loading or error state. */
export function WorshipSection() {
  const copy = site.sections.worship
  return (
    <Section id={copy.id} title={copy.title} intro={copy.intro} tone="muted">
      <h3 className="text-xl font-bold">{copy.schedule.title}</h3>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {copy.schedule.items.map((item) => (
          <li key={item.id} className="bg-card rounded-2xl border p-6 shadow-sm">
            <p className="text-lg font-bold">{item.name}</p>
            <p className="text-muted-foreground mt-3 flex items-center gap-2">
              <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
              {item.day}
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
              <ClockIcon className="size-5 shrink-0" aria-hidden="true" />
              {item.time}
            </p>
          </li>
        ))}
      </ul>

      <h3 className="mt-12 text-xl font-bold">{copy.expect.title}</h3>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {copy.expect.items.map((item) => {
          const Icon = EXPECT_ICONS[item.id] ?? SparklesIcon
          return (
            <li key={item.id} className="bg-card rounded-2xl border p-6">
              <span className="bg-primary-soft text-secondary-foreground flex size-11 items-center justify-center rounded-xl">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-lg font-bold">{item.title}</p>
              <p className="text-muted-foreground mt-1">{item.text}</p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
