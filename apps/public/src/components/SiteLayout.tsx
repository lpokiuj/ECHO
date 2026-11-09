import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { site } from '@/content/site'

/** Scrolls to the `#hash` section after navigation, or to the top for a new page. */
function useHashScroll() {
  // `key` changes on every navigation, so clicking the same hash link again scrolls again.
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.()
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash, key])
}

export function SiteLayout() {
  useHashScroll()
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {site.a11y.skipToContent}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
