import { expect, test, type Page } from '@playwright/test'
import { site } from '../src/content/site.ts'
import { mapEmbedUrl, mapOpenUrl } from '../src/lib/maps.ts'
import { mockGoogleMaps } from './maps-mock.ts'

const HEADER_HEIGHT = 64 // 4rem sticky header

test.beforeEach(async ({ page }) => {
  await mockGoogleMaps(page)
})

/** The section heading is on screen and not hidden under the sticky header (after smooth scroll). */
async function expectScrolledTo(page: Page, title: string) {
  const heading = page.getByRole('heading', { level: 2, name: title })
  await expect(heading).toBeInViewport()
  await expect
    .poll(async () => (await heading.boundingBox())?.y ?? -1, { timeout: 5000 })
    .toBeGreaterThanOrEqual(HEADER_HEIGHT)
  const viewport = page.viewportSize()
  await expect
    .poll(async () => (await heading.boundingBox())?.y ?? Infinity)
    .toBeLessThan((viewport?.height ?? 800) / 2)
}

const hero = (page: Page) => page.getByRole('region', { name: site.hero.title })

for (const [label, size] of [
  ['360px', { width: 360, height: 740 }],
  ['1280px', { width: 1280, height: 800 }],
] as const) {
  test.describe(`hero buttons at ${label}`, () => {
    test.use({ viewport: size })

    test('"Datang Beribadah" scrolls to the Ibadah section', async ({ page }) => {
      await page.goto('/')
      await hero(page).getByRole('link', { name: site.hero.primaryCta.label }).click()
      await expect(page).toHaveURL(/\/#ibadah$/)
      await expectScrolledTo(page, site.sections.worship.title)
      await page.locator('#ibadah').screenshot({ path: `.screens/f2-ibadah-${size.width}.png` })
    })

    test('"Kirim Pokok Doa" goes to /doa', async ({ page }) => {
      await page.goto('/')
      await hero(page).getByRole('link', { name: site.hero.secondaryCta.label }).click()
      await expect(page).toHaveURL(/\/doa$/)
      await expect(
        page.getByRole('heading', { level: 1, name: site.pages.prayer.title }),
      ).toBeVisible()
    })

    test('the map iframe is titled and points at the embed url', async ({ page }) => {
      await page.goto('/')
      const map = site.sections.location.map
      const frame = page.getByTitle(map.title)
      await frame.scrollIntoViewIfNeeded()
      await expect(frame).toHaveAttribute('src', mapEmbedUrl(map.baseUrl, map.query))
      await expect(frame).toHaveAttribute('loading', 'lazy')
      await expect(frame).not.toHaveAttribute('sandbox')
      const link = page.getByRole('link', { name: new RegExp(map.openLabel) })
      await expect(link).toHaveAttribute('href', mapOpenUrl(map.baseUrl, map.query))
      await page.locator('#lokasi').screenshot({ path: `.screens/f2-lokasi-${size.width}.png` })
    })

    test('the hero looks right', async ({ page }) => {
      await page.goto('/')
      await expect(hero(page)).toBeVisible()
      await page.screenshot({ path: `.screens/f2-hero-${size.width}.png` })
    })
  })
}

test.describe('header links at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const [label, title] of [
    ['Ibadah', site.sections.worship.title],
    ['Lokasi', site.sections.location.title],
    ['Kegiatan', site.sections.events.title],
  ] as const) {
    test(`the "${label}" link scrolls to its section`, async ({ page }) => {
      await page.goto('/')
      await page
        .getByRole('navigation', { name: site.a11y.mainNav })
        .getByRole('link', { name: label })
        .click()
      await expectScrolledTo(page, title)
    })
  }
})

test.describe('header links at 360px (burger)', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const [label, title] of [
    ['Ibadah', site.sections.worship.title],
    ['Lokasi', site.sections.location.title],
  ] as const) {
    test(`the burger "${label}" link scrolls to its section`, async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: site.a11y.openMenu }).click()
      await page
        .getByRole('dialog', { name: site.a11y.menuTitle })
        .getByRole('link', { name: label })
        .click()
      await expectScrolledTo(page, title)
    })
  }
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 360, height: 740 }, reducedMotion: 'reduce' })

  test('"Datang Beribadah" jumps instead of animating', async ({ page }) => {
    await page.goto('/')
    await hero(page).getByRole('link', { name: site.hero.primaryCta.label }).click()
    const heading = page.getByRole('heading', { level: 2, name: site.sections.worship.title })
    await expect(heading).toBeInViewport()
    const y1 = (await heading.boundingBox())?.y ?? -1
    expect(y1).toBeGreaterThanOrEqual(HEADER_HEIGHT)
    const scrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    )
    expect(scrollBehavior).toBe('auto')
  })
})
