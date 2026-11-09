import { useEffect } from 'react'
import { site } from '@/content/site'

/** Sets "<page> | ECHO" as the document title for the current route. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${site.brand.name}` : site.brand.name
  }, [title])
}
