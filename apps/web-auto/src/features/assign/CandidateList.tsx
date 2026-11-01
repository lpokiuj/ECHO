import type { Candidate } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fillMessage, messages } from '@/lib/messages'

const t = messages.assign

interface CandidateListProps {
  candidates: Candidate[]
  selected: ReadonlySet<string>
  /** True while the service has started or a request is running. */
  locked: boolean
  /** Id of the element that explains why the controls are disabled. */
  lockReasonId?: string
  onToggle: (userId: string, checked: boolean) => void
  onUnassign: (candidate: Candidate) => void
}

interface RowProps extends Omit<CandidateListProps, 'candidates'> {
  candidate: Candidate
}

/** The whole row is the label, so the touch target is at least 44px tall. */
function NameCell({ candidate, selected, locked, lockReasonId, onToggle }: RowProps) {
  if (candidate.assigned) return <span className="min-w-0 break-words">{candidate.name}</span>
  return (
    <label className="flex min-h-11 w-full cursor-pointer items-center gap-3">
      <Checkbox
        checked={selected.has(candidate.userId)}
        disabled={locked}
        aria-describedby={locked ? lockReasonId : undefined}
        onCheckedChange={(checked) => onToggle(candidate.userId, checked === true)}
      />
      <span className="min-w-0 break-words">{candidate.name}</span>
    </label>
  )
}

function Status({ candidate }: { candidate: Candidate }) {
  return candidate.assigned ? <Badge variant="secondary">{t.assignedBadge}</Badge> : null
}

function UnassignButton({ candidate, locked, lockReasonId, onUnassign }: RowProps) {
  if (!candidate.assigned) return null
  return (
    <Button
      variant="outline"
      disabled={locked}
      aria-describedby={locked ? lockReasonId : undefined}
      aria-label={fillMessage(t.unassignAria, { name: candidate.name })}
      onClick={() => onUnassign(candidate)}
    >
      {t.unassignAction}
    </Button>
  )
}

export function CandidateList({ candidates, ...rest }: CandidateListProps) {
  return (
    <>
      <div className="hidden md:block" data-testid="candidates-table">
        <Table aria-label={t.candidatesLabel}>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columns.name}</TableHead>
              <TableHead>{t.columns.status}</TableHead>
              <TableHead>{t.columns.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.userId}>
                <TableCell className="font-medium whitespace-normal">
                  <NameCell candidate={candidate} {...rest} />
                </TableCell>
                <TableCell>
                  <Status candidate={candidate} />
                </TableCell>
                <TableCell>
                  <UnassignButton candidate={candidate} {...rest} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul
        className="flex flex-col gap-3 md:hidden"
        aria-label={t.candidatesLabel}
        data-testid="candidates-cards"
      >
        {candidates.map((candidate) => (
          <li key={candidate.userId}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2 font-medium">
                  <NameCell candidate={candidate} {...rest} />
                  <Status candidate={candidate} />
                </div>
                <UnassignButton candidate={candidate} {...rest} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}
