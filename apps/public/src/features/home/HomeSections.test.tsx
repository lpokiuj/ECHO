import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { site } from '@/content/site'
import { mapEmbedUrl, mapOpenUrl } from '@/lib/maps'
import { renderApp } from '@/test/render'

const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView)

describe('HeroSection', () => {
  beforeEach(() => scrollIntoView.mockClear())

  it('shows the name, tagline, next service and both buttons with the right targets', () => {
    renderApp('/')
    const hero = within(screen.getByRole('region', { name: site.hero.title }))
    expect(hero.getByRole('heading', { level: 1, name: site.hero.title })).toBeInTheDocument()
    expect(hero.getByText(site.brand.tagline)).toBeInTheDocument()
    expect(hero.getByText(site.hero.nextService.label)).toBeInTheDocument()
    expect(hero.getByText(site.hero.nextService.value, { exact: false })).toBeInTheDocument()
    expect(hero.getByRole('link', { name: site.hero.primaryCta.label })).toHaveAttribute(
      'href',
      '/#ibadah',
    )
    expect(hero.getByRole('link', { name: site.hero.secondaryCta.label })).toHaveAttribute(
      'href',
      '/doa',
    )
  })

  it('"Datang Beribadah" scrolls to the Ibadah section, every time it is clicked', async () => {
    renderApp('/')
    const hero = within(screen.getByRole('region', { name: site.hero.title }))
    const button = hero.getByRole('link', { name: site.hero.primaryCta.label })
    await userEvent.click(button)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('ibadah'))
    await userEvent.click(button)
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('"Kirim Pokok Doa" opens the prayer page', async () => {
    renderApp('/')
    const hero = within(screen.getByRole('region', { name: site.hero.title }))
    await userEvent.click(hero.getByRole('link', { name: site.hero.secondaryCta.label }))
    expect(
      await screen.findByRole('heading', { level: 1, name: site.pages.prayer.title }),
    ).toBeInTheDocument()
  })
})

describe('WorshipSection', () => {
  it('renders the schedule and the expectations from content', () => {
    renderApp('/')
    const copy = site.sections.worship
    const section = within(screen.getByRole('region', { name: copy.title }))
    expect(section.getByRole('heading', { level: 3, name: copy.schedule.title })).toBeVisible()
    expect(section.getByRole('heading', { level: 3, name: copy.expect.title })).toBeVisible()
    expect(section.getAllByText(copy.schedule.items[0]!.name)).toHaveLength(
      copy.schedule.items.length,
    )
    expect(section.getAllByText(copy.schedule.items[0]!.day)).toHaveLength(
      copy.schedule.items.length,
    )
    expect(section.getAllByText(copy.schedule.items[0]!.time)).toHaveLength(
      copy.schedule.items.length,
    )
    for (const item of copy.expect.items) {
      expect(section.getByText(item.title)).toBeInTheDocument()
    }
    expect(section.getAllByRole('listitem')).toHaveLength(
      copy.schedule.items.length + copy.expect.items.length,
    )
  })
})

describe('LocationSection', () => {
  it('renders address, transport and parking from content', () => {
    renderApp('/')
    const copy = site.sections.location
    const section = within(screen.getByRole('region', { name: copy.title }))
    expect(section.getByText(copy.address.value)).toBeInTheDocument()
    for (const item of copy.transport.items) expect(section.getByText(item.text)).toBeInTheDocument()
    expect(section.getByText(copy.parking.text)).toBeInTheDocument()
  })

  it('embeds the map in a titled, lazy, locked-down iframe', () => {
    renderApp('/')
    const map = site.sections.location.map
    const frame = screen.getByTitle(map.title)
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', mapEmbedUrl(map.baseUrl, map.query))
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(frame).not.toHaveAttribute('allowfullscreen')
    expect(frame).not.toHaveAttribute('allow')
    expect(frame).not.toHaveAttribute('sandbox')
  })

  it('always shows a link that opens the map in a new tab', () => {
    renderApp('/')
    const map = site.sections.location.map
    const link = screen.getByRole('link', { name: new RegExp(map.openLabel) })
    expect(link).toHaveAttribute('href', mapOpenUrl(map.baseUrl, map.query))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })
})

describe('home section order', () => {
  it('follows Ibadah, Lokasi, Acara, Tentang', () => {
    const { container } = renderApp('/')
    const ids = [...container.querySelectorAll('main section')].map((s) => s.id)
    expect(ids.slice(0, 5)).toEqual([
      site.hero.id,
      site.sections.worship.id,
      site.sections.location.id,
      site.sections.events.id,
      site.sections.about.id,
    ])
  })

  it('has exactly the plan sections, in order, after the hero', () => {
    const { container } = renderApp('/')
    const ids = [...container.querySelectorAll('main section')].map((s) => s.id)
    expect(ids).toEqual([
      site.hero.id,
      site.sections.worship.id,
      site.sections.location.id,
      site.sections.events.id,
      site.sections.about.id,
      site.sections.faq.id,
      site.sections.contact.id,
      site.sections.giving.id,
    ])
  })
})

describe('AboutSection', () => {
  it('renders the vision, the story and the bidang overview from content', () => {
    renderApp('/')
    const copy = site.sections.about
    const section = within(screen.getByRole('region', { name: copy.title }))
    expect(section.getByRole('heading', { level: 3, name: copy.vision.title })).toBeVisible()
    expect(section.getByText(copy.vision.text)).toBeVisible()
    expect(section.getByRole('heading', { level: 3, name: copy.story.title })).toBeVisible()
    expect(section.getByText(copy.story.paragraphs[0]!)).toBeVisible()
    expect(section.getByRole('heading', { level: 3, name: copy.bidang.title })).toBeVisible()
    expect(section.getAllByText(copy.bidang.items[0]!.name)).toHaveLength(copy.bidang.items.length)
  })
})

describe('FaqSection', () => {
  it('lists the questions closed, and opens an answer with the keyboard', async () => {
    renderApp('/')
    const copy = site.sections.faq
    const section = within(screen.getByRole('region', { name: copy.title }))
    for (const item of copy.items) {
      expect(section.getByRole('button', { name: item.question })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    }
    expect(section.queryByText(copy.items[0]!.answer)).not.toBeInTheDocument()
    const first = section.getByRole('button', { name: copy.items[0]!.question })
    first.focus()
    await userEvent.keyboard('{Enter}')
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(section.getByText(copy.items[0]!.answer)).toBeVisible()
  })
})

describe('ContactSection', () => {
  it('shows WhatsApp, Instagram and email placeholders as text, not links', () => {
    renderApp('/')
    const copy = site.sections.contact
    const section = within(screen.getByRole('region', { name: copy.title }))
    expect(section.getByText(copy.whatsappLabel)).toBeVisible()
    expect(section.getByText(site.contact.whatsapp)).toBeVisible()
    expect(section.getByText(site.contact.email)).toBeVisible()
    const instagram = site.socials.items.find((i) => i.id === 'instagram')!
    expect(section.getByText(instagram.label)).toBeVisible()
    expect(section.getByText(instagram.handle)).toBeVisible()
    expect(section.queryAllByRole('link')).toHaveLength(0)
  })
})

describe('GivingSection', () => {
  it('shows the bank and QRIS placeholder blocks', () => {
    renderApp('/')
    const copy = site.sections.giving
    const section = within(screen.getByRole('region', { name: copy.title }))
    expect(section.getByRole('heading', { level: 3, name: copy.bank.title })).toBeVisible()
    for (const row of [copy.bank.bankName, copy.bank.accountName, copy.bank.accountNumber]) {
      expect(section.getByText(row.label)).toBeVisible()
      expect(section.getByText(row.value)).toBeVisible()
    }
    expect(section.getByRole('heading', { level: 3, name: copy.qris.title })).toBeVisible()
    expect(section.getByText(copy.qris.placeholder)).toBeVisible()
  })
})
