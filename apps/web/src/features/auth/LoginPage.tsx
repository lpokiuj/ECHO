import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errorMessage, normalizeError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'
import { AuthLayout } from './AuthLayout'
import { FormField } from './FormField'
import { useLogin } from './useAuthActions'

const schema = z.object({
  email: z
    .string()
    .min(1, messages.auth.required)
    .refine((v) => /^\S+@\S+\.\S+$/.test(v), messages.auth.invalidEmail),
  password: z.string().min(1, messages.auth.required),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  useDocumentTitle(messages.auth.loginTitle)
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const onSubmit = (values: Values) => {
    setFormError(null)
    login.mutate(values, {
      onError: (error) => {
        // One generic message for every 401, so the form never reveals which part was wrong.
        const e = normalizeError(error)
        setFormError(e.kind === 'unauthorized' ? messages.auth.loginFailed : errorMessage(e))
        resetField('password')
      },
    })
  }

  return (
    <AuthLayout title={messages.auth.loginTitle} description={messages.auth.loginDescription}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="email"
          type="email"
          autoComplete="username"
          label={messages.auth.emailLabel}
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          id="password"
          type="password"
          autoComplete="current-password"
          label={messages.auth.passwordLabel}
          error={errors.password?.message}
          {...register('password')}
        />
        <div aria-live="polite">
          {formError ? (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" loading={login.isPending}>
          {messages.auth.loginSubmit}
        </Button>
      </form>
    </AuthLayout>
  )
}
