import { ClipboardXIcon, InfoIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { MeResponse, ServiceSchedule } from '@/api/types'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Section } from '@/components/Section'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TakerPicker } from '@/features/assign/TakerPicker'
import { useServices } from '@/features/schedule/useSchedule'
import { formatDate, isFuture } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { useRecordAbsence, useServiceTeamAbsences } from './useAttendance'

const t = messages.attendance.record

interface Slot {
  key: string
  service: ServiceSchedule
  teamId: string
  teamName: string
}

/**
 * The (service, team) pairs this person can act on: teams where they are the absent-taker, teams
 * they lead (even when not assigned to the service), and, for ADMIN, every team that has someone
 * assigned.
 */
export function slotsFor(me: MeResponse, services: ServiceSchedule[]): Slot[] {
  const slots: Slot[] = []
  const ledTeams = new Set(me.memberships.filter((m) => m.isLeader).map((m) => m.teamId))
  for (const service of services) {
    const seen = new Set<string>()
    for (const a of service.assignments) {
      if (seen.has(a.teamId)) continue
      const mine = service.assignments.some(
        (x) => x.teamId === a.teamId && x.userId === me.id && x.isAbsentTaker,
      )
      if (me.role === 'ADMIN' || mine || ledTeams.has(a.teamId)) {
        seen.add(a.teamId)
        slots.push({
          key: `${service.id}:${a.teamId}`,
          service,
          teamId: a.teamId,
          teamName: a.teamName,
        })
      }
    }
  }
  return slots
}

function AbsenceRows({ slot, meId }: { slot: Slot; meId: string }) {
  const record = useRecordAbsence(slot.service.id, slot.teamId)
  const recorded = useServiceTeamAbsences(slot.service.id, slot.teamId)
  const absent = new Set(recorded.data?.userIds ?? [])
  const sending = useRef(false)
  const started = !isFuture(slot.service.startsAt)
  const members = slot.service.assignments.filter((a) => a.teamId === slot.teamId)

  async function toggle(userId: string, name: string, next: boolean) {
    if (sending.current) return
    sending.current = true
    try {
      await record.mutateAsync({ userId, absent: next })
      toast.success(fillMessage(next ? t.recorded : t.cleared, { name }))
    } catch (error) {
      const e = normalizeError(error)
      toast.error(e.code === 'INVALID_USERS' ? t.invalid : errorMessage(e))
    } finally {
      sending.current = false
    }
  }

  return (
    <div>
      {!started ? (
        <div role="note" className="bg-muted mb-4 flex items-start gap-3 rounded-lg border p-4">
          <InfoIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{t.notStartedNotice}</p>
        </div>
      ) : null}
      {recorded.isPending ? (
        <ListSkeleton rows={members.length || 3} />
      ) : recorded.data === undefined ? (
        <ErrorState
          title={t.statusErrorTitle}
          description={errorMessage(recorded.error)}
          onRetry={() => void recorded.refetch()}
          retrying={recorded.isRefetching}
        />
      ) : members.length === 0 ? (
        <p className="text-muted-foreground">{t.noMembers}</p>
      ) : (
        <ul aria-label={t.membersLabel} className="flex flex-col divide-y">
          {members.map((m) => {
            const self = m.userId === meId
            const id = `absent-${m.userId}`
            return (
              <li
                key={m.userId}
                className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="min-w-0 pt-3 font-medium break-words sm:py-3">{m.name}</span>
                <div className="flex flex-col items-start sm:items-end">
                  <label
                    htmlFor={id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 text-base"
                  >
                    {absent.has(m.userId) ? t.absentToggle : t.presentToggle}
                    <Switch
                      id={id}
                      aria-label={fillMessage(t.absentAria, { name: m.name })}
                      checked={absent.has(m.userId)}
                      disabled={!started || self || record.isPending}
                      onCheckedChange={(v) => void toggle(m.userId, m.name, v)}
                    />
                  </label>
                  {self ? (
                    <span className="text-muted-foreground pb-2 text-sm">{t.selfDisabled}</span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Absent-taker recording (and, for ADMIN, designation) for services the viewer can act on. */
export function RecordAbsences({ me }: { me: MeResponse }) {
  const services = useServices(true)
  const [picked, setPicked] = useState<string | undefined>()
  const isAdmin = me.role === 'ADMIN'
  const slots = services.data ? slotsFor(me, services.data) : []
  const slot = slots.find((s) => s.key === picked) ?? slots[0]
  const members = slot ? slot.service.assignments.filter((a) => a.teamId === slot.teamId) : []

  return (
    <Section id="att-record" title={t.title} description={t.description} className="mb-6">
      <div aria-live="polite">
        {services.isPending ? (
          <ListSkeleton rows={3} />
        ) : services.data === undefined ? (
          <ErrorState
            title={t.loadErrorTitle}
            description={errorMessage(services.error)}
            onRetry={() => void services.refetch()}
            retrying={services.isRefetching}
          />
        ) : !slot ? (
          <EmptyState icon={ClipboardXIcon} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <>
            <div className="mb-4 flex max-w-xl flex-col gap-2">
              <Label htmlFor="record-slot">{t.serviceLabel}</Label>
              <Select value={slot.key} onValueChange={setPicked}>
                <SelectTrigger
                  id="record-slot"
                  className="h-auto min-h-11 w-full py-2 text-left whitespace-normal *:data-[slot=select-value]:line-clamp-2"
                >
                  <SelectValue placeholder={t.selectService} />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.service.title}, {formatDate(s.service.startsAt)}, {s.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AbsenceRows key={slot.key} slot={slot} meId={me.id} />
            {isAdmin ? (
              <TakerPicker
                key={`taker-${slot.key}`}
                serviceId={slot.service.id}
                teamId={slot.teamId}
                idPrefix="record"
                headingLevel={3}
                members={members.map((m) => ({ userId: m.userId, name: m.name }))}
                currentId={members.find((m) => m.isAbsentTaker)?.userId}
              />
            ) : null}
          </>
        )}
      </div>
    </Section>
  )
}
