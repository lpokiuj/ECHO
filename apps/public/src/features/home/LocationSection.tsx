import { BusIcon, CarIcon, ExternalLinkIcon, MapPinIcon } from 'lucide-react'
import { Section } from '@/components/Section'
import { site } from '@/content/site'
import { mapEmbedUrl, mapOpenUrl } from '@/lib/maps'

/**
 * Lokasi: address, transport and parking notes, and a Google Maps embed. Static content, so no
 * loading or error state. A cross-origin iframe failure cannot be detected, so the open-in-Maps
 * link and the address are always visible as the fallback.
 */
export function LocationSection() {
  const copy = site.sections.location
  const map = copy.map
  return (
    <Section id={copy.id} title={copy.title} intro={copy.intro}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="bg-card rounded-2xl border p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <MapPinIcon className="size-5 shrink-0" aria-hidden="true" />
              {copy.address.title}
            </h3>
            <p className="text-muted-foreground mt-2">{copy.address.value}</p>
          </div>
          <div className="bg-card rounded-2xl border p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <BusIcon className="size-5 shrink-0" aria-hidden="true" />
              {copy.transport.title}
            </h3>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
              {copy.transport.items.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          </div>
          <div className="bg-card rounded-2xl border p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <CarIcon className="size-5 shrink-0" aria-hidden="true" />
              {copy.parking.title}
            </h3>
            <p className="text-muted-foreground mt-2">{copy.parking.text}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="bg-muted mb-2 h-80 overflow-hidden rounded-2xl border sm:h-96 lg:min-h-96 lg:flex-1">
            <iframe
              title={map.title}
              src={mapEmbedUrl(map.baseUrl, map.query)}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          </div>
          <p className="text-muted-foreground text-sm">{map.fallback}</p>
          <a
            href={mapOpenUrl(map.baseUrl, map.query)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex min-h-11 w-fit items-center gap-1 font-semibold underline underline-offset-4"
          >
            {map.openLabel}
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">{site.a11y.opensInNewTab}</span>
          </a>
        </div>
      </div>
    </Section>
  )
}
