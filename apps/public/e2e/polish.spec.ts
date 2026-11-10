import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { site } from '../src/content/site.ts'
import { mockGoogleMaps } from './maps-mock.ts'
import { guardPrayerPosts, type PrayerGuard } from './prayer-mocks.ts'
import { guardVolunteerPosts } from './volunteer-mocks.ts'

// F6 polish checks. No test here submits anything for real: every spec installs both POST guards
// and asserts nothing reached them (client-side validation only, no mocked or real POSTs).
let prayerGuard: PrayerGuard
let volunteerGuard: Awaited<ReturnType<typeof guardVolunteerPosts>>

test.beforeEach(async ({ page }) => {
  await mockGoogleMaps(page)
  prayerGuard = await guardPrayerPosts(page)
  volunteerGuard = await guardVolunteerPosts(page)
})

test.afterEach(() => {
  expect(prayerGuard.sent).toEqual([])
  expect(volunteerGuard.sent).toEqual([])
})

async function seriousAxe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id)
}

test.describe('skip link', () => {
  for (const [path, width] of [
    ['/', 360],
    ['/', 1280],
    ['/tidak-ada', 360],
  ] as const) {
    test(`first Tab shows it and Enter moves into main (${path} at ${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(path)
      await page.keyboard.press('Tab')
      const link = page.getByRole('link', { name: site.a11y.skipToContent })
      await expect(link).toBeFocused()
      const box = await link.boundingBox()
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(0)
      expect((box?.width ?? 0) > 0).toBe(true)
      await page.keyboard.press('Enter')
      await page.keyboard.press('Tab')
      const inMain = await page.evaluate(() => !!document.activeElement?.closest('main'))
      expect(inMain).toBe(true)
    })
  }
})

test.describe('404', () => {
  for (const path of ['/tidak-ada', '/a/b/c']) {
    test(`${path} shows the 404 page in the layout with its title`, async ({ page }) => {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { level: 1, name: site.pages.notFound.title }),
      ).toBeVisible()
      await expect(page).toHaveTitle(`${site.titles.notFound} | ${site.brand.name}`)
      await expect(page.getByRole('link', { name: site.footer.portalLinkLabel })).toBeVisible()
      await page.getByRole('link', { name: site.pages.notFound.back }).click()
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { level: 1, name: site.hero.title })).toBeVisible()
    })
  }
})

test('index.html has the title, description and Open Graph tags, and the og image loads', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveTitle(site.brand.name)
  const content = (sel: string) => page.locator(sel).getAttribute('content')
  expect(await content('meta[name="description"]')).toBe(site.meta.description)
  expect(await content('meta[property="og:title"]')).toBe(site.brand.name)
  expect(await content('meta[property="og:description"]')).toBe(site.meta.description)
  expect(await content('meta[property="og:locale"]')).toBe(site.meta.locale)
  const image = await content('meta[property="og:image"]')
  expect(image).toBe(site.meta.ogImage)
  const response = await page.request.get(image!)
  expect(response.status()).toBe(200)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 360, height: 740 } })

  test('the global rule turns smooth scroll off and shortens transitions', async ({ page }) => {
    await page.goto('/')
    const html = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    )
    expect(html).toBe('auto')
    await page.getByRole('button', { name: site.a11y.openMenu }).click()
    const dialog = page.getByRole('dialog', { name: site.a11y.menuTitle })
    await expect(dialog).toBeVisible()
    const durations = await dialog.evaluate((el) => {
      const s = getComputedStyle(el)
      return [s.animationDuration, s.transitionDuration]
    })
    for (const d of durations) {
      for (const part of d.split(',')) expect(parseFloat(part)).toBeLessThan(0.01 + 1e-9)
    }
  })
})

test('without reduced motion the page scrolls smoothly (the rule is what turns it off)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const value = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
  expect(value).toBe('smooth')
})

test.describe('focus is visible', () => {
  test('keyboard focus shows an outline or ring on the first 15 stops of home at 1280px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      // Poll: ring styles can be mid-transition for a few milliseconds after focus.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const el = document.activeElement
            // The map iframe draws its own focus inside the embedded document.
            if (!el || el === document.body || el.tagName === 'IFRAME') return 'ok'
            const s = getComputedStyle(el)
            const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
            return outline || s.boxShadow !== 'none'
              ? 'ok'
              : `no focus style on <${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 30)}"`
          }),
        )
        .toBe('ok')
    }
  })

  test('the burger and the sheet close button show focus at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
    await page.getByRole('button', { name: site.a11y.openMenu }).focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: site.a11y.menuTitle })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: site.a11y.close }).focus()
    const ok = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!)
      return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
    })
    expect(ok).toBe(true)
  })
})

test.describe('axe in other states', () => {
  for (const width of [360, 768]) {
    test(`home with the menu open at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await page.getByRole('button', { name: site.a11y.openMenu }).click()
      await expect(page.getByRole('dialog', { name: site.a11y.menuTitle })).toBeVisible()
      expect(await seriousAxe(page)).toEqual([])
    })
  }

  for (const [path, submit] of [
    ['/doa', site.pages.prayer.form.submit],
    ['/relawan', site.pages.volunteer.form.submit],
  ] as const) {
    test(`${path} with client-side validation errors showing at 360px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await page.goto(path)
      await page.getByRole('button', { name: submit, exact: true }).click()
      await expect(page.getByRole('alert').first()).toBeVisible()
      expect(await seriousAxe(page)).toEqual([])
    })
  }
})
