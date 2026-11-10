import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { site } from '../src/content/site.ts'
import { mockEvents, mockEvent } from './events-mocks.ts'
import { createE2eEvent, deleteE2eEvent } from './fixtures.ts'
import { mockGoogleMaps } from './maps-mock.ts'

const HEADER_HEIGHT = 64 // 4rem sticky header

test.beforeEach(async ({ page }) => {
  await mockGoogleMaps(page)
})

for (const [label, size] of [
  ['360px', { width: 360, height: 740 }],
  ['1280px', { width: 1280, height: 800 }],
] as const) {
  test.describe(`new home sections at ${label}`, () => {
    test.use({ viewport: size })

    test('Acara shows an event created through the admin API', async ({ page }) => {
      const created = await createE2eEvent()
      try {
        await page.goto('/')
        const section = page.locator(`#${site.sections.events.id}`)
        const card = section.getByRole('listitem').filter({ hasText: created.title })
        await expect(card.getByRole('heading', { level: 3, name: created.title })).toBeVisible()
        await expect(card.getByText(created.location)).toBeVisible()
        await expect(card.getByText(created.description)).toBeVisible()
        // Date label always; the time is deterministic (Asia/Jakarta, 10:00 as created).
        await expect(card.getByText(new RegExp(site.sections.events.timezoneLabel))).toBeVisible()
        await expect(card.getByText(/10[.:]00/)).toBeVisible()
        await card.scrollIntoViewIfNeeded()
        await section.screenshot({ path: `.screens/f3-acara-${size.width}.png` })
      } finally {
        await deleteE2eEvent(created.id)
      }
    })

    test('Acara hides past events and keeps the rest in date order (mocked)', async ({ page }) => {
      await mockEvents(page, 200, [
        mockEvent('akhir', 20),
        mockEvent('lewat', -3),
        mockEvent('awal', 4),
      ])
      await page.goto('/')
      const section = page.locator(`#${site.sections.events.id}`)
      await expect(section.getByRole('heading', { level: 3, name: 'Acara awal' })).toBeVisible()
      await expect(section.getByRole('heading', { level: 3, name: 'Acara lewat' })).toHaveCount(0)
      const titles = await section.getByRole('heading', { level: 3 }).allTextContents()
      expect(titles).toEqual(['Acara awal', 'Acara akhir'])
    })

    test('Acara shows the empty state when the API has no events (mocked)', async ({ page }) => {
      await mockEvents(page, 200, [])
      await page.goto('/')
      const section = page.locator(`#${site.sections.events.id}`)
      await expect(section.getByText(site.sections.events.empty)).toBeVisible()
      await expect(section.getByRole('heading', { level: 3 })).toHaveCount(0)
    })

    test('Acara shows an error with a retry that recovers (mocked)', async ({ page }) => {
      const answer = await mockEvents(page, 500, { message: 'boom' })
      await page.goto('/')
      const section = page.locator(`#${site.sections.events.id}`)
      await expect(section.getByRole('alert')).toContainText(site.sections.events.error)
      await expect(section.getByText('boom')).toHaveCount(0)
      answer(200, [mockEvent('pulih', 6)])
      await section.getByRole('button', { name: site.states.retry }).click()
      await expect(section.getByRole('heading', { level: 3, name: 'Acara pulih' })).toBeVisible()
    })

    test('the FAQ works with the keyboard and the focused trigger clears the header', async ({
      page,
    }) => {
      await page.goto('/')
      const faq = page.locator(`#${site.sections.faq.id}`)
      const items = site.sections.faq.items
      const trigger = (i: number) => faq.getByRole('button', { name: items[i]!.question })
      await trigger(0).scrollIntoViewIfNeeded()
      await trigger(0).focus()
      await expect(trigger(0)).toBeFocused()
      await expect(trigger(0)).toHaveAttribute('aria-expanded', 'false')
      await page.keyboard.press('Enter')
      await expect(trigger(0)).toHaveAttribute('aria-expanded', 'true')
      await expect(faq.getByText(items[0]!.answer)).toBeVisible()
      await faq.screenshot({ path: `.screens/f3-faq-open-${size.width}.png` })
      await page.keyboard.press('Space')
      await expect(trigger(0)).toHaveAttribute('aria-expanded', 'false')
      await page.keyboard.press('ArrowDown')
      await expect(trigger(1)).toBeFocused()
      await page.keyboard.press('ArrowUp')
      await expect(trigger(0)).toBeFocused()
      await page.keyboard.press('End')
      await expect(trigger(items.length - 1)).toBeFocused()
      await page.keyboard.press('Home')
      await expect(trigger(0)).toBeFocused()
      // Tab moves on to the next trigger as well.
      await page.keyboard.press('Tab')
      await expect(trigger(1)).toBeFocused()
      // Not hidden under the sticky header (scroll back up so the focus scroll has to act).
      await page.evaluate(() => window.scrollBy(0, 400))
      await page.keyboard.press('ArrowUp')
      await expect(trigger(0)).toBeFocused()
      await expect
        .poll(async () => (await trigger(0).boundingBox())?.y ?? -1)
        .toBeGreaterThanOrEqual(HEADER_HEIGHT)
    })

    test('the FAQ has no serious axe violations with an item open', async ({ page }) => {
      await page.goto('/')
      const faq = page.locator(`#${site.sections.faq.id}`)
      await faq.getByRole('button', { name: site.sections.faq.items[0]!.question }).click()
      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(serious.map((v) => v.id)).toEqual([])
    })

    test('Tentang, Kontak and Persembahan render and look right', async ({ page }) => {
      await page.goto('/')
      for (const copy of [site.sections.about, site.sections.contact, site.sections.giving]) {
        await expect(page.getByRole('heading', { level: 2, name: copy.title })).toBeAttached()
      }
      await page.locator(`#${site.sections.about.id}`).screenshot({
        path: `.screens/f3-tentang-${size.width}.png`,
      })
      await page.locator(`#${site.sections.contact.id}`).screenshot({
        path: `.screens/f3-kontak-${size.width}.png`,
      })
      await page.locator(`#${site.sections.giving.id}`).screenshot({
        path: `.screens/f3-persembahan-${size.width}.png`,
      })
    })
  })
}

test.describe('header at 1024px', () => {
  test.use({ viewport: { width: 1024, height: 800 } })

  test('the nav and the volunteer button do not collide or overflow', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: site.a11y.mainNav })
    await expect(nav).toBeVisible()
    const links = await nav.getByRole('link').all()
    expect(links).toHaveLength(site.nav.items.length)
    const navBox = (await nav.boundingBox())!
    const button = page.getByRole('banner').getByRole('link', { name: site.nav.cta.label })
    const buttonBox = (await button.boundingBox())!
    const logoBox = (await page.getByRole('link', { name: site.brand.logoLabel }).boundingBox())!
    expect(logoBox.x + logoBox.width).toBeLessThanOrEqual(navBox.x)
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(buttonBox.x)
    // No link wraps onto a second line.
    for (const link of links) expect((await link.boundingBox())!.height).toBeLessThan(48)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
    await page.screenshot({ path: '.screens/f3-header-1024.png', clip: { x: 0, y: 0, width: 1024, height: 80 } })
  })
})
