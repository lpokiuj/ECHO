import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { useMe } from '@/features/auth/useMe'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'

export function PlaceholderPage() {
  useDocumentTitle()
  const { data: me } = useMe()
  return (
    <>
      <PageHeader
        title={messages.placeholder.title}
        description={messages.placeholder.description}
      />
      {me ? (
        <p className="flex flex-wrap items-center gap-2 text-base">
          <span>{messages.placeholder.greeting}</span>
          <span className="font-medium">{me.name}</span>
          <RoleBadge role={me.role} />
        </p>
      ) : null}
    </>
  )
}
