import { screen, within } from '@testing-library/react'
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

  it('links to the two schedules', async () => {
    server.use(handlers.me())
    renderApp('/', { token: true })
    const links = await screen.findByRole('navigation', { name: messages.placeholder.linksLabel })
    expect(within(links).getByRole('link', { name: messages.nav.mySchedule })).toHaveAttribute(
      'href',
      '/my-schedule',
    )
    expect(within(links).getByRole('link', { name: messages.nav.fullSchedule })).toHaveAttribute(
      'href',
      '/schedule',
    )
  })

  it('keeps the tile link name to the title and describes it with the description', async () => {
    server.use(handlers.me())
    renderApp('/', { token: true })
    const links = await screen.findByRole('navigation', { name: messages.placeholder.linksLabel })
    expect(
      within(links).getByRole('link', { name: messages.nav.mySchedule }),
    ).toHaveAccessibleDescription(messages.placeholder.mineDescription)
    expect(
      within(links).getByRole('link', { name: messages.nav.fullSchedule }),
    ).toHaveAccessibleDescription(messages.placeholder.fullDescription)
  })
})
