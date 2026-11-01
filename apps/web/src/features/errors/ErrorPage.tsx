import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'

/** Route error element. Shows a plain sentence and a reload action, never the error text. */
export function ErrorPage() {
  useDocumentTitle(messages.errorPage.title)
  return (
    <main className="max-w-content mx-auto w-full px-4 py-8">
      <PageHeader title={messages.errorPage.title} description={messages.errorPage.description} />
      <ErrorState
        title={messages.errorPage.title}
        description={messages.errorPage.description}
        retryLabel={messages.errorPage.reload}
        onRetry={() => window.location.reload()}
      />
    </main>
  )
}
