import { messages } from '@/lib/messages'

export function PlaceholderPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">{messages.placeholder.title}</h1>
      <p className="mt-2">{messages.placeholder.description}</p>
    </main>
  )
}
