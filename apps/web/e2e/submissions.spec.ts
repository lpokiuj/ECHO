import AxeBuilder from '@axe-core/playwright'
import { expect as baseExpect, type Locator, type Page, type Route } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import {
  createE2ePrayerRequest,
  createE2eUser,
  createE2eVolunteerApplication,
  expectNotInList,
  findInList,
  loginAndChange,
  pembinaToken,
  plain,
  seedSession,
  test,
} from './fixtures.ts'

// P2: the submissions inbox. Real public POSTs: exactly ONE per endpoint in this whole file (the
// serial chains below create their submission in their first test). Everything else uses data
// from those, or `page.route` mocks. All names carry the `e2e-` prefix; the global setup cleans up.
const expect = baseExpect.configure({ timeout: 20_000 })
test.describe.configure({ timeout: 90_000 })

const t = messages.submissions

interface Kind {
  key: 'prayer' | 'volunteer'
  path: string
  api: string
  copy: typeof t.prayer | typeof t.volunteer
  navLabel: string
  from: string
  to: string
}

const prayer: Kind = {
  key: 'prayer',
  path: 'prayer-requests',
  api: '**/api/admin/prayer-requests*',
  copy: t.prayer,
  navLabel: messages.nav.prayerRequests,
  from: t.statuses.NEW,
  to: t.statuses.IN_PROGRESS,
}
const volunteer: Kind = {
  key: 'volunteer',
  path: 'volunteer-applications',
  api: '**/api/admin/volunteer-applications*',
  copy: t.volunteer,
  navLabel: messages.nav.volunteerApplications,
  from: t.statuses.NEW,
  to: t.statuses.CONTACTED,
}

function collectErrors(page: Page, tolerate: RegExp[] = []): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !tolerate.some((re) => re.test(msg.text()))) errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const navLink = (page: Page, label: string) =>
  page.getByRole('navigation', { name: messages.nav.label }).first().getByRole('link', { name: label })

/**
 * The NEW count on a nav link; 0 when the badge is hidden. Read in one DOM evaluation: the badge
 * disappears when the count reaches 0, and a locator read would then wait for it to come back.
 */
const navCount = (link: Locator): Promise<number> =>
  link.evaluate((el) =>
    Number(el.querySelector('[data-slot="badge"] [aria-hidden="true"]')?.textContent ?? 0),
  )

const tableOf = (page: Page, kind: Kind) =>
  page.getByTestId(kind.key === 'prayer' ? 'prayer-table' : 'volunteer-table')
const rowOf = (page: Page, kind: Kind, name: string) =>
  tableOf(page, kind).getByRole('row').filter({ hasText: name })

async function chooseStatus(page: Page, label: string) {
  await page.getByRole('combobox', { name: t.statusLabel }).click()
  await page.getByRole('option', { name: label }).click()
}

/** The item is on no page of the list. An empty list (the table is gone) counts as gone too. */
async function expectGone(page: Page, kind: Kind, name: string) {
  await expect(tableOf(page, kind).or(page.getByText(kind.copy.emptyTitle))).toBeVisible()
  if (await tableOf(page, kind).isVisible())
    await expectNotInList(page, rowOf(page, kind, name), { list: tableOf(page, kind) })
}

for (const kind of [prayer, volunteer]) {
  test.describe(`${kind.path}: admin handles a submission made through the public API`, () => {
    test.describe.configure({ mode: 'serial' })
    let name = ''
    const note = `e2e-catatan-${kind.key}`
    const detailName = () => `${kind.copy.detailAria}: ${name}`

    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
    })

    test('the new submission is listed and the status filter works', async ({ page, request }) => {
      name =
        kind.key === 'prayer'
          ? (await createE2ePrayerRequest(request)).name
          : (await createE2eVolunteerApplication(request)).fullName
      await page.goto(kind.path)
      await expect(page.getByRole('heading', { level: 1, name: kind.copy.title })).toBeVisible()
      const row = await findInList(page, rowOf(page, kind, name), { list: tableOf(page, kind) })
      await expect(row).toContainText(t.statuses.NEW)
      // Filtered by NEW it is still there; filtered by a status it does not have, it is gone.
      await chooseStatus(page, t.statuses.NEW)
      await expect(page).toHaveURL(/status=NEW/)
      await findInList(page, rowOf(page, kind, name), { list: tableOf(page, kind) })
      const other = kind.key === 'prayer' ? t.statuses.DONE : t.statuses.DECLINED
      await page.getByRole('combobox', { name: t.statusFilterLabel }).click()
      await page.getByRole('option', { name: other }).click()
      await expect(page).toHaveURL(new RegExp(`status=${kind.key === 'prayer' ? 'DONE' : 'DECLINED'}`))
      await expect(rowOf(page, kind, name)).toHaveCount(0)
    })

    test('status and note persist after a reload, and the badge count drops', async ({ page }) => {
      await page.goto(kind.path)
      await (
        await findInList(page, rowOf(page, kind, name), { list: tableOf(page, kind) })
      )
        .getByRole('link', { name: detailName() })
        .click()
      await expect(page.getByRole('button', { name: t.save })).toBeDisabled()
      const link = navLink(page, kind.navLabel)
      // The item is NEW, so the badge shows at least 1.
      await expect(link.locator('[data-slot="badge"]')).toBeVisible()
      const before = await navCount(link)
      await chooseStatus(page, kind.to)
      await page.getByLabel(t.noteLabel).fill(note)
      await page.getByRole('button', { name: t.save }).click()
      await expect(page.getByText(t.toast.saved)).toBeVisible()
      // Other suites may add NEW items at the same time, so compare with the count read before:
      // it must drop below it (the received value shows `before>after` on failure).
      await expect
        .poll(async () => {
          const after = await navCount(link)
          return after < before ? 'dropped' : `${before}>${after}`
        })
        .toBe('dropped')
      await page.reload()
      await expect(page.getByLabel(t.noteLabel)).toHaveValue(note)
      await expect(page.getByRole('combobox', { name: t.statusLabel })).toContainText(kind.to)
      await expect(page.getByText(new RegExp(`${t.handledBy}`))).toBeVisible()
    })

    test('cancelling the delete dialog deletes nothing, confirming deletes for good', async ({
      page,
    }) => {
      await page.goto(kind.path)
      await (
        await findInList(page, rowOf(page, kind, name), { list: tableOf(page, kind) })
      )
        .getByRole('link', { name: detailName() })
        .click()
      const deleteButton = page.getByRole('button', { name: `${kind.copy.deleteAria}: ${name}` })
      await deleteButton.click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText(t.confirmDelete.title)
      await expect(dialog).toContainText(t.confirmDelete.description)
      await expect(dialog).toContainText(name)
      await dialog.getByRole('button', { name: messages.common.cancel }).click()
      await expect(dialog).toHaveCount(0)
      await page.reload()
      await expect(page.getByLabel(t.noteLabel)).toHaveValue(note) // still there after a reload

      await page.getByRole('button', { name: `${kind.copy.deleteAria}: ${name}` }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: t.confirmDelete.action }).click()
      await expect(page.getByText(t.toast.deleted)).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${kind.path}$`))
      await expectGone(page, kind, name)
      await page.reload()
      await expectGone(page, kind, name)
    })
  })
}

// Uses the shared PEMBINA session, so it must not start with the admin session.
plain('PEMBINA sees both nav entries and can open both pages', async ({ page }) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await seedSession(page, pembinaToken())
  await page.goto('./')
  for (const kind of [prayer, volunteer]) {
    await expect(navLink(page, kind.navLabel)).toBeVisible()
    await page.goto(kind.path)
    await expect(page.getByRole('heading', { level: 1, name: kind.copy.title })).toBeVisible()
    await expect(page.getByRole('main').locator('[data-slot="skeleton"]')).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`${kind.path}$`))
  }
  expect(errors).toEqual([])
})

plain('MEMBER has no nav entries and a direct URL sends them home', async ({ browser, request }) => {
  const member = await createE2eUser(request)
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const own = await context.newPage()
  await loginAndChange(own, member)
  const nav = own.getByRole('navigation', { name: messages.nav.label }).first()
  await expect(nav.getByRole('link', { name: messages.nav.mySchedule })).toBeVisible()
  for (const kind of [prayer, volunteer]) {
    await expect(nav.getByRole('link', { name: new RegExp(kind.navLabel) })).toHaveCount(0)
    await own.goto(kind.path)
    await expect(own).toHaveURL(/\/volunteer-portal\/$/)
    await expect(
      own.getByRole('heading', { level: 1, name: messages.placeholder.title }),
    ).toBeVisible()
  }
  await context.close()
})

// --- Mocked responses (no public POST): loading, error, empty, list and detail at every width ---

// Items copied from docs/api/admin-submissions.md (ids and dates filled where the doc shows "...").
const PRAYER_ITEM = {
  id: '5c0e6a4a-0b7e-4f6e-9a55-3a3d6a1c9e01',
  name: 'e2e-mock',
  contact: '0812',
  wantsFollowUp: true,
  content: 'Please pray',
  consentAt: '2026-03-01T00:00:00.000Z',
  status: 'NEW',
  adminNote: null,
  handledBy: null,
  handledAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
}
const VOLUNTEER_ITEM = {
  id: '7d2f1c88-2a43-4c1e-8f0b-9b6f0f3a7e02',
  fullName: 'e2e-mock',
  whatsapp: '0813',
  email: null,
  availability: 'Sundays',
  message: null,
  bidang: [
    { id: 'a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb', name: 'Music' },
    { id: 'aba2c1ed-b318-467b-8388-e97b051dec22', name: 'Worship' },
  ],
  consentAt: '2026-03-01T00:00:00.000Z',
  status: 'NEW',
  adminNote: null,
  handledBy: null,
  handledAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
}
const mockItem = (kind: Kind) => (kind.key === 'prayer' ? PRAYER_ITEM : VOLUNTEER_ITEM)

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

/** Visible controls below 1024px are at least 44px tall (the main area only; the nav is shared). */
function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = []
    const selector = 'main button, main a[href], main input, main select, main textarea, main [role="combobox"]'
    for (const el of document.querySelectorAll(selector)) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0 || el.closest('.sr-only')) continue
      if (box.height < 43.5) small.push(`${el.tagName.toLowerCase()} ${Math.round(box.height)}px`)
    }
    return small
  })
}

async function audit(page: Page, label: string, width: number) {
  await expect(page.getByRole('main').locator('[data-slot="skeleton"]')).toHaveCount(0)
  expect(await hasHorizontalScroll(page), `scroll, ${label}`).toBe(false)
  if (width < 1024) expect(await smallTargets(page), `targets, ${label}`).toEqual([])
  expect(await seriousViolations(page), `axe, ${label}`).toEqual([])
}

function fulfill(route: Route, status: number, body: unknown, delay = 0) {
  return new Promise<void>((resolve) =>
    setTimeout(() => void route.fulfill({ status, json: body }).then(resolve), delay),
  )
}

for (const width of [360, 1280]) {
  for (const kind of [prayer, volunteer]) {
    test(`${kind.path} (mocked) at ${width}px: loading, list, detail, delete dialog, empty and error states`, async ({
      page,
    }) => {
      const errors = collectErrors(page, [/status of 500/])
      await page.setViewportSize({ width, height: 800 })
      const item = mockItem(kind)

      // Loading: the skeleton shows while the list is delayed.
      await page.route(kind.api, (route) => fulfill(route, 200, [item], 1500))
      await page.goto(kind.path)
      await expect(page.getByRole('heading', { level: 1, name: kind.copy.title })).toBeVisible()
      await expect(page.getByRole('main').locator('[data-slot="skeleton"]').first()).toBeVisible()

      // List.
      const list = page.getByTestId(`${kind.key}-${width >= 768 ? 'table' : 'cards'}`)
      await expect(list).toBeVisible()
      await audit(page, `${kind.path} list`, width)
      if (kind === prayer) await page.screenshot({ path: `.screens/p2-list-${width}.png` })

      // Detail (found in the mocked list) and its delete dialog.
      await page.getByRole('link', { name: `${kind.copy.detailAria}: e2e-mock` }).click()
      await expect(page.getByLabel(t.noteLabel)).toBeVisible()
      await audit(page, `${kind.path} detail`, width)
      if (kind === prayer)
        await page.screenshot({ path: `.screens/p2-detail-${width}.png`, fullPage: true })
      await page.getByRole('button', { name: `${kind.copy.deleteAria}: e2e-mock` }).click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(800)
      expect(await seriousViolations(page, '[role="alertdialog"]')).toEqual([])
      if (kind === prayer) await page.screenshot({ path: `.screens/p2-delete-${width}.png` })
      await dialog.getByRole('button', { name: messages.common.cancel }).click()

      // Empty.
      await page.unroute(kind.api)
      await page.route(kind.api, (route) => fulfill(route, 200, []))
      await page.goto(kind.path)
      await expect(page.getByText(kind.copy.emptyTitle)).toBeVisible()
      await audit(page, `${kind.path} empty`, width)

      // Error with retry: Indonesian text, never the backend message.
      await page.unroute(kind.api)
      await page.route(kind.api, (route) =>
        fulfill(route, 500, { message: 'secret backend text', statusCode: 500 }),
      )
      await page.goto(kind.path)
      await expect(page.getByText(kind.copy.loadErrorTitle)).toBeVisible()
      await expect(page.getByText(messages.errors.server)).toBeVisible()
      await expect(page.getByText('secret backend text')).toHaveCount(0)
      await expect(page.getByRole('button', { name: messages.common.retry })).toBeVisible()
      await audit(page, `${kind.path} error`, width)
      expect(errors).toEqual([])
    })
  }
}
