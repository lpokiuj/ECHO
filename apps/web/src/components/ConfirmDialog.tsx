import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { messages } from '@/lib/messages'

interface ConfirmDialogProps {
  /**
   * The element that opens the dialog. Optional: without it, focus still returns to whichever
   * element had it when the dialog opened (if that element is still on the page).
   */
  trigger?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names what will change, e.g. the service or user. */
  title: string
  description: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  destructive?: boolean
  pending?: boolean
}

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = messages.common.confirm,
  onConfirm,
  destructive = false,
  pending = false,
}: ConfirmDialogProps) {
  // A dialog opened from state has no Radix trigger, so remember who had focus and give it back.
  const returnTo = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement)
      returnTo.current = document.activeElement
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const target = returnTo.current
          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{messages.common.cancel}</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction, so the dialog stays open while pending. */}
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
