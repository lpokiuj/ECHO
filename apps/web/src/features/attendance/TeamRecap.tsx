import { UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Section } from '@/components/Section'
import type { TeamAbsenceRow } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import { fillMessage, messages } from '@/lib/messages'
import { useMemberAbsences, useTeamAbsences } from './useAttendance'

const t = messages.attendance.recap

export interface TeamOption {
  teamId: string
  teamName: string
}

function DetailButton({ teamId, row }: { teamId: string; row: TeamAbsenceRow }) {
  const [open, setOpen] = useState(false)
  const q = useMemberAbsences(teamId, row.userId, open)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          aria-label={fillMessage(t.detailAria, { name: row.name })}
        >
          {t.detail}
          <Badge variant="info">{row.count}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] overflow-hidden max-sm:max-h-[80dvh] sm:max-h-[calc(100dvh-4rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">
            {fillMessage(t.detailTitle, { name: row.name })}
          </DialogTitle>
          <DialogDescription>{t.detailDescription}</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 min-h-0 overflow-y-auto px-4" aria-live="polite">
          {q.isPending ? (
            <ListSkeleton rows={2} />
          ) : q.data === undefined ? (
            <ErrorState
              title={t.detailError}
              description={errorMessage(q.error)}
              onRetry={() => void q.refetch()}
              retrying={q.isRefetching}
            />
          ) : q.data.items.length === 0 ? (
            <p className="text-muted-foreground">{t.detailEmpty}</p>
          ) : (
            <Table aria-label={fillMessage(t.detailTitle, { name: row.name })}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.detailColumns.service}</TableHead>
                  <TableHead>{t.detailColumns.date}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((item) => (
                  <TableRow key={item.serviceId}>
                    <TableCell className="font-medium whitespace-normal">
                      <span className="break-words">{item.title}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal">{formatDate(item.startsAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Per-member miss counts for a team the viewer leads (or any team for ADMIN). */
export function TeamRecap({ teams }: { teams: TeamOption[] }) {
  const [picked, setPicked] = useState<string | undefined>()
  const teamId = teams.find((x) => x.teamId === picked)?.teamId ?? teams[0]?.teamId ?? ''
  const q = useTeamAbsences(teamId)
  return (
    <Section id="att-recap" title={t.title} description={t.description}>
      {teams.length > 1 ? (
        <div className="mb-4 flex max-w-sm flex-col gap-2">
          <Label htmlFor="recap-team">{t.teamLabel}</Label>
          <Select value={teamId} onValueChange={setPicked}>
            <SelectTrigger id="recap-team" className="h-auto min-h-11 w-full py-2">
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
        </div>
      ) : teams[0] ? (
        <p className="mb-4 font-medium break-words">{teams[0].teamName}</p>
      ) : null}
      <div aria-live="polite">
        {q.isPending ? (
          <ListSkeleton rows={3} />
        ) : q.data === undefined ? (
          <ErrorState
            title={t.errorTitle}
            description={errorMessage(q.error)}
            onRetry={() => void q.refetch()}
            retrying={q.isRefetching}
          />
        ) : q.data.length === 0 ? (
          <EmptyState icon={UsersIcon} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <>
            <div className="hidden md:block" data-testid="recap-table">
              <Table flush aria-label={t.listLabel}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columns.name}</TableHead>
                    <TableHead>{t.columns.count}</TableHead>
                    <TableHead>{t.columns.detail}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium whitespace-normal">{row.name}</TableCell>
                      <TableCell>{fillMessage(t.countValue, { count: row.count })}</TableCell>
                      <TableCell>
                        <DetailButton teamId={teamId} row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul
              className="flex flex-col divide-y md:hidden"
              aria-label={t.listLabel}
              data-testid="recap-cards"
            >
              {q.data.map((row) => (
                <li
                  key={row.userId}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 font-medium break-words">{row.name}</span>
                  <span>{fillMessage(t.countValue, { count: row.count })}</span>
                  <DetailButton teamId={teamId} row={row} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Section>
  )
}
