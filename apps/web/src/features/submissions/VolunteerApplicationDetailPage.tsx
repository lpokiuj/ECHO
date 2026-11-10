import { useParams } from 'react-router'
import { Section } from '@/components/Section'
import { formatDate, formatTime } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { PATHS } from '@/routes/paths'
import { Field } from './Field'
import { StatusBadge } from './StatusBadge'
import { SubmissionDetailShell } from './SubmissionDetailShell'
import { SubmissionEditor } from './SubmissionEditor'
import { VOLUNTEER_STATUSES } from './submissionStatus'
import {
  useDeleteVolunteerApplication,
  useUpdateVolunteerApplication,
  useVolunteerApplication,
} from './useSubmissions'

const t = messages.submissions
const v = t.volunteer

const when = (iso: string) => fillMessage(t.handledAtOnly, { date: formatDate(iso), time: formatTime(iso) })

export function VolunteerApplicationDetailPage() {
  const { id = '' } = useParams()
  const query = useVolunteerApplication(id)
  const update = useUpdateVolunteerApplication()
  const remove = useDeleteVolunteerApplication()
  return (
    <SubmissionDetailShell
      title={v.detailTitle}
      description={v.detailDescription}
      loadErrorTitle={v.loadErrorTitle}
      listPath={PATHS.volunteerApplications}
      query={query}
    >
      {(a) => (
        <div className="flex flex-col gap-4">
          <Section title={t.detailSection} action={<StatusBadge status={a.status} />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label={v.fields.fullName}>{a.fullName}</Field>
              <Field label={v.fields.whatsapp}>{a.whatsapp}</Field>
              <Field label={v.fields.email}>{a.email ?? t.noValue}</Field>
              <Field label={v.fields.bidang}>
                {a.bidang.length > 0 ? a.bidang.map((b) => b.name).join(', ') : t.none}
              </Field>
              <Field label={t.receivedAt}>{when(a.createdAt)}</Field>
              <Field label={t.consentAt}>{when(a.consentAt)}</Field>
              <Field label={v.fields.availability} wide>{a.availability ?? t.noValue}</Field>
              <Field label={v.fields.message} wide>{a.message ?? t.noValue}</Field>
            </dl>
          </Section>
          <Section title={t.editSection}>
            <SubmissionEditor
              key={a.id}
              item={a}
              statuses={VOLUNTEER_STATUSES}
              displayName={a.fullName}
              listPath={PATHS.volunteerApplications}
              deleteAria={v.deleteAria}
              save={(body) => update.mutateAsync({ id: a.id, body })}
              remove={() => remove.mutateAsync(a.id)}
              saving={update.isPending}
              deleting={remove.isPending}
            />
          </Section>
        </div>
      )}
    </SubmissionDetailShell>
  )
}
