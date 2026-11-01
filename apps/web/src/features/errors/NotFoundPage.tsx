import { SearchXIcon } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'

export function NotFoundPage() {
  useDocumentTitle(messages.notFound.title)
  return (
    <>
      <PageHeader title={messages.notFound.title} description={messages.notFound.description} />
      <EmptyState
        icon={SearchXIcon}
        title={messages.notFound.title}
        description={messages.notFound.description}
        action={
          <Button asChild>
            <Link to="/">{messages.common.back}</Link>
          </Button>
        }
      />
    </>
  )
}
