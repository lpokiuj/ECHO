import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { site } from '@/content/site'
import { renderApp } from '@/test/render'

describe('router', () => {
  it('renders the home shell with the hero and every section anchor', async () => {
    const { container } = renderApp('/')
    expect(screen.getByRole('heading', { level: 1, name: site.hero.title })).toBeInTheDocument()
    for (const section of Object.values(site.sections)) {
      expect(container.querySelector(`section#${section.id}`)).not.toBeNull()
      expect(screen.getByRole('heading', { level: 2, name: section.title })).toBeInTheDocument()
    }
    expect(await screen.findByRole('heading', { name: /Kegiatan contoh 1/ })).toBeInTheDocument()
    expect(document.title).toBe(site.brand.name)
  })

  it('has no Doa or Relawan call-to-action sections on home (they are pages, not sections)', () => {
    const { container } = renderApp('/')
    expect(container.querySelector('section#doa')).toBeNull()
    expect(container.querySelector('section#relawan')).toBeNull()
    expect(container.querySelector('section#bidang')).toBeNull()
  })

  it('renders /doa and /relawan with their own heading and title', () => {
    renderApp('/doa')
    expect(
      screen.getByRole('heading', { level: 1, name: site.pages.prayer.title }),
    ).toBeInTheDocument()
    expect(document.title).toBe(`${site.titles.prayer} | ${site.brand.name}`)
  })

  it('renders /relawan', () => {
    renderApp('/relawan')
    expect(
      screen.getByRole('heading', { level: 1, name: site.pages.volunteer.title }),
    ).toBeInTheDocument()
  })

  it('renders the 404 page inside the layout for an unknown path', () => {
    renderApp('/tidak-ada')
    expect(
      screen.getByRole('heading', { level: 1, name: site.pages.notFound.title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: site.pages.notFound.back })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: site.footer.portalLinkLabel })).toBeInTheDocument()
  })
})
