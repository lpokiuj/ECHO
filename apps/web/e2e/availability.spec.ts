import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import {
  addTeamMember,
  createE2eService,
  createE2eTeam,
  createE2eUser,
  findInList,
  loginAndChange,
  assignUsers,
} from './fixtures.ts'

const av = messages.availability
const a = messages.assign
const widths = [360, 390, 768, 1280]

async function scenario(request: APIRequestContext) {
  const [service, team, leader, member, assigned] = await Promise.all([
    createE2eService(request, 3),
    createE2eTeam(request),
    createE2eUser(request),
    createE2eUser(request),
    createE2eUser(request),
  ])
  await Promise.all([
    addTeamMember(request, team.id, leader.id, true),
    addTeamMember(request, team.id, member.id),
    addTeamMember(request, team.id, assigned.id),
  ])
  await assignUsers(request, service.id, team.id, [assigned.id])
  return { service, team, leader, member, assigned }
}

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

async function session(browser: Browser, user: Parameters<typeof loginAndChange>[1]) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAndChange(page, user)
  return { context, page }
}

async function openDetail(page: Page, title: string) {
  await page.goto('schedule')
  const item = await findInList(
    page,
    page
      .locator('[data-testid="schedule-table"] tr, [data-testid="schedule-cards"] li')
      .filter({ hasText: title })
      .filter({ visible: true }),
    {
      list: page
        .locator('[data-testid="schedule-table"], [data-testid="schedule-cards"]')
        .filter({ visible: true }),
    },
  )
  await item.getByRole('button', { name: new RegExp(messages.schedule.detail) }).click()
  return page.getByRole('dialog', { name: title })
}

test('member marks unavailable, the leader sees them locked, then they unmark', async ({
  browser,
  request,
}) => {
  const s = await scenario(request)
  const m = await session(browser, s.member)
  const l = await session(browser, s.leader)
  const errors = collectErrors(m.page)

  const dialog = await openDetail(m.page, s.service.title)
  await dialog.getByRole('switch').click()
  await expect(dialog.getByRole('switch')).toBeChecked()

  await l.page.goto(`assign?service=${s.service.id}&team=${s.team.id}`)
  const row = l.page.getByRole('row').filter({ hasText: s.member.name })
  await expect(row).toContainText(a.unavailableBadge)
  await expect(l.page.getByRole('checkbox', { name: s.member.name, exact: true })).toBeDisabled()
  await expect(l.page.getByRole('checkbox', { name: s.assigned.name, exact: true })).toHaveCount(0)

  await dialog.getByRole('switch').click()
  await expect(dialog.getByRole('switch')).not.toBeChecked()
  await l.page.reload()
  await expect(l.page.getByRole('checkbox', { name: s.member.name, exact: true })).toBeEnabled()
  expect(errors).toEqual([])
  await m.context.close()
  await l.context.close()
})

test('an assigned member has no toggle, and the screen fits 360px to 1280px', async ({
  browser,
  request,
}) => {
  const s = await scenario(request)
  const m = await session(browser, s.assigned)
  const errors = collectErrors(m.page)
  for (const width of widths) {
    await m.page.setViewportSize({ width, height: 800 })
    const dialog = await openDetail(m.page, s.service.title)
    await expect(dialog.getByText(av.assignedNote)).toBeVisible()
    await expect(dialog.getByRole('switch')).toHaveCount(0)
    expect(await hasHorizontalScroll(m.page)).toBe(false)
    await m.page.screenshot({ path: `.screens/availability-assigned-${width}.png` })
    await m.page.keyboard.press('Escape')
  }
  expect(errors).toEqual([])
  await m.context.close()
})

test('toggle layout and axe at every width', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const s = await scenario(request)
  const m = await session(browser, s.member)
  const errors = collectErrors(m.page)
  for (const width of widths) {
    await m.page.setViewportSize({ width, height: 800 })
    const dialog = await openDetail(m.page, s.service.title)
    const toggle = dialog.getByRole('switch')
    await expect(toggle).toBeVisible()
    // The dialog zooms in; measure after the animation (a scaled box reads 43.6px, not 44).
    await m.page.waitForTimeout(400)
    const box = await toggle.locator('xpath=ancestor::label').boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(await hasHorizontalScroll(m.page)).toBe(false)
    expect(await seriousViolations(m.page)).toEqual([])
    await m.page.screenshot({ path: `.screens/availability-toggle-${width}.png` })
    await m.page.keyboard.press('Escape')
  }
  expect(errors).toEqual([])
  await m.context.close()
})
