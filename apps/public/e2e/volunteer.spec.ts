import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { site } from '../src/content/site.ts'
import { e2eName } from './fixtures.ts'
import { bidangFixture, expect, mockBidang, test } from './volunteer-mocks.ts'

// F5 /relawan. Rate-limit budget: exactly ONE test below ("[real]") posts to the real backend, so a
// full run sends 1 real POST. Every other test either sends nothing (client-side validation) or
// answers the request itself with `volunteer.mock(...)`. See volunteer-mocks.ts: an unexpected POST
// fails the test. Bidang are stubbed with `mockBidang` everywhere except the [real] test.
const form = site.pages.volunteer.form
const success = site.pages.volunteer.success

async function seriousAxe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id)
}

async function fillValid(page: Page, fullName = e2eName()) {
  await page.getByLabel(/^Nama lengkap/).fill(fullName)
  await page.getByLabel(/^Nomor WhatsApp/).fill('08123456789')
  await page.getByRole('checkbox', { name: new RegExp(form.consentLabel) }).click()
  return fullName
}

const submit = (page: Page) => page.getByRole('button', { name: form.submit, exact: true })
const banner = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text })
const group = (page: Page) => page.getByRole('group', { name: new RegExp(form.bidang.legend) })
const gotoPage = async (page: Page) => {
  await page.goto('/relawan')
  await expect(page.getByRole('heading', { level: 1, name: site.pages.volunteer.title })).toBeVisible()
}

test('[real] bidang load from the API and a valid submit shows the success screen (the only real POST of the run)', async ({
  page,
  volunteer,
}) => {
  await volunteer.real()
  const bidangResponse = page.waitForResponse(
    (r) => r.url().includes('/api/public/bidang') && r.request().method() === 'GET',
  )
  await gotoPage(page)
  const bidangRes = await bidangResponse
  expect(bidangRes.status()).toBe(200)
  const list = (await bidangRes.json()) as { id: string; name: string }[]

  if (list.length > 0) {
    await expect(group(page)).toBeVisible()
    await expect(group(page).getByRole('checkbox')).toHaveCount(list.length)
    await group(page).getByRole('checkbox', { name: list[0]!.name, exact: true }).first().click()
  } else {
    await expect(page.getByText(form.bidang.empty)).toBeVisible()
  }

  const response = page.waitForResponse(
    (r) => r.url().includes('/api/public/volunteer-applications') && r.request().method() === 'POST',
  )
  await fillValid(page) // fullName = e2e-<random>, removed by the next run's global setup
  await submit(page).click()
  expect((await response).status()).toBe(201)

  const heading = page.getByRole('heading', { name: success.title })
  await expect(heading).toBeVisible()
  await expect(heading).toBeFocused()
  await expect(submit(page)).toHaveCount(0)
  await page.screenshot({ path: '.screens/f5-success-1280.png', fullPage: true })
  expect(await seriousAxe(page)).toEqual([])
  expect(volunteer.sent).toHaveLength(1)
  expect(String(volunteer.sent[0]!.fullName)).toMatch(/^e2e-/)
  if (list.length > 0) expect(volunteer.sent[0]!.bidangIds).toHaveLength(1)
})

test.describe('bidang states (mocked, nothing is posted)', () => {
  test('options come from the API list and the chosen ids are sent', async ({ page, volunteer }) => {
    await mockBidang(page, 'ok')
    await volunteer.mock({ status: 201 })
    await gotoPage(page)
    await expect(group(page).getByRole('checkbox')).toHaveCount(bidangFixture.length)
    await page.screenshot({ path: '.screens/f5-form-1280.png', fullPage: true })
    await page.getByRole('checkbox', { name: bidangFixture[1]!.name }).click()
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
    expect(volunteer.sent[0]).toMatchObject({ fullName: 'e2e-mock', bidangIds: [bidangFixture[1]!.id] })
  })

  test('loading state shows while the list is pending, and the form is usable', async ({
    page,
  }) => {
    let release: () => void = () => {}
    await mockBidang(page, {
      hold: new Promise<void>((resolve) => {
        release = resolve
      }),
    })
    await gotoPage(page)
    await expect(page.getByRole('status', { name: form.bidang.loading })).toBeVisible()
    await expect(submit(page)).toBeEnabled()
    release()
    await expect(group(page)).toBeVisible()
  })

  test('empty list shows a note and no group', async ({ page }) => {
    await mockBidang(page, 'empty')
    await gotoPage(page)
    await expect(page.getByText(form.bidang.empty)).toBeVisible()
    await expect(group(page)).toHaveCount(0)
  })

  for (const mode of ['fail', 'abort'] as const) {
    test(`when the bidang call fails (${mode}) the form still submits, without bidangIds`, async ({
      page,
      volunteer,
    }) => {
      await mockBidang(page, mode)
      await volunteer.mock({ status: 201 })
      await gotoPage(page)
      await expect(page.getByText(form.bidang.failed)).toBeVisible()
      await expect(group(page)).toHaveCount(0)
      await fillValid(page, 'e2e-mock')
      await submit(page).click()
      await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
      expect(volunteer.sent).toHaveLength(1)
      expect(volunteer.sent[0]).not.toHaveProperty('bidangIds')
    })
  }
})

test.describe('validation blocks the send (nothing is posted)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBidang(page, 'ok')
    await gotoPage(page)
  })

  test('an invalid email is blocked client-side', async ({ page, volunteer }) => {
    await fillValid(page)
    await page.getByLabel(/^Email/).fill('bukan-email')
    await submit(page).click()
    await expect(page.getByText(form.errors.emailInvalid)).toBeVisible()
    await expect(page.getByLabel(/^Email/)).toHaveAttribute('aria-invalid', 'true')
    expect(volunteer.sent).toHaveLength(0)
  })

  test('empty name, WhatsApp and consent are blocked, with the field errors showing', async ({
    page,
    volunteer,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await submit(page).click()
    await expect(page.getByText(form.errors.fullNameRequired)).toBeVisible()
    await expect(page.getByText(form.errors.whatsappRequired)).toBeVisible()
    await expect(page.getByText(form.errors.consentRequired)).toBeVisible()
    await page.screenshot({ path: '.screens/f5-errors-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false)
    expect(volunteer.sent).toHaveLength(0)
  })

  test('a message over 1000 characters is blocked', async ({ page, volunteer }) => {
    await fillValid(page)
    await page.getByRole('textbox', { name: /^Pesan/ }).fill('a'.repeat(1001))
    await submit(page).click()
    await expect(page.locator('#message-error')).toHaveText(form.errors.messageTooLong(1000))
    expect(volunteer.sent).toHaveLength(0)
  })
})

test.describe('mocked responses (no backend call)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBidang(page, 'ok')
    await gotoPage(page)
  })

  test('429 shows the rate-limit message and keeps the data', async ({ page, volunteer }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await volunteer.mock({ status: 429, retryAfter: 120 })
    await page.getByRole('checkbox', { name: bidangFixture[0]!.name }).click()
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(banner(page, site.errors.rateLimited)).toBeVisible()
    await expect(page.getByLabel(/^Nama lengkap/)).toHaveValue('e2e-mock')
    await expect(page.getByRole('checkbox', { name: bidangFixture[0]!.name })).toBeChecked()
    await expect(submit(page)).toBeEnabled()
    await page.screenshot({ path: '.screens/f5-banner429-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    expect(volunteer.sent).toHaveLength(1)
  })

  test('400 shows the validation message, never the server text', async ({ page, volunteer }) => {
    await volunteer.mock({ status: 400 })
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(banner(page, site.errors.validation)).toBeVisible()
    await expect(page.getByText('consent must be true')).toHaveCount(0)
    await expect(page.getByLabel(/^Nama lengkap/)).toHaveValue('e2e-mock')
  })

  test('a server error and a network error show their messages, and a retry succeeds', async ({
    page,
    volunteer,
  }) => {
    await fillValid(page, 'e2e-mock')
    await volunteer.mock({ status: 500 })
    await submit(page).click()
    await expect(banner(page, site.errors.server)).toBeVisible()

    await volunteer.mock({ abort: true })
    await submit(page).click()
    await expect(banner(page, site.errors.network)).toBeVisible()
    await expect(page.getByLabel(/^Nama lengkap/)).toHaveValue('e2e-mock')

    await volunteer.mock({ status: 201 })
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
    expect(volunteer.sent).toHaveLength(3)
  })

  test('the submit button is disabled while sending, and a second click sends nothing more', async ({
    page,
    volunteer,
  }) => {
    let release: () => void = () => {}
    await volunteer.mockHeld(
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
    expect(volunteer.sent).toHaveLength(1)
  })

  test('a filled honeypot is sent as `website`', async ({ page, volunteer }) => {
    await volunteer.mock({ status: 201 })
    await fillValid(page, 'e2e-mock')
    await page.locator('#website').fill('spam-bot', { force: true })
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeVisible()
    expect(volunteer.sent[0]).toMatchObject({ website: 'spam-bot' })
  })

  test('"again" returns an empty form; the success screen at 360px has no axe violations', async ({
    page,
    volunteer,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await volunteer.mock({ status: 201 })
    await fillValid(page, 'e2e-mock')
    await submit(page).click()
    await expect(page.getByRole('heading', { name: success.title })).toBeFocused()
    await page.screenshot({ path: '.screens/f5-success-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    await page.getByRole('button', { name: success.again }).click()
    await expect(page.getByLabel(/^Nama lengkap/)).toHaveValue('')
    await expect(page.getByLabel(/^Nama lengkap/)).toBeFocused()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(form.consentLabel) }),
    ).not.toBeChecked()
  })

  test('the honeypot is hidden and Tab never reaches it', async ({ page, volunteer }) => {
    const trap = page.locator('#website')
    await expect(trap).toHaveAttribute('tabindex', '-1')
    await expect(trap).toHaveAttribute('autocomplete', 'off')
    await expect(page.locator('div[aria-hidden="true"]:has(#website)')).toHaveCount(1)
    await page.getByLabel(/^Nama lengkap/).focus()
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('website')
    }
    expect(volunteer.sent).toHaveLength(0)
  })
})

for (const width of [360, 1280]) {
  test(`touch targets and layout at ${width}px, axe on the idle form`, async ({
    page,
    volunteer,
  }) => {
    await mockBidang(page, 'ok')
    await page.setViewportSize({ width, height: 800 })
    await gotoPage(page)
    await expect(group(page)).toBeVisible()
    if (width < 1024) {
      const targets = [
        submit(page),
        page.getByLabel(/^Nama lengkap/),
        page.getByLabel(/^Nomor WhatsApp/),
        page.getByLabel(/^Email/),
        page.getByRole('textbox', { name: /^Pesan/ }),
        page.locator('label[for="consent"]'),
        ...bidangFixture.map((b) => page.locator('label', { hasText: b.name })),
      ]
      for (const target of targets) {
        expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      }
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false)
    if (width === 360) await page.screenshot({ path: '.screens/f5-form-360.png', fullPage: true })
    expect(await seriousAxe(page)).toEqual([])
    expect(volunteer.sent).toHaveLength(0)
  })
}
