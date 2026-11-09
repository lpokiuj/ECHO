import { AtSignIcon, MapPinIcon, MessageCircleIcon, MailIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { site } from '@/content/site'
import { getPortalUrl } from '@/lib/env'

/** Footer: logo, contact and social placeholders, and the link to the volunteer portal. */
export function SiteFooter() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="max-w-site mx-auto grid w-full gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p>{site.brand.tagline}</p>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-bold">{site.contact.title}</h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
              {site.contact.address}
            </li>
            <li className="flex items-center gap-2">
              <MessageCircleIcon className="size-4 shrink-0" aria-hidden="true" />
              {site.contact.whatsapp}
            </li>
            <li className="flex items-center gap-2">
              <MailIcon className="size-4 shrink-0" aria-hidden="true" />
              {site.contact.email}
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-bold">{site.socials.title}</h2>
          <ul className="space-y-2">
            {site.socials.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <AtSignIcon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}: {item.handle}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-secondary-foreground/20 border-t">
        <div className="max-w-site mx-auto flex w-full flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm">{site.footer.copyright(new Date().getFullYear())}</p>
          <a
            href={getPortalUrl()}
            className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            {site.footer.portalLinkLabel}
          </a>
        </div>
      </div>
    </footer>
  )
}
