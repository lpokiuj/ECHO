import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { messages } from '@/lib/messages'
import { handlers } from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

async function renderAt(path: string) {
  server.use(handlers.me())
  const view = renderApp(path, { token: true })
  await screen.findByRole('main')
  return view
}

describe('AppShell', () => {
  it('has a skip link, a sidebar nav and one main landmark', async () => {
    await renderAt('/')
    expect(screen.getByRole('link', { name: messages.app.skipToContent })).toHaveAttribute(
      'href',
      '#main',
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
    const nav = screen.getByRole('navigation', { name: messages.nav.label })
    expect(within(nav).getByRole('link', { name: messages.nav.home })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: messages.nav.mySchedule })).toBeInTheDocument()
  })

  it('opens the menu sheet from the top bar button', async () => {
    await renderAt('/')
    await userEvent.click(screen.getByRole('button', { name: messages.nav.openMenu }))
    const dialog = await screen.findByRole('dialog', { name: messages.nav.menuTitle })
    expect(within(dialog).getByRole('link', { name: messages.nav.home })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('link', { name: messages.nav.mySchedule }))
    expect(
      await screen.findByRole('heading', { level: 1, name: messages.schedule.myTitle }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the not-found page for an unknown route', async () => {
    await renderAt('/tidak-ada')
    expect(
      screen.getByRole('heading', { level: 1, name: messages.notFound.title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: messages.common.back })).toHaveAttribute('href', '/')
  })
})
