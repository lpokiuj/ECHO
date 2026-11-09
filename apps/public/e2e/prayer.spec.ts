import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { site } from '../src/content/site.ts'
import { e2eName } from './fixtures.ts'
import { expect, test } from './prayer-mocks.ts'

// F4 /doa. Rate-limit budget: exactly ONE test below ("[real]") posts to the real backend, so a full
// run sends 1 real POST. Every other test either sends nothing (client-side validation) or answers
// the request itself with `prayer.mock(...)`. See prayer-mocks.ts: an unexpected POST fails the test.
const form = site.pages.prayer.form
const success = site.pages.prayer.success

async function seriousAxe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id)
}

async function fillValid(page: Page, name = e2eName()) {
  await page.getByLabel(/^Nama/).fill(name)
  await page.getByRole('textbox', { name: /^Pokok doa/ }).fill('Mohon doakan keluarga saya')
  await page.getByRole('checkbox', { name: new RegExp(form.consentLabel) }).click()
  return name
}

const submit = (page: Page) => page.getByRole('button', { name: form.submit, exact: true })
const banner = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text })

test.beforeEach(async ({ page }) => {
  await page.goto('/doa')
  await expect(page.getByRole('heading', { level: 1, name: site.pages.prayer.title })).toBeVisible()
})

test('[real] a valid submit shows the success screen (the only real POST of the run)', async ({
  page,
  prayer,
}) => {
  await prayer.real()
  const response = page.waitForResponse(
    (r) => r.url().includes('/api/public/prayer-requests') && r.request().method() === 'POST',
  )
  await fillValid(page) // name = e2e-<random>, removed by the next run's global setup
  await submit(page).click()
  expect((await response).status()).toBe(201)

  const heading = page.getByRole('heading', { name: success.title })
  await expect(heading).toBeVisible()
  await expect(heading).toBeFocused()
  await expect(submit(page)).toHaveCount(0)
  await page.screenshot({ path: '.screens/f4-success-1280.png', fullPage: true })
  expect(await seriousAxe(page)).toEqual([])
  expect(prayer.sent).toHaveLength(1)
  expect(String(prayer.sent[0]!.name)).toMatch(/^e2e-/)
})

test.describe('validation blocks the send (nothing is posted)', () => {
  test('follow-up without contact is blocked client-side', async ({ page, prayer }) => {
    await fillValid(page)
    await page.getByRole('checkbox', { name: form.followUpLabel }).click()
    await expect(page.getByLabel(/^Kontak/)).toHaveAttribute('aria-required', 'true')
    await submit(page).click()
    await expect(page.getByText(form.errors.contactRequired)).toBeVisible()
    await expect(page.getByLabel(/^Kontak/)).toHaveAttribute('aria-invalid', 'true')
    expect(prayer.sent).toHaveLength(0)
  })

  test('unchecking follow-up removes the contact requirement', async ({ page, prayer }) => {
    await page.getByRole('checkbox', { name: form.followUpLabel }).click()
    await expect(page.getByLabel(/^Kontak/)).toHaveAttribute('aria-required', 'true')
    await page.getByRole('checkbox', { name: form.followUpLabel }).click()
    await expect(page.getByLabel(/^Kontak/)).not.toHaveAttribute('aria-required', 'true')
    expect(prayer.sent).toHaveLength(0)
  })

  test('empty content and missing consent are blocked, with the field errors showing', async ({
    page,
    prayer,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await submit(page).click()
    await expect(page.getByText(form.errors.contentRequired)).toBeVisible()
    await expect(page.getByText(form.errors.consentRequired)).toBeVisible()
    await page.screenshot({ path: '.screens/f4-errors-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false)
    expect(prayer.sent).toHaveLength(0)
  })

  test('content over 2000 characters is blocked and the counter shows it', async ({
    page,
    prayer,
  }) => {
    await fillValid(page)
    await page.getByRole('textbox', { name: /^Pokok doa/ }).fill('a'.repeat(2001))
    await expect(page.locator('#content-counter')).toContainText('2001')
    await submit(page).click()
    // The sr-only live region repeats the text for screen readers, so target the field error.
    await expect(page.locator('#content-error')).toHaveText(form.errors.contentTooLong(2000))
    expect(prayer.sent).toHaveLength(0)
  })
})

test.describe('mocked responses (no backend call)', () => {
  test('429 shows the rate-limit message and keeps the data', async ({ page, prayer }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await prayer.mock({ status: 429, retryAfter: 120 })
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(banner(page, site.errors.rateLimited)).toBeVisible()
    await expect(page.getByLabel(/^Nama/)).toHaveValue('e2e-mock')
    await expect(page.getByRole('textbox', { name: /^Pokok doa/ })).toHaveValue(
      'Mohon doakan keluarga saya',
    )
    await expect(submit(page)).toBeEnabled()
    await page.screenshot({ path: '.screens/f4-banner429-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    expect(prayer.sent).toHaveLength(1)
  })

  test('400 shows the validation message, never the server text', async ({ page, prayer }) => {
    await prayer.mock({ status: 400 })
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(banner(page, site.errors.validation)).toBeVisible()
    await expect(page.getByText('consent must be true')).toHaveCount(0)
    await expect(page.getByLabel(/^Nama/)).toHaveValue('e2e-mock')
  })

  test('a server error and a network error show their messages, and a retry succeeds', async ({
    page,
    prayer,
  }) => {
    await fillValid(page, 'e2e-mock')
    await prayer.mock({ status: 500 })
    await submit(page).click()
    await expect(banner(page, site.errors.server)).toBeVisible()

    await prayer.mock({ abort: true })
    await submit(page).click()
    await expect(banner(page, site.errors.network)).toBeVisible()
    await expect(page.getByLabel(/^Nama/)).toHaveValue('e2e-mock')

    await prayer.mock({ status: 201 })
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
    await expect(banner(page, site.errors.network)).toHaveCount(0)
    expect(prayer.sent).toHaveLength(3)
  })

  test('the submit button is disabled while sending, and a second click sends nothing more', async ({
    page,
    prayer,
  }) => {
    let release: () => void = () => {}
    await prayer.mockHeld(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    const busy = page.getByRole('button', { name: form.submitting })
    await expect(busy).toBeDisabled()
    await expect(busy).toHaveAttribute('aria-busy', 'true')
    await busy.click({ force: true }) // a disabled button ignores it
    release()
    await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
    expect(prayer.sent).toHaveLength(1)
  })

  test('a filled honeypot is sent as `website`', async ({ page, prayer }) => {
    await prayer.mock({ status: 201 })
    await fillValid(page, 'e2e-mock')
    await page.locator('#website').fill('spam-bot', { force: true })
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
    expect(prayer.sent[0]).toMatchObject({ website: 'spam-bot' })
  })

  test('"send another" returns an empty form; the success screen at 360px has no axe violations', async ({
    page,
    prayer,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await prayer.mock({ status: 201 })
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeFocused()
    await page.screenshot({ path: '.screens/f4-success-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    await page.getByRole('button', { name: success.again }).click()
    await expect(page.getByLabel(/^Nama/)).toHaveValue('')
    await expect(page.getByLabel(/^Nama/)).toBeFocused()
    await expect(page.getByRole('checkbox', { name: new RegExp(form.consentLabel) })).not.toBeChecked()
  })
})

test('the honeypot is hidden and Tab never reaches it', async ({ page, prayer }) => {
  const trap = page.locator('#website')
  await expect(trap).toHaveAttribute('tabindex', '-1')
  await expect(trap).toHaveAttribute('autocomplete', 'off')
  await expect(page.locator('div[aria-hidden="true"]:has(#website)')).toHaveCount(1)

  await page.getByLabel(/^Nama/).focus()
  const visited: string[] = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    visited.push(await page.evaluate(() => document.activeElement?.id ?? ''))
  }
  expect(visited).not.toContain('website')
  await page.getByLabel(/^Nama/).focus()
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('website')
  }
  expect(prayer.sent).toHaveLength(0)
})

for (const width of [360, 1280]) {
  test(`touch targets and layout at ${width}px, axe on the idle form`, async ({ page, prayer }) => {
    await page.setViewportSize({ width, height: 800 })
    if (width < 1024) {
      const targets = [
        submit(page),
        page.getByLabel(/^Nama/),
        page.getByLabel(/^Kontak/),
        page.getByRole('textbox', { name: /^Pokok doa/ }),
        page.locator('label[for="wantsFollowUp"]'),
        page.locator('label[for="consent"]'),
      ]
      for (const target of targets) {
        expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      }
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false)
    expect(await seriousAxe(page)).toEqual([])
    expect(prayer.sent).toHaveLength(0)
  })
}
