import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError, errorMessage, normalizeError } from '@/api/errors'
import type { User, UserRole } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/features/auth/FormField'
import { messages } from '@/lib/messages'
import {
  EMPTY_VALUES,
  buildUpdateBody,
  userSchema,
  valuesFromUser,
  type UserFormValues,
} from './userSchema'
import { useCreateUser, useUpdateUser } from './useUsers'

const t = messages.users
const f = t.form
const ROLES: UserRole[] = ['MEMBER', 'PEMBINA', 'ADMIN']

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  user?: User
  /** The logged-in admin's id, from GET /me. Own role and active flag are locked. */
  meId?: string
}

export function UserFormDialog({ open, onOpenChange, user, meId }: UserFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so every opening starts from fresh values. */}
        {open ? <UserForm user={user} meId={meId} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

const FIELD_MAP = { name: 'name', email: 'email', role: 'role' } as const

function UserForm({ user, meId, onDone }: { user?: User; meId?: string; onDone: () => void }) {
  const editing = user !== undefined
  const isSelf = editing && user.id === meId
  const original = useMemo(() => (user ? valuesFromUser(user) : undefined), [user])
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: original ?? EMPTY_VALUES,
  })
  const create = useCreateUser()
  const update = useUpdateUser()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<UserFormValues | null>(null)
  const pending = create.isPending || update.isPending
  const { errors } = form.formState

  function showServerError(error: unknown, sentRoleOrActive: boolean) {
    const e = normalizeError(error)
    if (e.kind === 'notFound') {
      toast.error(t.toast.gone)
      onDone()
      return
    }
    if (e.kind === 'conflict' && e.status === 409) {
      form.setError('email', { message: t.emailTaken })
      return
    }
    let placed = false
    if (e instanceof ApiError) {
      for (const [serverField, text] of Object.entries(e.fieldErrors)) {
        const field = FIELD_MAP[serverField as keyof typeof FIELD_MAP]
        if (field) {
          form.setError(field, { message: text })
          placed = true
        }
      }
    }
    if (placed) return
    // A 400 with no field name on a request that carried role/isActive: self change or
    // leader-to-PEMBINA. The two look the same by shape, so one sentence covers both.
    if (e.kind === 'validation' && sentRoleOrActive) {
      setFormError(t.roleOrActiveRejected)
      return
    }
    setFormError(errorMessage(e))
  }

  async function save(values: UserFormValues) {
    setFormError(null)
    let sent = false
    try {
      if (user && original) {
        const body = buildUpdateBody(original, values, isSelf)
        if (Object.keys(body).length === 0) {
          setFormError(f.noChanges)
          return
        }
        sent = body.role !== undefined || body.isActive !== undefined
        await update.mutateAsync({ id: user.id, body })
        toast.success(t.toast.updated)
      } else {
        await create.mutateAsync({
          name: values.name.trim(),
          email: values.email.trim(),
          role: values.role,
        })
        toast.success(t.toast.created)
      }
      onDone()
    } catch (error) {
      showServerError(error, sent)
    }
  }

  function onSubmit(values: UserFormValues) {
    // Turning an account off ends its sessions at once, so it asks first.
    if (original && !isSelf && original.isActive && !values.isActive) {
      setConfirming(values)
      return
    }
    void save(values)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? f.editTitle : f.createTitle}</DialogTitle>
        <DialogDescription>{editing ? f.editDescription : f.createDescription}</DialogDescription>
      </DialogHeader>
      <FormField
        id="user-name"
        label={f.nameLabel}
        error={errors.name?.message}
        autoComplete="off"
        {...form.register('name')}
      />
      <FormField
        id="user-email"
        type="email"
        label={f.emailLabel}
        error={errors.email?.message}
        autoComplete="off"
        {...form.register('email')}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="user-role">{f.roleLabel}</Label>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
              <SelectTrigger
                id="user-role"
                className="w-full"
                aria-invalid={errors.role ? true : undefined}
                aria-describedby={isSelf ? 'user-self-hint' : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {messages.roles[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.role ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.role.message}
          </p>
        ) : null}
      </div>
      {editing ? (
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-base">
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isSelf}
                aria-describedby={isSelf ? 'user-self-hint' : undefined}
              />
              {f.activeLabel}
            </label>
          )}
        />
      ) : null}
      {isSelf ? (
        <p id="user-self-hint" className="text-muted-foreground text-sm">
          {f.selfHint}
        </p>
      ) : null}
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
          {editing ? f.submitEdit : f.submitCreate}
        </Button>
      </DialogFooter>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null)
        }}
        title={t.confirmDeactivate.title}
        description={
          <>
            <strong className="break-words">{user?.name}</strong>
            <br />
            {t.confirmDeactivate.description}
          </>
        }
        confirmLabel={t.confirmDeactivate.action}
        destructive
        pending={pending}
        onConfirm={() => {
          const values = confirming
          setConfirming(null)
          if (values) void save(values)
        }}
      />
    </form>
  )
}
