import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '@/routes/router'
import { messages } from '@/lib/messages'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('AppShell', () => {
  it('has a skip link, a sidebar nav and one main landmark', () => {
    renderAt('/')
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
    expect(
      within(nav).getByRole('link', { name: new RegExp(messages.nav.design) }),
    ).toBeInTheDocument()
  })

  it('opens the menu sheet from the top bar button', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('button', { name: messages.nav.openMenu }))
    const dialog = await screen.findByRole('dialog', { name: messages.nav.menuTitle })
    expect(within(dialog).getByRole('link', { name: messages.nav.home })).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole('link', { name: new RegExp(messages.nav.design) }),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: messages.design.title }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the not-found page for an unknown route', () => {
    renderAt('/tidak-ada')
    expect(
      screen.getByRole('heading', { level: 1, name: messages.notFound.title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: messages.common.back })).toHaveAttribute('href', '/')
  })
})
