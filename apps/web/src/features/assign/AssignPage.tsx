import { CalendarOffIcon, InfoIcon, UsersIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { Candidate, MeResponse, ServiceSchedule } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMe } from '@/features/auth/useMe'
import { useServices } from '@/features/schedule/useSchedule'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, isFuture } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { CandidateList } from './CandidateList'
import { ResultPanel, type AssignOutcome } from './ResultPanel'
import { useAssign, useCandidates, useUnassign } from './useAssign'

const t = messages.assign

type LeaderTeam = { teamId: string; teamName: string }

const hasStarted = (service: ServiceSchedule) => !isFuture(service.startsAt)

interface WorkspaceProps {
  service: ServiceSchedule
  team: LeaderTeam
}

/** Candidates, assign and unassign for one service and one team. Remounted when either changes. */
function Workspace({ service, team }: WorkspaceProps) {
  const noticeId = useId()
  const candidates = useCandidates(service.id, team.teamId)
  const assign = useAssign(service.id, team.teamId)
  const unassign = useUnassign(service.id, team.teamId)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [outcome, setOutcome] = useState<AssignOutcome | undefined>()
  const [removing, setRemoving] = useState<Candidate | undefined>()
  const [startedByServer, setStartedByServer] = useState(false)
  // Set synchronously, before React re-renders, so a fast double click sends one request.
  const sending = useRef(false)

  const started = startedByServer || hasStarted(service)
  const busy = assign.isPending || unassign.isPending
  const locked = started || busy
  const list = candidates.data ?? []
  const unassigned = list.filter((c) => !c.assigned)
  // Only ids that are still selectable candidates are ever sent.
  const ids = unassigned.map((c) => c.userId).filter((id) => selected.has(id))

  const onToggle = (userId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })

  function notifyFailure(error: unknown) {
    const e = normalizeError(error)
    if (e.code === 'SERVICE_ALREADY_STARTED') setStartedByServer(true)
    if (e.kind === 'notFound' && e.status === 404) toast.error(t.toast.serviceGone)
    else toast.error(errorMessage(e))
  }

  async function submit() {
    if (sending.current || started || ids.length === 0) return
    sending.current = true
    const names = new Map(list.map((c) => [c.userId, c.name]))
    const nameOf = (id: string) => names.get(id) ?? t.result.unknownPerson
    try {
      const result = await assign.mutateAsync(ids)
      setOutcome({
        added: result.assigned.map(nameOf),
        skipped: result.skipped.map((entry) => ({
          name: nameOf(entry.userId),
          reason:
            entry.reason === 'ALREADY_ASSIGNED_OTHER_TEAM'
              ? fillMessage(t.result.reasonOtherTeam, { team: entry.heldByTeam?.name ?? '' })
              : t.result.reasonThisTeam,
        })),
      })
      if (result.skipped.length === 0) {
        toast.success(fillMessage(t.toast.added, { count: result.assigned.length }))
      } else if (result.assigned.length === 0) {
        toast.error(t.toast.noneAdded)
      } else {
        toast.success(
          fillMessage(t.toast.partial, {
            added: result.assigned.length,
            skipped: result.skipped.length,
          }),
        )
      }
      setSelected(new Set())
    } catch (error) {
      notifyFailure(error)
    } finally {
      sending.current = false
    }
  }

  async function confirmUnassign() {
    if (!removing || sending.current) return
    sending.current = true
    try {
      await unassign.mutateAsync(removing.userId)
      toast.success(t.toast.unassigned)
    } catch (error) {
      const e = normalizeError(error)
      if (e.status === 404 && !e.code) toast.error(t.toast.alreadyRemoved)
      else notifyFailure(e)
    } finally {
      sending.current = false
      setRemoving(undefined)
    }
  }

  return (
    <div>
      {started ? (
        <div
          id={noticeId}
          role="note"
          className="bg-muted text-foreground mb-4 flex items-start gap-3 rounded-lg border p-4"
        >
          <InfoIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{t.startedNotice}</p>
        </div>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground" aria-live="polite">
          {fillMessage(t.selectedCount, { count: ids.length })}
        </p>
        <Button
          className="max-sm:w-full"
          disabled={locked || ids.length === 0}
          loading={assign.isPending}
          aria-describedby={started ? noticeId : undefined}
          onClick={() => void submit()}
        >
          {ids.length > 0
            ? fillMessage(t.assignActionCount, { count: ids.length })
            : t.assignAction}
        </Button>
      </div>
      {outcome ? <ResultPanel outcome={outcome} onDismiss={() => setOutcome(undefined)} /> : null}
      <div aria-live="polite">
        {candidates.isPending ? (
          <ListSkeleton rows={4} />
        ) : candidates.data === undefined ? (
          <ErrorState
            title={t.loadErrorTitle}
            description={
              candidates.isError ? errorMessage(candidates.error) : t.loadErrorDescription
            }
            onRetry={() => void candidates.refetch()}
            retrying={candidates.isRefetching}
          />
        ) : list.length === 0 ? (
          <EmptyState icon={UsersIcon} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <CandidateList
            candidates={list}
            selected={selected}
            locked={locked}
            lockReasonId={started ? noticeId : undefined}
            onToggle={onToggle}
            onUnassign={setRemoving}
          />
        )}
      </div>
      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(open) => {
          if (!open && !unassign.isPending) setRemoving(undefined)
        }}
        title={t.confirmUnassign.title}
        description={
          removing
            ? fillMessage(t.confirmUnassign.description, {
                name: removing.name,
                service: service.title,
                team: team.teamName,
              })
            : null
        }
        confirmLabel={t.confirmUnassign.action}
        destructive
        pending={unassign.isPending}
        onConfirm={() => void confirmUnassign()}
      />
    </div>
  )
}

function leaderTeams(me: MeResponse): LeaderTeam[] {
  return me.memberships
    .filter((m) => m.isLeader)
    .map(({ teamId, teamName }) => ({ teamId, teamName }))
}

export function AssignPage() {
  useDocumentTitle(t.title)
  const me = useMe()
  const services = useServices(false)
  const [params, setParams] = useSearchParams()

  const teams = me.data ? leaderTeams(me.data) : []
  const list = services.data ?? []
  // Only non-secret uuids live in the URL; unknown values fall back to the first option.
  const team = teams.find((x) => x.teamId === params.get('team')) ?? teams[0]
  const service = list.find((x) => x.id === params.get('service')) ?? list[0]

  const choose = (key: 'service' | 'team', value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('service', service?.id ?? '')
        next.set('team', team?.teamId ?? '')
        next.set(key, value)
        return next
      },
      { replace: true },
    )

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {services.isPending ? (
        <ListSkeleton rows={4} />
      ) : services.data === undefined ? (
        <ErrorState
          title={messages.schedule.loadErrorTitle}
          description={services.isError ? errorMessage(services.error) : undefined}
          onRetry={() => void services.refetch()}
          retrying={services.isRefetching}
        />
      ) : !service || !team ? (
        <EmptyState
          icon={CalendarOffIcon}
          title={t.noServicesTitle}
          description={t.noServicesDescription}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="assign-service">{t.serviceLabel}</Label>
              <Select value={service.id} onValueChange={(v) => choose('service', v)}>
                <SelectTrigger
                  id="assign-service"
                  className="h-auto min-h-11 w-full py-2 text-left whitespace-normal *:data-[slot=select-value]:line-clamp-2"
                >
                  <SelectValue placeholder={t.selectService} />
                </SelectTrigger>
                <SelectContent>
                  {list.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}, {formatDate(s.startsAt)}
                      {hasStarted(s) ? ` (${t.startedBadge})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="assign-team">{t.teamLabel}</Label>
              {teams.length === 1 ? (
                <p id="assign-team" className="flex min-h-11 items-center font-medium break-words">
                  {team.teamName}
                </p>
              ) : (
                <Select value={team.teamId} onValueChange={(v) => choose('team', v)}>
                  <SelectTrigger id="assign-team" className="w-full">
                    <SelectValue placeholder={t.selectTeam} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((x) => (
                      <SelectItem key={x.teamId} value={x.teamId}>
                        {x.teamName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <Workspace key={`${service.id}:${team.teamId}`} service={service} team={team} />
        </>
      )}
    </>
  )
}
