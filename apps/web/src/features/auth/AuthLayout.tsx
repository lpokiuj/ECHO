import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { messages } from '@/lib/messages'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

/** Centered card for screens shown before the app shell (login, forced password change). */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main id="main" className="bg-muted flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-foreground flex items-center justify-center gap-2 text-lg font-semibold">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold"
          >
            E
          </span>
          {messages.app.name}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl font-semibold">{title}</h1>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
