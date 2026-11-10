import AxeBuilder from '@axe-core/playwright'
import { expect as baseExpect, type Page, type Route } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import {
  createE2eUser,
  expectNotInList,
  findInList,
  loginAndChange,
  pembinaToken,
  plain,
  randomSuffix,
  seedSession,
  test,
  wibInstant,
} from './fixtures.ts'

// E2: portal events management. Real flows use the cached admin and PEMBINA sessions (no login);
// the MEMBER check is the only login. Every title carries the `e2e-` prefix, which the global setup
// cleans up. The mocked checks need no data.
const expect = baseExpect.configure({ timeout: 20_000 })
test.describe.configure({ timeout: 90_000 })

const t = messages.events
const f = t.form

const tableOf = (page: Page) => page.getByTestId('events-table')
const rowOf = (page: Page, title: string | RegExp) =>
  tableOf(page).getByRole('row').filter({ hasText: title })

function collectErrors(page: Page, tolerate: RegExp[] = []): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !tolerate.some((re) => re.test(msg.text())))
      errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

/** The event is on no page. An empty list (the table is gone) counts as gone too. */
async function expectGone(page: Page, title: string) {
  await expect(tableOf(page).or(page.getByText(t.emptyTitle))).toBeVisible()
  if (await tableOf(page).isVisible())
    await expectNotInList(page, rowOf(page, title), { list: tableOf(page) })
}

test.describe('admin manages an event through the UI', () => {
  test.describe.configure({ mode: 'serial' })
  const suffix = randomSuffix()
  const title = `e2e-${suffix}`
  const renamed = `e2e-${suffix}-ubah`
  const location = `e2e-lokasi-${suffix}`
  const description = `e2e-deskripsi-${suffix}`
  const date = wibInstant(45, 9).slice(0, 10) // a future day; "09:30" WIB below

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('create: it is listed and persists after a reload', async ({ page }) => {
    await page.goto('events')
    await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()
    await page.getByRole('button', { name: t.add }).click()
    await page.getByLabel(f.titleLabel).fill(title)
    await page.getByLabel(f.date).and(page.locator('input')).fill(date)
    await page.getByLabel(f.time).fill('09:30')
    await page.getByLabel(f.locationLabel).fill(location)
    await page.getByLabel(f.descriptionLabel).fill(description)
    await page.getByRole('button', { name: f.submitCreate }).click()
    await expect(page.getByText(t.toast.created)).toBeVisible()
    const row = await findInList(page, rowOf(page, title), { list: tableOf(page) })
    await expect(row).toContainText(location)
    await expect(row).toContainText('09.30 WIB')
    await page.reload()
    const again = await findInList(page, rowOf(page, title), { list: tableOf(page) })
    await expect(again).toContainText(location)
  })

  test('edit: the change persists after a reload', async ({ page }) => {
    await page.goto('events')
    await (
      await findInList(page, rowOf(page, title), { list: tableOf(page) })
    )
      .getByRole('button', { name: `${t.editAria}: ${title}` })
      .click()
    await expect(page.getByLabel(f.descriptionLabel)).toHaveValue(description)
    await page.getByLabel(f.titleLabel).fill(renamed)
    await page.getByLabel(f.time).fill('10:45')
    await page.getByRole('button', { name: f.submitEdit }).click()
    await expect(page.getByText(t.toast.updated)).toBeVisible()
    await page.reload()
    const row = await findInList(page, rowOf(page, renamed), { list: tableOf(page) })
    await expect(row).toContainText('10.45 WIB')
    await expect(rowOf(page, new RegExp(`${title}(?!-ubah)`))).toHaveCount(0)
  })

  test('cancelling the delete dialog deletes nothing, confirming deletes for good', async ({
    page,
  }) => {
    await page.goto('events')
    const open = async () =>
      (await findInList(page, rowOf(page, renamed), { list: tableOf(page) }))
        .getByRole('button', { name: `${t.deleteAria}: ${renamed}` })
        .click()
    await open()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(t.confirmDelete.title)
    await expect(dialog).toContainText('Hapus permanen? Data tidak bisa dikembalikan.')
    await expect(dialog).toContainText(renamed)
    await dialog.getByRole('button', { name: messages.common.cancel }).click()
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await findInList(page, rowOf(page, renamed), { list: tableOf(page) })

    await open()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t.confirmDelete.action })
      .click()
    await expect(page.getByText(t.toast.deleted)).toBeVisible()
    await expectGone(page, renamed)
    await page.reload()
    await expectGone(page, renamed)
  })
})

// Uses the shared PEMBINA session, so it must not start with the admin session.
plain('PEMBINA sees the nav entry and can open the page', async ({ page }) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await seedSession(page, pembinaToken())
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: messages.nav.label }).first()
  await expect(nav.getByRole('link', { name: messages.nav.events })).toBeVisible()
  await page.goto('events')
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()
  await expect(page.getByRole('main').locator('[data-slot="skeleton"]')).toHaveCount(0)
  await expect(page).toHaveURL(/events$/)
  expect(errors).toEqual([])
})

plain('MEMBER has no nav entry and a direct URL sends them home', async ({ browser, request }) => {
  const member = await createE2eUser(request)
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const own = await context.newPage()
  await loginAndChange(own, member)
  const nav = own.getByRole('navigation', { name: messages.nav.label }).first()
  await expect(nav.getByRole('link', { name: messages.nav.mySchedule })).toBeVisible()
  await expect(nav.getByRole('link', { name: messages.nav.events })).toHaveCount(0)
  await own.goto('events')
  await expect(own).toHaveURL(/\/volunteer-portal\/$/)
  await expect(
    own.getByRole('heading', { level: 1, name: messages.placeholder.title }),
  ).toBeVisible()
  await context.close()
})

// --- Mocked responses (no data): loading, list, form, delete dialog, empty and error at 360 and 1280 ---

// Items copied from docs/api/events.md.
const EVENT = {
  id: '6f1c2b9e-0c58-4a8e-9d3f-2f7a1c0b5e11',
  title: 'e2e-mock',
  startsAt: '2031-05-01T10:00:00.000Z',
  location: 'Main hall',
  description: 'An evening together',
  createdBy: 'a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb',
  createdAt: '2026-11-10T09:00:00.000Z',
  updatedAt: '2026-11-10T09:00:00.000Z',
}
const API = '**/api/admin/events'

async function seriousViolations(page: Page, scope?: string): Promise<string[]> {
  if (scope)
    await page
      .locator(scope)
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  const builder = new AxeBuilder({ page })
  const results = await (scope ? builder.include(scope) : builder).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

/** Visible controls inside `root` that are shorter than 44px. */
function smallTargets(page: Page, root: string): Promise<string[]> {
  return page.evaluate((scope) => {
    const small: string[] = []
    const selector = `${scope} button, ${scope} a[href], ${scope} input, ${scope} select, ${scope} textarea, ${scope} [role="combobox"]`
    for (const el of document.querySelectorAll(selector)) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0 || el.closest('.sr-only')) continue
      if (el.getAttribute('aria-hidden') === 'true') continue
      if (box.height < 43.5) small.push(`${el.tagName.toLowerCase()} ${Math.round(box.height)}px`)
    }
    return small
  }, root)
}

async function audit(page: Page, label: string, width: number) {
  await expect(page.getByRole('main').locator('[data-slot="skeleton"]')).toHaveCount(0)
  expect(await hasHorizontalScroll(page), `scroll, ${label}`).toBe(false)
  if (width < 1024) expect(await smallTargets(page, 'main'), `targets, ${label}`).toEqual([])
  expect(await seriousViolations(page), `axe, ${label}`).toEqual([])
}

async function auditDialog(
  page: Page,
  role: 'dialog' | 'alertdialog',
  label: string,
  width: number,
) {
  const dialog = page.getByRole(role)
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box!.x, `x, ${label}`).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, `right edge, ${label}`).toBeLessThanOrEqual(width)
  expect(box!.y + box!.height, `bottom edge, ${label}`).toBeLessThanOrEqual(800)
  if (width < 1024)
    expect(await smallTargets(page, `[role="${role}"]`), `targets, ${label}`).toEqual([])
  expect(await seriousViolations(page, `[role="${role}"]`), `axe, ${label}`).toEqual([])
}

function fulfill(route: Route, status: number, body: unknown, delay = 0) {
  return new Promise<void>((resolve) =>
    setTimeout(() => void route.fulfill({ status, json: body }).then(resolve), delay),
  )
}

for (const width of [360, 1280]) {
  test(`events (mocked) at ${width}px: loading, list, form, delete dialog, empty and error states`, async ({
    page,
  }) => {
    const errors = collectErrors(page, [/status of 500/])
    await page.setViewportSize({ width, height: 800 })

    // Loading: the skeleton shows while the list is delayed.
    await page.route(API, (route) => fulfill(route, 200, [EVENT], 1500))
    await page.goto('events')
    await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()
    await expect(page.getByRole('main').locator('[data-slot="skeleton"]').first()).toBeVisible()

    // List.
    await expect(page.getByTestId(width >= 768 ? 'events-table' : 'events-cards')).toBeVisible()
    await audit(page, 'list', width)
    await page.screenshot({ path: `.screens/e2-list-${width}.png` })

    // Create form dialog, with validation messages.
    await page.getByRole('button', { name: t.add }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: f.submitCreate }).click()
    await expect(page.getByText(t.validation.required).first()).toBeVisible()
    await auditDialog(page, 'dialog', 'form', width)
    if (width === 360) await page.screenshot({ path: `.screens/e2-form-${width}.png` })
    await page.getByRole('dialog').getByRole('button', { name: messages.common.cancel }).click()

    // Delete dialog.
    await page.getByRole('button', { name: `${t.deleteAria}: e2e-mock` }).click()
    await auditDialog(page, 'alertdialog', 'delete dialog', width)
    if (width === 360) await page.screenshot({ path: `.screens/e2-delete-${width}.png` })
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: messages.common.cancel })
      .click()

    // Empty.
    await page.unroute(API)
    await page.route(API, (route) => fulfill(route, 200, []))
    await page.goto('events')
    await expect(page.getByText(t.emptyTitle)).toBeVisible()
    await audit(page, 'empty', width)

    // Error with retry: Indonesian text, never the backend message.
    await page.unroute(API)
    await page.route(API, (route) =>
      fulfill(route, 500, { message: 'secret backend text', statusCode: 500 }),
    )
    await page.goto('events')
    await expect(page.getByText(t.loadErrorTitle)).toBeVisible()
    await expect(page.getByText(messages.errors.server)).toBeVisible()
    await expect(page.getByText('secret backend text')).toHaveCount(0)
    await expect(page.getByRole('button', { name: messages.common.retry })).toBeVisible()
    await audit(page, 'error', width)
    expect(errors).toEqual([])
  })
}
