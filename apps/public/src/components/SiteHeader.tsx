import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { MobileNav } from '@/components/MobileNav'
import { Button } from '@/components/ui/button'
import { site } from '@/content/site'

/** Sticky header: logo, section links and the volunteer button; a burger sheet below lg. */
export function SiteHeader() {
  return (
    <header className="bg-background/90 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="max-w-site h-header mx-auto flex w-full items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          aria-label={site.brand.logoLabel}
          className="focus-visible:outline-ring -ml-1 rounded-lg px-1 py-2"
        >
          <Logo />
        </Link>
        <nav aria-label={site.a11y.mainNav} className="hidden items-center gap-1 lg:flex">
          {site.nav.items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="hover:bg-muted text-foreground rounded-lg px-3 py-2 text-sm font-semibold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="hidden lg:inline-flex">
            <Link to={site.nav.cta.to}>{site.nav.cta.label}</Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
