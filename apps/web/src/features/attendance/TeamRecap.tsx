import { UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Card, CardContent } from '@/components/ui/card'
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
import { fillMessage, messages } from '@/lib/messages'
import { useTeamAbsences } from './useAttendance'

const t = messages.attendance.recap

export interface TeamOption {
  teamId: string
  teamName: string
}

/** Per-member miss counts for a team the viewer leads (or any team for ADMIN). */
export function TeamRecap({ teams }: { teams: TeamOption[] }) {
  const [picked, setPicked] = useState<string | undefined>()
  const teamId = teams.find((x) => x.teamId === picked)?.teamId ?? teams[0]?.teamId ?? ''
  const q = useTeamAbsences(teamId)
  return (
    <section aria-labelledby="att-recap" className="mb-10">
      <h2 id="att-recap" className="text-xl font-semibold">
        {t.title}
      </h2>
      <p className="text-muted-foreground mt-1 mb-4 text-base">{t.description}</p>
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
              <Table aria-label={t.listLabel}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columns.name}</TableHead>
                    <TableHead>{t.columns.count}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium whitespace-normal">{row.name}</TableCell>
                      <TableCell>{fillMessage(t.countValue, { count: row.count })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul
              className="flex flex-col gap-3 md:hidden"
              aria-label={t.listLabel}
              data-testid="recap-cards"
            >
              {q.data.map((row) => (
                <li key={row.userId}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-medium break-words">{row.name}</span>
                      <span>{fillMessage(t.countValue, { count: row.count })}</span>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
