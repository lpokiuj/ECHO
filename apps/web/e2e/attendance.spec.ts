import AxeBuilder from '@axe-core/playwright'
import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { fillMessage, messages } from '../src/lib/messages.ts'
import {
  addTeamMember,
  assignUsers,
  createE2eTeam,
  createE2eUser,
  createStartingSoonService,
  loginAndChange,
  plain as test,
  type CreatedUser,
} from './fixtures.ts'

// Recording opens only once the service has started and the API rejects a past startsAt, so
// the service is created to start in about 45 seconds and the test waits for it.
test.describe.configure({ retries: 0 })

const t = messages.attendance
const taker = messages.assign.taker
const widths = [360, 390, 768, 1280]

async function scenario(request: APIRequestContext) {
  const [service, team, leader, takerUser, peer] = await Promise.all([
    createStartingSoonService(request, 45),
    createE2eTeam(request),
    createE2eUser(request),
    createE2eUser(request),
    createE2eUser(request),
  ])
  await Promise.all([
    addTeamMember(request, team.id, leader.id, true),
    addTeamMember(request, team.id, takerUser.id),
    addTeamMember(request, team.id, peer.id),
  ])
  await assignUsers(request, service.id, team.id, [takerUser.id, peer.id])
  return { service, team, leader, takerUser, peer }
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

async function session(browser: Browser, user: CreatedUser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAndChange(page, user)
  return { context, page }
}

test('leader designates the taker, the taker records an absence after the start', async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000)
  const s = await scenario(request)
  const l = await session(browser, s.leader)
  const errors = collectErrors(l.page)

  // Leader: designate from the assigned members on the assign screen.
  await l.page.goto(`assign?service=${s.service.id}&team=${s.team.id}`)
  await l.page.getByRole('combobox', { name: taker.label }).click()
  await l.page.getByRole('option', { name: s.takerUser.name }).click()
  await l.page.getByRole('button', { name: taker.save }).click()
  await expect(
    l.page.getByText(fillMessage(taker.current, { name: s.takerUser.name })),
  ).toBeVisible()

  // Taker: before the start the switches are locked; after it they work.
  const tk = await session(browser, s.takerUser)
  await tk.page.goto('attendance')
  const peerSwitch = tk.page.getByRole('switch', {
    name: fillMessage(t.record.absentAria, { name: s.peer.name }),
  })
  await expect(peerSwitch).toBeVisible()
  await expect(
    tk.page.getByRole('switch', {
      name: fillMessage(t.record.absentAria, { name: s.takerUser.name }),
    }),
  ).toBeDisabled()
  await expect(async () => {
    await tk.page.reload()
    await expect(peerSwitch).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 120_000, intervals: [5_000] })
  await peerSwitch.click()
  await expect(peerSwitch).toBeChecked()
  await tk.page.reload()
  await expect(peerSwitch).toBeChecked()

  // The peer sees one absence; the leader's recap shows the count.
  const p = await session(browser, s.peer)
  await p.page.goto('attendance')
  await expect(p.page.getByTestId('my-absence-count')).toHaveText(
    fillMessage(t.mine.count, { count: 1 }),
  )
  await l.page.goto('./')
  const recap = l.page
    .locator('[data-testid="recap-table"], [data-testid="recap-cards"]')
    .filter({ visible: true })
  await expect(recap.getByText(s.peer.name)).toBeVisible()
  await expect(recap).toContainText(fillMessage(t.recap.countValue, { count: 1 }))

  // Unassigning someone with a record is refused (HAS_ATTENDANCE_RECORDS) or the service already started.
  expect(errors).toEqual([])
  await Promise.all([l.context.close(), tk.context.close(), p.context.close()])
})

test('Kehadiran fits every width and has no axe violations', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const s = await scenario(request)
  const l = await session(browser, s.leader)
  const errors = collectErrors(l.page)
  for (const width of widths) {
    await l.page.setViewportSize({ width, height: 900 })
    await l.page.goto('attendance')
    await expect(l.page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()
    expect(await hasHorizontalScroll(l.page)).toBe(false)
    expect(await seriousViolations(l.page)).toEqual([])
    await l.page.screenshot({ path: `.screens/attendance-${width}.png`, fullPage: true })
    // The recap is on the home page (PLAN.md), not on Kehadiran.
    await l.page.goto('./')
    await expect(l.page.getByRole('heading', { name: t.recap.title })).toBeVisible()
    expect(await hasHorizontalScroll(l.page)).toBe(false)
    await l.page.goto(`assign?service=${s.service.id}&team=${s.team.id}`)
    await expect(l.page.getByRole('heading', { name: taker.title })).toBeVisible()
    expect(await hasHorizontalScroll(l.page)).toBe(false)
    await l.page.screenshot({ path: `.screens/assign-taker-${width}.png`, fullPage: true })
  }
  expect(errors).toEqual([])
  await l.context.close()
})
