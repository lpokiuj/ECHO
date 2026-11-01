import { TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { messages } from '@/lib/messages'

interface ErrorStateProps {
  title?: string
  /** A plain Indonesian sentence. Never raw backend text or codes. */
  description?: string
  onRetry?: () => void
  retryLabel?: string
  retrying?: boolean
}

export function ErrorState({
  title = messages.states.genericErrorTitle,
  description = messages.states.genericError,
  onRetry,
  retryLabel = messages.common.retry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-card flex flex-col items-center gap-3 rounded-lg border px-4 py-10 text-center"
    >
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <TriangleAlertIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-prose text-base">{description}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} loading={retrying}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
