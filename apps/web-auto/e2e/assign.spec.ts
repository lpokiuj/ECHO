import AxeBuilder from '@axe-core/playwright'
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
  type Route,
} from '@playwright/test'
import { fillMessage, messages } from '../src/lib/messages.ts'
import {
  addTeamMember,
  adminToken,
  createE2eService,
  createE2eTeam,
  createE2eUser,
  loginAndChange,
  type CreatedUser,
} from './fixtures.ts'

// The race must never be retried into a pass.
test.describe.configure({ retries: 0 })

const t = messages.assign
const widths = [360, 390, 768, 1280]

interface Scenario {
  service: { id: string; title: string }
  teamA: { id: string; name: string }
  teamB: { id: string; name: string }
  leaderA: CreatedUser
  leaderB: CreatedUser
  volunteer: CreatedUser
  other: CreatedUser
}

/** Everything is created through the API as admin and named e2e-<random>. */
async function scenario(request: APIRequestContext): Promise<Scenario> {
  const [service, teamA, teamB, leaderA, leaderB, volunteer, other] = await Promise.all([
    createE2eService(request),
    createE2eTeam(request),
    createE2eTeam(request),
    createE2eUser(request),
    createE2eUser(request),
    createE2eUser(request),
    createE2eUser(request),
  ])
  await Promise.all([
    addTeamMember(request, teamA.id, leaderA.id, true),
    addTeamMember(request, teamB.id, leaderB.id, true),
    ...[volunteer, other].flatMap((u) => [
      addTeamMember(request, teamA.id, u.id),
      addTeamMember(request, teamB.id, u.id),
    ]),
  ])
  return { service, teamA, teamB, leaderA, leaderB, volunteer, other }
}

/** A leader in their own browser context: forced password change, then the assign screen. */
async function leaderSession(
  browser: Browser,
  user: CreatedUser,
  serviceId: string,
  teamId: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAndChange(page, user)
  await openAssign(page, serviceId, teamId)
  return { context, page }
}

async function openAssign(page: Page, serviceId: string, teamId: string) {
  await page.goto(`/assign?service=${serviceId}&team=${teamId}`)
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()
}

const assignButton = (page: Page) =>
  page.getByRole('button', { name: new RegExp(`^${t.assignAction}`) })
const checkbox = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true })
const isAssignPost = (r: Response) =>
  r.request().method() === 'POST' && /\/teams\/[^/]+\/assignments$/.test(r.url())

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

test('leader assigns with a double click (one request), then unassigns after confirming', async ({
  browser,
  request,
}) => {
  const s = await scenario(request)
  const { context, page } = await leaderSession(browser, s.leaderA, s.service.id, s.teamA.id)
  const errors = collectErrors(page)
  let posts = 0
  await page.route('**/assignments', async (route: Route) => {
    if (route.request().method() === 'POST') posts += 1
    await route.continue()
  })

  await expect(checkbox(page, s.volunteer.name)).toBeVisible()
  await checkbox(page, s.volunteer.name).check()
  await expect(assignButton(page)).toHaveText(fillMessage(t.assignActionCount, { count: 1 }))
  await assignButton(page).dblclick()

  const panel = page.getByTestId('assign-result')
  await expect(panel).toContainText(s.volunteer.name)
  await expect(panel).toContainText(fillMessage(t.result.added, { count: 1 }))
  // The refreshed list shows the volunteer as assigned, and the other one still selectable.
  await expect(checkbox(page, s.volunteer.name)).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: s.volunteer.name })).toContainText(
    t.assignedBadge,
  )
  await expect(checkbox(page, s.other.name)).toBeVisible()
  expect(posts).toBe(1)

  await page
    .getByRole('button', { name: fillMessage(t.unassignAria, { name: s.volunteer.name }) })
    .click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText(s.volunteer.name)
  await expect(dialog).toContainText(s.service.title)
  await expect(dialog).toContainText(s.teamA.name)
  await dialog.getByRole('button', { name: t.confirmUnassign.action }).click()
  await expect(checkbox(page, s.volunteer.name)).toBeVisible()
  expect(errors).toEqual([])
  await context.close()
})

test('a leader of two teams can switch teams', async ({ browser, request }) => {
  const s = await scenario(request)
  // leaderA also leads team B.
  await addTeamMember(request, s.teamB.id, s.leaderA.id, true)
  const { context, page } = await leaderSession(browser, s.leaderA, s.service.id, s.teamA.id)
  const switcher = page.getByRole('combobox', { name: t.teamLabel })
  await expect(switcher).toContainText(s.teamA.name)
  const loaded = page.waitForResponse(
    (r) => r.url().includes(`/teams/${s.teamB.id}/candidates`) && r.status() === 200,
  )
  await switcher.click()
  await page.getByRole('option', { name: s.teamB.name }).click()
  await loaded
  await expect(switcher).toContainText(s.teamB.name)
  await expect(page).toHaveURL(new RegExp(`team=${s.teamB.id}`))
  await expect(checkbox(page, s.volunteer.name)).toBeVisible()
  await context.close()
})

test('a service that already started disables the controls and says why', async ({
  browser,
  request,
}) => {
  const s = await scenario(request)
  const { context, page } = await leaderSession(browser, s.leaderA, s.service.id, s.teamA.id)
  // The API refuses to create past services, so only the list response is changed (DR-3).
  // The page is reloaded so the start time reaches the client; nothing else is mocked.
  await page.route('**/api/services', async (route) => {
    const response = await route.fetch()
    const list = (await response.json()) as { id: string; startsAt: string }[]
    const past = list.map((x) =>
      x.id === s.service.id ? { ...x, startsAt: '2020-01-01T00:00:00.000Z' } : x,
    )
    await route.fulfill({ response, json: past })
  })
  await openAssign(page, s.service.id, s.teamA.id)
  await expect(page.getByText(t.startedNotice)).toBeVisible()
  await expect(checkbox(page, s.volunteer.name)).toBeDisabled()
  await expect(assignButton(page)).toBeDisabled()
  await context.close()
})

test('two leaders of different teams assign the same volunteer at once: exactly one wins', async ({
  browser,
  request,
}) => {
  test.setTimeout(90_000)
  const s = await scenario(request)
  const [a, b] = await Promise.all([
    leaderSession(browser, s.leaderA, s.service.id, s.teamA.id),
    leaderSession(browser, s.leaderB, s.service.id, s.teamB.id),
  ])
  const candidateGets = { a: 0, b: 0 }
  a.page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().endsWith('/candidates')) candidateGets.a += 1
  })
  b.page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().endsWith('/candidates')) candidateGets.b += 1
  })

  // Barrier: both POSTs are held until both have been issued, then released together.
  let arrived = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  const failSafe = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Barrier timed out: a POST was never sent')), 20_000),
  )
  const hold = async (route: Route) => {
    if (route.request().method() !== 'POST') return route.continue()
    arrived += 1
    if (arrived === 2) release()
    await Promise.race([gate, failSafe])
    return route.continue()
  }
  await Promise.all([a.page.route('**/assignments', hold), b.page.route('**/assignments', hold)])

  await checkbox(a.page, s.volunteer.name).check()
  await checkbox(b.page, s.volunteer.name).check()
  const responseA = a.page.waitForResponse(isAssignPost)
  const responseB = b.page.waitForResponse(isAssignPost)
  const getsBefore = { ...candidateGets }
  await Promise.all([assignButton(a.page).click(), assignButton(b.page).click()])
  const [ra, rb] = await Promise.all([responseA, responseB])
  expect([ra.status(), rb.status()]).toEqual([200, 200])
  const bodyA = (await ra.json()) as {
    assigned: string[]
    skipped: { reason: string; heldByTeam?: { name: string } }[]
  }
  const bodyB = (await rb.json()) as typeof bodyA

  const wonA = bodyA.assigned.includes(s.volunteer.id)
  const wonB = bodyB.assigned.includes(s.volunteer.id)
  expect(Number(wonA) + Number(wonB)).toBe(1)

  const winner = wonA ? { ...a, team: s.teamA, body: bodyA } : { ...b, team: s.teamB, body: bodyB }
  const loser = wonA ? { ...b, team: s.teamB, body: bodyB } : { ...a, team: s.teamA, body: bodyA }
  const loserKey = wonA ? 'b' : 'a'
  expect(loser.body.assigned).toEqual([])
  expect(loser.body.skipped).toHaveLength(1)
  expect(loser.body.skipped[0]!.reason).toBe('ALREADY_ASSIGNED_OTHER_TEAM')
  expect(loser.body.skipped[0]!.heldByTeam?.name).toBe(winner.team.name)

  // Loser UI: skipped result with the holding team, and a refreshed candidate list.
  const loserPanel = loser.page.getByTestId('assign-result')
  await expect(loserPanel).toContainText(s.volunteer.name)
  await expect(loserPanel).toContainText(
    fillMessage(t.result.reasonOtherTeam, { team: winner.team.name }),
  )
  await expect(checkbox(loser.page, s.volunteer.name)).toHaveCount(0)
  await expect(checkbox(loser.page, s.other.name)).toBeVisible()
  await expect.poll(() => candidateGets[loserKey]).toBeGreaterThan(getsBefore[loserKey])

  // Winner UI: added, and shown as assigned.
  await expect(winner.page.getByTestId('assign-result')).toContainText(
    fillMessage(t.result.added, { count: 1 }),
  )
  await expect(winner.page.getByRole('row').filter({ hasText: s.volunteer.name })).toContainText(
    t.assignedBadge,
  )

  // The server agrees: only one team holds the volunteer.
  const token = await adminToken(request)
  const list = await request.get('/api/services?includePast=true', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const services = (await list.json()) as {
    id: string
    assignments: { userId: string; teamId: string }[]
  }[]
  const held = services
    .find((x) => x.id === s.service.id)!
    .assignments.filter((x) => x.userId === s.volunteer.id)
  expect(held).toHaveLength(1)
  expect(held[0]!.teamId).toBe(winner.team.id)
  await Promise.all([a.context.close(), b.context.close()])
})

test('assign screen at 360, 390, 768 and 1280: no overflow, no axe violations, no console errors', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000)
  const s = await scenario(request)
  const { context, page } = await leaderSession(browser, s.leaderA, s.service.id, s.teamA.id)
  const errors = collectErrors(page)
  const check = async (name: string, width: number) => {
    await page.screenshot({ path: `.screens/assign-${name}-${width}.png`, fullPage: true })
    expect(await hasHorizontalScroll(page), `${name} overflow at ${width}`).toBe(false)
    expect(await seriousViolations(page), `${name} axe at ${width}`).toEqual([])
  }

  await page.setViewportSize({ width: 1280, height: 800 })
  await checkbox(page, s.volunteer.name).check()
  await assignButton(page).click()
  await expect(page.getByTestId('assign-result')).toBeVisible()

  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 })
    await expect(
      page.getByRole('button', { name: fillMessage(t.unassignAria, { name: s.volunteer.name }) }),
    ).toBeVisible()
    await check('result', width)
    // Touch targets below 1024px.
    if (width < 1024) {
      const unassign = page.getByRole('button', {
        name: fillMessage(t.unassignAria, { name: s.volunteer.name }),
      })
      for (const target of [assignButton(page), unassign]) {
        const box = await target.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      const label = page.locator('label:visible', { hasText: s.other.name })
      const labelBox = await label.first().boundingBox()
      expect(labelBox!.height).toBeGreaterThanOrEqual(44)
    }
    await page
      .getByRole('button', { name: fillMessage(t.unassignAria, { name: s.volunteer.name }) })
      .click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await check('confirm', width)
    const box = await page.getByRole('alertdialog').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: messages.common.cancel, exact: true })
      .click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  }
  expect(errors).toEqual([])
  await context.close()
})
