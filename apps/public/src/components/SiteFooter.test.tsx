import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { site } from '@/content/site'
import { SiteFooter } from './SiteFooter'

describe('SiteFooter', () => {
  it('links "Portal Relawan" to the default same-origin portal path', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: site.footer.portalLinkLabel })).toHaveAttribute(
      'href',
      '/volunteer-portal/',
    )
  })

  it('links "Portal Relawan" to VITE_PORTAL_URL when set', () => {
    vi.stubEnv('VITE_PORTAL_URL', 'http://localhost:9999/volunteer-portal/')
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: site.footer.portalLinkLabel })).toHaveAttribute(
      'href',
      'http://localhost:9999/volunteer-portal/',
    )
  })

  it('shows the contact and social placeholders and the logo wordmark', () => {
    render(<SiteFooter />)
    expect(screen.getByText(site.contact.address)).toBeInTheDocument()
    expect(screen.getByText(site.contact.whatsapp)).toBeInTheDocument()
    for (const item of site.socials.items) {
      expect(screen.getByText(`${item.label}: ${item.handle}`)).toBeInTheDocument()
    }
    expect(screen.getByText(site.brand.name)).toBeInTheDocument()
  })
})
