// Mock-only criterion (DECISIONS D-020): the API rejects a past startsAt, so a real ended
// service cannot be created. "Ended services are hidden by default" is covered by MSW unit
// tests in src/features/schedule/schedule.test.tsx. Here we only check that the toggle sends
// includePast=true and that the fixture stays visible.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { formatDate } from '../src/lib/dates.ts'
import { messages } from '../src/lib/messages.ts'
import {
  addTeamMember,
  adminToken,
  assignUsers,
  createE2eService,
  createE2eTeam,
  createE2eUser,
  findInList,
  seedSession,
  type CreatedUser,
} from './fixtures.ts'

const t = messages.schedule
const a = messages.auth
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

/** A future service with a team and two assigned `e2e-` members, all created as admin. */
async function createFixture(request: Parameters<typeof createE2eUser>[0]) {
  const service = await createE2eService(request)
  const team = await createE2eTeam(request)
  const users = [await createE2eUser(request), await createE2eUser(request)]
  for (const u of users) await addTeamMember(request, team.id, u.id)
  await assignUsers(
    request,
    service.id,
    team.id,
    users.map((u) => u.id),
  )
  return { service, team, users }
}

/** Logs in through the UI; new accounts are not forced to change their password. */
async function loginAndChange(page: Page, user: CreatedUser) {
  await page.goto('login')
  await page.getByLabel(a.emailLabel).fill(user.email)
  await page.getByLabel(a.passwordLabel).fill(user.password)
  await page.getByRole('button', { name: a.loginSubmit }).click()
  await expect(page).toHaveURL(/\/volunteer-portal\/$/)
}

/** The visible list item for a title: a table row on desktop, a card below 768px. */
function itemFor(page: Page, width: number, title: string) {
  return width >= 768
    ? page.getByTestId('schedule-table').getByRole('row').filter({ hasText: title })
    : page.getByTestId('schedule-cards').getByRole('listitem').filter({ hasText: title })
}

function listFor(page: Page, width: number) {
  return page.getByTestId(width >= 768 ? 'schedule-table' : 'schedule-cards')
}

test('full schedule shows a created service with its teams and people in WIB', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page)
  const { service, team, users } = await createFixture(request)
  await seedSession(page, await adminToken(request))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('schedule')
  await expect(page.getByRole('heading', { level: 1, name: t.fullTitle })).toBeVisible()

  const row = await findInList(page, itemFor(page, 1280, service.title), {
    list: listFor(page, 1280),
  })
  await expect(row).toBeVisible()
  await expect(row).toContainText(formatDate(service.startsAt))
  await expect(row).toContainText(`09.00 - 11.00 ${messages.dates.wib}`)
  await row.getByRole('button', { name: new RegExp(t.detail) }).click()
  const dialog = page.getByRole('dialog', { name: service.title })
  await expect(dialog.getByRole('region', { name: team.name })).toBeVisible()
  for (const u of users) await expect(dialog).toContainText(u.name)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // The toggle asks for past services too; the upcoming fixture stays.
  const toggle = page.getByRole('switch', { name: t.includePast })
  const request2 = page.waitForRequest((r) => r.url().includes('/services?includePast=true'))
  await toggle.click()
  await request2
  await expect(toggle).toBeChecked()
  await expect(
    await findInList(page, itemFor(page, 1280, service.title), { list: listFor(page, 1280) }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('my schedule shows the assigned service with its team; an unassigned user sees empty', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page)
  const { service, team, users } = await createFixture(request)
  await page.setViewportSize({ width: 1280, height: 800 })
  await loginAndChange(page, users[0]!)
  await page
    .getByRole('navigation', { name: messages.nav.label })
    .first()
    .getByRole('link', { name: messages.nav.mySchedule })
    .click()
  await expect(page).toHaveURL(/\/my-schedule$/)
  const row = await findInList(page, itemFor(page, 1280, service.title), {
    list: listFor(page, 1280),
  })
  await expect(row).toBeVisible()
  await expect(row).toContainText(team.name)
  const withPast = page.waitForRequest((r) => r.url().includes('/me/schedule?includePast=true'))
  await page.getByRole('switch', { name: t.includePast }).click()
  await withPast
  await expect(
    await findInList(page, itemFor(page, 1280, service.title), { list: listFor(page, 1280) }),
  ).toBeVisible()
  expect(errors).toEqual([])

  const lonely = await createE2eUser(request)
  await page.evaluate(() => window.sessionStorage.clear())
  await loginAndChange(page, lonely)
  await page.goto('my-schedule')
  await expect(page.getByText(t.emptyMineTitle)).toBeVisible()
  await expect(page.getByRole('button', { name: t.emptyShowPast })).toBeVisible()
})

for (const width of widths) {
  test(`full schedule at ${width}px: table or cards, no overflow, axe clean, no console errors`, async ({
    page,
    request,
  }) => {
    // Axe over a schedule that grows with every leftover e2e- service (see D-032).
    test.setTimeout(150_000)
    const errors = collectErrors(page)
    const { service } = await createFixture(request)
    await seedSession(page, await adminToken(request))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('schedule')
    await expect(
      await findInList(page, itemFor(page, width, service.title), { list: listFor(page, width) }),
    ).toBeVisible()
    await expect(page.getByTestId('schedule-table')).toBeVisible({ visible: width >= 768 })
    await expect(page.getByTestId('schedule-cards')).toBeVisible({ visible: width < 768 })
    await page.screenshot({ path: `.screens/f5-full-${width}.png`, fullPage: true })
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    if (width < 1024) {
      const label = page.locator('label').filter({ hasText: t.includePast })
      expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    expect(errors).toEqual([])
  })

  test(`my schedule at ${width}px: table or cards, no overflow, axe clean, no console errors`, async ({
    page,
    request,
  }) => {
    const errors = collectErrors(page)
    const { service, users } = await createFixture(request)
    await page.setViewportSize({ width, height: 800 })
    await loginAndChange(page, users[0]!)
    await page.goto('my-schedule')
    await expect(
      await findInList(page, itemFor(page, width, service.title), { list: listFor(page, width) }),
    ).toBeVisible()
    await expect(page.getByTestId('schedule-table')).toBeVisible({ visible: width >= 768 })
    await expect(page.getByTestId('schedule-cards')).toBeVisible({ visible: width < 768 })
    await page.screenshot({ path: `.screens/f5-mine-${width}.png`, fullPage: true })
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    expect(errors).toEqual([])
  })
}
