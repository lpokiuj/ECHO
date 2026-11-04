import { errorMessage } from '@/api/errors'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { useMe } from '@/features/auth/useMe'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { MyAbsencesCard } from './MyAbsencesCard'
import { RecordAbsences } from './RecordAbsences'

const t = messages.attendance

export function AttendancePage() {
  useDocumentTitle(t.title)
  const me = useMe()
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {me.isPending ? (
        <ListSkeleton rows={3} />
      ) : me.data === undefined ? (
        <ErrorState
          title={t.mine.errorTitle}
          description={errorMessage(me.error)}
          onRetry={() => void me.refetch()}
          retrying={me.isRefetching}
        />
      ) : (
        <>
          <MyAbsencesCard />
          <RecordAbsences me={me.data} />
        </>
      )}
    </>
  )
}
