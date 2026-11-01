import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { messages } from '@/lib/messages'
import { handlers } from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

describe('PlaceholderPage', () => {
  it('shows the title, description, and a greeting with name and role badge', async () => {
    server.use(handlers.me())
    renderApp('/', { token: true })
    expect(
      await screen.findByRole('heading', { name: messages.placeholder.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(messages.placeholder.description)).toBeInTheDocument()
    expect(
      await screen.findByText('Docs Example Lead A', { selector: 'span.font-medium' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(messages.roles.MEMBER).length).toBeGreaterThan(0)
  })
})
