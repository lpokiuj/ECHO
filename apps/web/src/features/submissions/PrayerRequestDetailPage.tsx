import { useParams } from 'react-router'
import { Section } from '@/components/Section'
import { formatDate, formatTime } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'
import { Field } from './Field'
import { StatusBadge } from './StatusBadge'
import { SubmissionDetailShell } from './SubmissionDetailShell'
import { SubmissionEditor } from './SubmissionEditor'
import { PRAYER_STATUSES } from './submissionStatus'
import {
  useDeletePrayerRequest,
  usePrayerRequest,
  useUpdatePrayerRequest,
} from './useSubmissions'

const t = messages.submissions
const p = t.prayer

const when = (iso: string) => fillMessage(t.handledAtOnly, { date: formatDate(iso), time: formatTime(iso) })

export function PrayerRequestDetailPage() {
  const { id = '' } = useParams()
  const query = usePrayerRequest(id)
  const update = useUpdatePrayerRequest()
  const remove = useDeletePrayerRequest()
  return (
    <SubmissionDetailShell
      title={p.detailTitle}
      description={p.detailDescription}
      loadErrorTitle={p.loadErrorTitle}
      listPath={PATHS.prayerRequests}
      query={query}
    >
      {(r) => (
        <div className="flex flex-col gap-4">
          <Section title={t.detailSection} action={<StatusBadge status={r.status} />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label={p.fields.name}>{r.name ?? t.noName}</Field>
              <Field label={p.fields.contact}>{r.contact ?? t.noValue}</Field>
              <Field label={p.fields.wantsFollowUp}>{r.wantsFollowUp ? t.yes : t.no}</Field>
              <Field label={t.receivedAt}>{when(r.createdAt)}</Field>
              <Field label={t.consentAt}>{when(r.consentAt)}</Field>
              <Field label={p.fields.content} wide>{r.content}</Field>
            </dl>
          </Section>
          <Section title={t.editSection}>
            <SubmissionEditor
              key={r.id}
              item={r}
              statuses={PRAYER_STATUSES}
              displayName={r.name ?? t.noName}
              listPath={PATHS.prayerRequests}
              deleteAria={p.deleteAria}
              save={(body) => update.mutateAsync({ id: r.id, body })}
              remove={() => remove.mutateAsync(r.id)}
              saving={update.isPending}
              deleting={remove.isPending}
            />
          </Section>
        </div>
      )}
    </SubmissionDetailShell>
  )
}
