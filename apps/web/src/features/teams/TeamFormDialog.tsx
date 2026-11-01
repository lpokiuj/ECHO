import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError, errorMessage, normalizeError } from '@/api/errors'
import type { Team } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/features/auth/FormField'
import { messages } from '@/lib/messages'
import { teamSchema, type TeamFormValues } from './teamSchema'
import { useCreateTeam, useRenameTeam } from './useTeams'

const t = messages.teams
const f = t.form

interface TeamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when renaming. */
  team?: Team
}

export function TeamFormDialog({ open, onOpenChange, team }: TeamFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so every opening starts from fresh values. */}
        {open ? <TeamForm team={team} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function TeamForm({ team, onDone }: { team?: Team; onDone: () => void }) {
  const renaming = team !== undefined
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: team?.name ?? '' },
  })
  const create = useCreateTeam()
  const rename = useRenameTeam()
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || rename.isPending
  const { errors } = form.formState

  function showServerError(error: unknown) {
    const e = normalizeError(error)
    if (e.kind === 'notFound') {
      toast.error(t.toast.gone)
      onDone()
      return
    }
    // The only 409 on POST/PATCH /teams is a duplicate name (teams.md).
    if (e.status === 409) {
      form.setError('name', { message: t.nameTaken })
      return
    }
    if (e instanceof ApiError && e.fieldErrors.name) {
      form.setError('name', { message: e.fieldErrors.name })
      return
    }
    setFormError(errorMessage(e))
  }

  async function onSubmit(values: TeamFormValues) {
    setFormError(null)
    const name = values.name.trim()
    try {
      if (team) {
        if (name === team.name) {
          onDone()
          return
        }
        await rename.mutateAsync({ id: team.id, name })
        toast.success(t.toast.renamed)
      } else {
        await create.mutateAsync(name)
        toast.success(t.toast.created)
      }
      onDone()
    } catch (error) {
      showServerError(error)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{renaming ? f.renameTitle : f.createTitle}</DialogTitle>
        <DialogDescription>
          {renaming ? f.renameDescription : f.createDescription}
        </DialogDescription>
      </DialogHeader>
      <FormField
        id="team-name"
        label={f.nameLabel}
        error={errors.name?.message}
        autoComplete="off"
        {...form.register('name')}
      />
      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          {messages.common.cancel}
        </Button>
        <Button type="submit" loading={pending}>
          {renaming ? f.submitRename : f.submitCreate}
        </Button>
      </DialogFooter>
    </form>
  )
}
