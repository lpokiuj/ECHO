import { AtSignIcon, MailIcon, MessageCircleIcon, type LucideIcon } from 'lucide-react'
import { Section } from '@/components/Section'
import { site } from '@/content/site'

/** Kontak: WhatsApp, Instagram and email as plain-text placeholders (no links until real values). */
export function ContactSection() {
  const copy = site.sections.contact
  const instagram = site.socials.items.find((item) => item.id === 'instagram')
  const rows: { id: string; label: string; value: string; Icon: LucideIcon }[] = [
    { id: 'whatsapp', label: copy.whatsappLabel, value: site.contact.whatsapp, Icon: MessageCircleIcon },
    {
      id: 'instagram',
      label: instagram?.label ?? '',
      value: instagram?.handle ?? '',
      Icon: AtSignIcon,
    },
    { id: 'email', label: copy.emailLabel, value: site.contact.email, Icon: MailIcon },
  ]
  return (
    <Section id={copy.id} title={copy.title} intro={copy.intro}>
      <ul className="grid gap-4 md:grid-cols-3">
        {rows.map(({ id, label, value, Icon }) => (
          <li key={id} className="bg-card flex items-start gap-4 rounded-2xl border p-6">
            <span className="bg-primary-soft text-secondary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold">{label}</p>
              <p className="text-muted-foreground mt-1 break-words">{value}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
