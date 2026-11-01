import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { NavLinks } from '@/components/NavLinks'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { messages } from '@/lib/messages'

function Brand() {
  return (
    <Link
      to="/"
      className="text-foreground flex min-h-11 items-center gap-2 rounded-md text-lg font-semibold"
    >
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold"
      >
        E
      </span>
      {messages.app.name}
    </Link>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="bg-primary text-primary-foreground fixed top-2 left-2 z-[60] flex min-h-11 -translate-y-20 items-center rounded-md px-4 focus:translate-y-0"
      >
        {messages.app.skipToContent}
      </a>

      <aside className="w-sidebar bg-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col gap-6 border-r p-4 lg:flex">
        <Brand />
        <NavLinks />
      </aside>

      <header className="h-topbar bg-background sticky top-0 z-30 flex items-center gap-2 border-b px-4 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={messages.nav.openMenu}>
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-sidebar bg-sidebar max-w-[85vw]">
            <SheetHeader>
              <SheetTitle>{messages.nav.menuTitle}</SheetTitle>
              <SheetDescription className="sr-only">
                {messages.nav.menuDescription}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      <main id="main" tabIndex={-1} className="lg:pl-sidebar">
        <div className="max-w-content mx-auto w-full px-4 py-6 md:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
