import { CheckCircle2Icon, MinusCircleIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fillMessage, messages } from '@/lib/messages'

const t = messages.assign.result

export interface AssignOutcome {
  added: string[]
  skipped: { name: string; reason: string }[]
}

/** Who was added and who was skipped (with the reason) after one assign request. */
export function ResultPanel({
  outcome,
  onDismiss,
}: {
  outcome: AssignOutcome
  onDismiss: () => void
}) {
  const { added, skipped } = outcome
  return (
    <Card className="mb-4" data-testid="assign-result">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <Button variant="ghost" size="icon" aria-label={t.dismiss} onClick={onDismiss}>
            <XIcon />
          </Button>
        </div>
        {added.length === 0 ? <p className="text-muted-foreground">{t.noneAdded}</p> : null}
        {added.length > 0 ? (
          <section aria-label={fillMessage(t.added, { count: added.length })}>
            <h3 className="mb-2 flex items-center gap-2 font-medium">
              <CheckCircle2Icon className="text-primary size-5" aria-hidden="true" />
              {fillMessage(t.added, { count: added.length })}
            </h3>
            <ul className="ml-7 list-disc break-words">
              {added.map((name, i) => (
                <li key={`${name}-${i}`}>{name}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {skipped.length > 0 ? (
          <section aria-label={fillMessage(t.skipped, { count: skipped.length })}>
            <h3 className="mb-2 flex items-center gap-2 font-medium">
              <MinusCircleIcon className="text-muted-foreground size-5" aria-hidden="true" />
              {fillMessage(t.skipped, { count: skipped.length })}
            </h3>
            <ul className="ml-7 list-disc break-words">
              {skipped.map((entry, i) => (
                <li key={`${entry.name}-${i}`}>
                  <strong>{entry.name}</strong>: {entry.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}
