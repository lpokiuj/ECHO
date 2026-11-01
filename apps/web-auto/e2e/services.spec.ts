import AxeBuilder from '@axe-core/playwright'
import { expect, test as plain, type Page } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import {
  adminToken,
  createE2eService,
  createE2eUser,
  listServices,
  test,
  loginAndChange,
  randomSuffix,
  seedSession,
  wibInstant,
} from './fixtures.ts'

const t = messages.services
const f = t.form
const widths = [360, 390, 768, 1280]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

/** The visible list item for a title: a table row on desktop, a card below 768px. */
function itemFor(page: Page, width: number, title: string) {
  return width >= 768
    ? page.getByTestId('services-table').getByRole('row').filter({ hasText: title })
    : page.getByTestId('services-cards').getByRole('listitem').filter({ hasText: title })
}

/** Date part (YYYY-MM-DD, Jakarta) of a day `days` ahead, for the date inputs. */
const futureDate = (days: number) => wibInstant(days, 9).slice(0, 10)

async function fillForm(
  page: Page,
  v: { title: string; date: string; start: string; end: string },
) {
  await page.getByLabel(f.titleLabel).fill(v.title)
  await page.getByLabel(f.startDate).fill(v.date)
  await page.getByLabel(f.startTime).fill(v.start)
  await page.getByLabel(f.endDate).fill(v.date)
  await page.getByLabel(f.endTime).fill(v.end)
}

test('admin creates a service in WIB, sees the right time, edits it, deletes it', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page)
  const title = `e2e-${randomSuffix()}`
  const date = futureDate(40)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/services')
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()

  await page.getByRole('button', { name: t.add }).click()
  await fillForm(page, { title, date, start: '09:00', end: '11:00' })
  await page.getByRole('button', { name: f.submitCreate }).click()
  const row = itemFor(page, 1280, title)
  await expect(row).toBeVisible()
  await expect(row).toContainText(`09.00 - 11.00 ${messages.dates.wib}`)
  // Stored as the same instant in UTC.
  const created = (await listServices(request)).find((s) => s.title === title)
  expect(created?.startsAt).toBe(`${date}T02:00:00.000Z`)
  expect(created?.endsAt).toBe(`${date}T04:00:00.000Z`)

  const renamed = `${title}-ubah`
  await row.getByRole('button', { name: `${t.editAria}: ${title}` }).click()
  await expect(page.getByLabel(f.startTime)).toHaveValue('09:00')
  await page.getByLabel(f.titleLabel).fill(renamed)
  await page.getByLabel(f.endTime).fill('12:00')
  await page.getByRole('button', { name: f.submitEdit }).click()
  const edited = itemFor(page, 1280, renamed)
  await expect(edited).toContainText(`09.00 - 12.00 ${messages.dates.wib}`)

  await edited.getByRole('button', { name: `${t.deleteAria}: ${renamed}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: t.confirmDelete.action }).click()
  await expect(itemFor(page, 1280, renamed)).toHaveCount(0)
  expect((await listServices(request)).some((s) => s.title === renamed)).toBe(false)
  expect(errors).toEqual([])
})

test('a start that is not in the future is blocked by the form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/services')
  await page.getByRole('button', { name: t.add }).click()
  await fillForm(page, {
    title: `e2e-${randomSuffix()}`,
    date: futureDate(-2),
    start: '09:00',
    end: '11:00',
  })
  await page.getByRole('button', { name: f.submitCreate }).click()
  await expect(page.getByText(t.validation.startFuture)).toBeVisible()
})

test('a server validation error and a 403 show Indonesian messages next to the form', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/services')
  let status = 400
  await page.route('**/api/services', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const body =
      status === 400
        ? { message: 'endsAt must be after startsAt', error: 'Bad Request', statusCode: 400 }
        : { message: 'Forbidden', statusCode: 403 }
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.getByRole('button', { name: t.add }).click()
  await fillForm(page, {
    title: `e2e-${randomSuffix()}`,
    date: futureDate(41),
    start: '09:00',
    end: '11:00',
  })
  await page.getByRole('button', { name: f.submitCreate }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(messages.errors.fields.endBeforeStart)).toBeVisible()
  await expect(page.getByText('endsAt must be after startsAt')).toHaveCount(0)
  status = 403
  await page.getByRole('button', { name: f.submitCreate }).click()
  await expect(dialog.getByText(messages.errors.forbidden)).toBeVisible()
  await expect(page.getByText('Forbidden', { exact: true })).toHaveCount(0)
})

// Logs in through the UI, so it must not start with the seeded admin session.
plain(
  'a PEMBINA manages services; a MEMBER sees no menu item and a no-access page',
  async ({ page, request }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    const nav = () => page.getByRole('navigation', { name: messages.nav.label }).first()

    await loginAndChange(page, await createE2eUser(request, 'PEMBINA'))
    await nav().getByRole('link', { name: messages.nav.services }).click()
    const title = `e2e-${randomSuffix()}`
    await page.getByRole('button', { name: t.add }).click()
    await fillForm(page, { title, date: futureDate(42), start: '09:00', end: '11:00' })
    await page.getByRole('button', { name: f.submitCreate }).click()
    const row = itemFor(page, 1280, title)
    await expect(row).toContainText(`09.00 - 11.00 ${messages.dates.wib}`)
    await row.getByRole('button', { name: `${t.deleteAria}: ${title}` }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t.confirmDelete.action })
      .click()
    await expect(itemFor(page, 1280, title)).toHaveCount(0)

    await page.evaluate(() => window.sessionStorage.clear())
    await loginAndChange(page, await createE2eUser(request, 'MEMBER'))
    await expect(nav().getByRole('link', { name: messages.nav.services })).toHaveCount(0)
    await page.goto('/services')
    await expect(page.getByText(t.noAccessTitle)).toBeVisible()
    expect(errors).toEqual([])
  },
)

for (const width of widths) {
  test(`services screens at ${width}px: no horizontal scroll, axe clean, no console errors`, async ({
    page,
    request,
  }) => {
    // Five axe runs over a list that grows with every leftover e2e- service (~5s each at 140
    // services, slower in parallel), so the default 30s is not enough.
    test.setTimeout(180_000)
    const errors = collectErrors(page)
    const service = await createE2eService(request, 45)
    await seedSession(page, await adminToken(request))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/services')
    await expect(itemFor(page, width, service.title)).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    await page.screenshot({ path: `.screens/f6-list-${width}.png`, fullPage: true })

    await page.getByRole('button', { name: t.add }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: f.submitCreate }).click() // shows every error state
    await expect(page.getByText(t.validation.required).first()).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    await page.screenshot({ path: `.screens/f6-form-errors-${width}.png` })
    await page.getByRole('button', { name: messages.common.cancel }).click()

    await itemFor(page, width, service.title)
      .getByRole('button', { name: `${t.editAria}: ${service.title}` })
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: `.screens/f6-form-edit-${width}.png` })
    // Controls are 44px below 1024px (touch); the desktop size is the design's 40px.
    for (const label of width < 1024 ? [f.titleLabel, f.startDate, f.endTime] : []) {
      const box = await page.getByLabel(label).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await page.getByRole('button', { name: messages.common.cancel }).click()

    await itemFor(page, width, service.title)
      .getByRole('button', { name: `${t.deleteAria}: ${service.title}` })
      .click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    await page.screenshot({ path: `.screens/f6-delete-${width}.png` })
    expect(errors).toEqual([])
  })
}
