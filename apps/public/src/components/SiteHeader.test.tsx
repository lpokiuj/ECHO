import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { site } from '@/content/site'
import { renderApp } from '@/test/render'

describe('SiteHeader', () => {
  it('has a skip link, one main landmark, the logo link and the desktop nav', () => {
    renderApp('/')
    expect(screen.getByRole('link', { name: site.a11y.skipToContent })).toHaveAttribute(
      'href',
      '#main',
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('link', { name: site.brand.logoLabel })).toHaveAttribute('href', '/')
    const nav = screen.getByRole('navigation', { name: site.a11y.mainNav })
    for (const item of site.nav.items) {
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute('href', item.to)
    }
  })

  it('opens the burger sheet, lists the links and closes after choosing one', async () => {
    renderApp('/')
    await userEvent.click(screen.getByRole('button', { name: site.a11y.openMenu }))
    const dialog = await screen.findByRole('dialog', { name: site.a11y.menuTitle })
    for (const item of site.nav.items) {
      expect(within(dialog).getByRole('link', { name: item.label })).toBeInTheDocument()
    }
    expect(within(dialog).getByRole('link', { name: site.nav.cta.label })).toHaveAttribute(
      'href',
      site.nav.cta.to,
    )
    await userEvent.click(within(dialog).getByRole('link', { name: 'Doa' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: site.pages.prayer.title }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the sheet with the close button', async () => {
    renderApp('/')
    await userEvent.click(screen.getByRole('button', { name: site.a11y.openMenu }))
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: site.a11y.close }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
