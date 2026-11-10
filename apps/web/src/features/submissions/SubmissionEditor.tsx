import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, normalizeError } from '@/api/errors'
import type { SubmissionHandler, UpdateSubmissionBody } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { fillMessage, messages } from '@/lib/messages'
import { handledText } from './handledText'
import type { AnyStatus } from './submissionStatus'

const t = messages.submissions
export const NOTE_MAX = 1000

interface Item<S extends AnyStatus> {
  id: string
  status: S
  adminNote: string | null
  handledBy: SubmissionHandler | null
  handledAt: string | null
}

interface EditorProps<S extends AnyStatus> {
  item: Item<S>
  statuses: readonly S[]
  /** Names the submitter in the delete dialog. */
  displayName: string
  listPath: string
  deleteAria: string
  save(body: UpdateSubmissionBody<S>): Promise<unknown>
  remove(): Promise<unknown>
  saving: boolean
  deleting: boolean
}

/** Status, admin note and delete for one submission. Keyed by the parent per item id. */
export function SubmissionEditor<S extends AnyStatus>({
  item,
  statuses,
  displayName,
  listPath,
  deleteAria,
  save,
  remove,
  saving,
  deleting,
}: EditorProps<S>) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<S>(item.status)
  const [note, setNote] = useState(item.adminNote ?? '')
  const [confirming, setConfirming] = useState(false)

  const trimmed = note.trim()
  const statusChanged = status !== item.status
  const noteChanged = trimmed !== (item.adminNote ?? '')
  const changed = statusChanged || noteChanged

  const leave = () => navigate(listPath, { replace: true })

  async function onSave() {
    if (!changed || saving) return
    const body: UpdateSubmissionBody<S> = {}
    if (statusChanged) body.status = status
    if (noteChanged) body.adminNote = trimmed === '' ? null : trimmed
    try {
      await save(body)
      toast.success(t.toast.saved)
    } catch (error) {
      if (normalizeError(error).kind === 'notFound') {
        toast.error(t.toast.gone)
        leave()
      } else toast.error(errorMessage(error))
    }
  }

  async function onDelete() {
    if (deleting) return
    try {
      await remove()
      toast.success(t.toast.deleted)
      leave()
    } catch (error) {
      if (normalizeError(error).kind === 'notFound') {
        toast.error(t.toast.gone)
        leave()
      } else toast.error(errorMessage(error))
    }
    setConfirming(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="submission-status">{t.statusLabel}</Label>
        <Select value={status} onValueChange={(v) => setStatus(statuses.find((s) => s === v) ?? status)}>
          <SelectTrigger id="submission-status" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t.statuses[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="submission-note">{t.noteLabel}</Label>
        <Textarea
          id="submission-note"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby="submission-note-hint"
        />
        <p id="submission-note-hint" className="text-muted-foreground flex justify-between gap-3 text-sm">
          <span>{t.noteHint}</span>
          <span>{fillMessage(t.noteCounter, { count: note.length, max: NOTE_MAX })}</span>
        </p>
      </div>
      <p className="text-muted-foreground text-base">
        <span className="font-medium">{t.handledBy}: </span>
        {handledText(item.handledBy, item.handledAt)}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1">
          <Button onClick={() => void onSave()} loading={saving} disabled={!changed}>
            {t.save}
          </Button>
          {changed ? null : <p className="text-muted-foreground text-sm">{t.noChanges}</p>}
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          aria-label={`${deleteAria}: ${displayName}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2Icon aria-hidden="true" />
          {t.deleteButton}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.confirmDelete.title}
        description={
          <>
            <strong className="break-words">{displayName}</strong>
            <br />
            {t.confirmDelete.description}
          </>
        }
        confirmLabel={t.confirmDelete.action}
        destructive
        pending={deleting}
        onConfirm={() => void onDelete()}
      />
    </div>
  )
}
