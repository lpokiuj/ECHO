import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { site } from '@/content/site'

/** The burger menu (below lg): a sheet with the section links and the volunteer button. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={site.a11y.openMenu}>
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{site.a11y.menuTitle}</SheetTitle>
          <SheetDescription className="sr-only">{site.a11y.menuDescription}</SheetDescription>
        </SheetHeader>
        <nav aria-label={site.a11y.mobileNav} className="flex flex-col gap-1 px-4">
          {site.nav.items.map((item) => (
            <SheetClose asChild key={item.id}>
              <Link
                to={item.to}
                className="hover:bg-muted flex min-h-12 items-center rounded-lg px-3 text-lg font-semibold"
              >
                {item.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <SheetClose asChild>
            <Button asChild size="lg" className="w-full">
              <Link to={site.nav.cta.to}>{site.nav.cta.label}</Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}
