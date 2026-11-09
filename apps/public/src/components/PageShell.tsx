import type { ReactNode } from 'react'

interface PageShellProps {
  title: string
  description: string
  children?: ReactNode
}

/** A standalone page: one h1, a short description and an optional body (forms, actions). */
export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="max-w-site mx-auto w-full px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-lg">{description}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  )
}
