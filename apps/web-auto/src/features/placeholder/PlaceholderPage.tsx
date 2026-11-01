import { PageHeader } from '@/components/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'

export function PlaceholderPage() {
  useDocumentTitle()
  return (
    <PageHeader title={messages.placeholder.title} description={messages.placeholder.description} />
  )
}
