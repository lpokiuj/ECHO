import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage, normalizeError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { AuthLayout } from './AuthLayout'
import { FormField } from './FormField'
import { useChangePassword, useLogout } from './useAuthActions'

const schema = z
  .object({
    currentPassword: z.string().min(1, messages.auth.required),
    newPassword: z.string().min(8, messages.auth.passwordTooShort),
    confirmPassword: z.string().min(1, messages.auth.required),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: messages.auth.passwordMismatch,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: messages.auth.passwordSameAsCurrent,
  })
type Values = z.infer<typeof schema>

export function ChangePasswordPage() {
  useDocumentTitle(messages.auth.changePasswordTitle)
  const change = useChangePassword()
  const logout = useLogout()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = ({ currentPassword, newPassword }: Values) => {
    setFormError(null)
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => toast.success(messages.auth.changePasswordSuccess),
        onError: (error) => {
          const e = normalizeError(error)
          if (e.kind === 'wrongCurrentPassword') {
            setError('currentPassword', { message: messages.errors.wrongCurrentPassword })
          } else if (e.kind === 'validation' && e.fieldErrors.newPassword) {
            setError('newPassword', { message: e.fieldErrors.newPassword })
          } else if (e.kind === 'validation') {
            // New equals current is a 400 without a field name; it is the only other 400 here.
            setError('newPassword', { message: messages.auth.passwordSameAsCurrent })
          } else {
            setFormError(errorMessage(e))
          }
        },
      },
    )
  }

  return (
    <AuthLayout
      title={messages.auth.changePasswordTitle}
      description={messages.auth.changePasswordDescription}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          label={messages.auth.currentPasswordLabel}
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <FormField
          id="newPassword"
          type="password"
          autoComplete="new-password"
          label={messages.auth.newPasswordLabel}
          hint={messages.auth.newPasswordHint}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormField
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          label={messages.auth.confirmPasswordLabel}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div aria-live="polite">
          {formError ? (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" loading={change.isPending}>
          {messages.auth.changePasswordSubmit}
        </Button>
        <Button type="button" variant="ghost" onClick={logout}>
          {messages.auth.logout}
        </Button>
      </form>
    </AuthLayout>
  )
}
