import { useEffect } from 'react'
import { messages } from '@/lib/messages'

/** Sets "<page> | <app name>" as the document title for the current route. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${messages.app.name}` : messages.app.name
  }, [title])
}
