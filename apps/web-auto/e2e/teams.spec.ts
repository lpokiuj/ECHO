import AxeBuilder from '@axe-core/playwright'
import { expect as baseExpect, test as plain, type Browser, type Page } from '@playwright/test'
import { fillMessage, messages } from '../src/lib/messages.ts'
import {
  addTeamMember,
  adminToken,
  assignedUserIds,
  assignUsers,
  createE2eService,
  createE2eTeam,
  createE2eUser,
  deactivateUser,
  loginAndChange,
  seedSession,
  test,
} from './fixtures.ts'

// The users list (add dialog) and the teams list hold every leftover e2e- row, so a dev-mode
// render is slow: wait longer than the default 5s and allow longer tests (see D-032, D-038).
const expect = baseExpect.configure({ timeout: 20_000 })
test.describe.configure({ timeout: 90_000 })

const t = messages.teams
const d = t.detail
const widths = [360, 390, 768, 1280]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    // The browser logs the 4xx answers this spec provokes on purpose (duplicate name, inactive user).
    if (msg.type() === 'error' && !/status of (409|400)/.test(msg.text())) errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

/**
 * `scope` limits axe to one dialog. A page-wide run skips teams-list rows after the tenth
 * (the list grows with leftover e2e- teams; all rows are the same component). The roster of a
 * fresh e2e team is small and is scanned in full.
 */
async function seriousViolations(page: Page, scope?: string) {
  // Contrast is measured on the colors on screen, so wait for the dialog's open animation to end.
  if (scope)
    await page
      .locator(scope)
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  const builder = new AxeBuilder({ page })
  const results = await (
    scope
      ? builder.include(scope)
      : builder
          .exclude('[data-testid="teams-table"] tbody tr:nth-child(n+11)')
          .exclude('[data-testid="teams-cards"] > li:nth-child(n+11)')
  ).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

/** The visible item for a team on the list: a table row from 768px, a card below. */
function teamItem(page: Page, width: number, name: string) {
  return width >= 768
    ? page.getByTestId('teams-table').getByRole('row').filter({ hasText: name })
    : page.getByTestId('teams-cards').getByRole('listitem').filter({ hasText: name })
}

/** The visible item for a member on a team page. */
function memberItem(page: Page, width: number, name: string) {
  return width >= 768
    ? page.getByTestId('members-table').getByRole('row').filter({ hasText: name })
    : page.getByTestId('members-cards').getByRole('listitem').filter({ hasText: name })
}

async function freshPage(browser: Browser, width = 1280): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 800 } })
  return context.newPage()
}

/** Searches the add dialog for one user (the list holds hundreds) and picks them. */
async function addViaUi(page: Page, { name, email }: { name: string; email: string }) {
  await page.getByRole('button', { name: d.addMember }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(t.picker.searchLabel).fill(name)
  await dialog.getByRole('button', { name: new RegExp(`${email}`) }).click()
}

test('admin creates a team, hits a duplicate name, and renames it', async ({ page }) => {
  const errors = collectErrors(page)
  const name = `e2e-${Math.random().toString(16).slice(2, 10)}`
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/teams')
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()

  await page.getByRole('button', { name: t.addTeam }).click()
  await page.getByLabel(t.form.nameLabel, { exact: true }).fill(name)
  await page.getByRole('button', { name: t.form.submitCreate }).click()
  const row = teamItem(page, 1280, name)
  await expect(row).toBeVisible()

  // A second team with the same name is refused, inline on the field.
  await page.getByRole('button', { name: t.addTeam }).click()
  await page.getByLabel(t.form.nameLabel, { exact: true }).fill(name)
  await page.getByRole('button', { name: t.form.submitCreate }).click()
  await expect(page.getByRole('dialog').getByText(t.nameTaken)).toBeVisible()
  await expect(page.getByLabel(t.form.nameLabel, { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByRole('button', { name: messages.common.cancel }).click()

  const renamed = `${name}-ubah`
  await row.getByRole('button', { name: `${t.renameAria}: ${name}` }).click()
  await page.getByLabel(t.form.nameLabel, { exact: true }).fill(renamed)
  await page.getByRole('button', { name: t.form.submitRename }).click()
  await expect(teamItem(page, 1280, renamed)).toBeVisible()
  expect(errors).toEqual([])
})

test('add a member, set them leader: they see the assign screen', async ({
  page,
  request,
  browser,
}) => {
  const errors = collectErrors(page)
  const [team, member] = [await createE2eTeam(request), await createE2eUser(request)]
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/teams/${team.id}`)
  await expect(page.getByRole('heading', { level: 1, name: team.name })).toBeVisible()
  await expect(page.getByText(d.emptyTitle)).toBeVisible()

  await addViaUi(page, member)
  const row = memberItem(page, 1280, member.name)
  await expect(row).toBeVisible()
  await expect(row).toContainText(d.volunteerBadge)
  await row.getByRole('button', { name: `${d.makeLeaderAria}: ${member.name}` }).click()
  await expect(row).toContainText(d.leaderBadge)

  // The member's own session: first login with the default password, then a runtime-only one.
  const other = await freshPage(browser)
  await loginAndChange(other, member)
  const nav = other.getByRole('navigation', { name: messages.nav.label }).first()
  await nav.getByRole('link', { name: messages.nav.assign }).click()
  await expect(other).toHaveURL(/\/assign/)
  await expect(other.getByRole('heading', { level: 1, name: messages.assign.title })).toBeVisible()
  await other.context().close()

  // Unsetting the flag works too.
  await row.getByRole('button', { name: `${d.unmakeLeaderAria}: ${member.name}` }).click()
  await expect(row).toContainText(d.volunteerBadge)
  expect(errors).toEqual([])
})

test('removing a member asks first and deletes only their future assignments of that team', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page)
  const [team, kept, removed, service] = [
    await createE2eTeam(request),
    await createE2eUser(request),
    await createE2eUser(request),
    await createE2eService(request),
  ]
  await addTeamMember(request, team.id, kept.id)
  await addTeamMember(request, team.id, removed.id)
  await assignUsers(request, service.id, team.id, [kept.id, removed.id])

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/teams/${team.id}`)
  const row = memberItem(page, 1280, removed.name)
  await row.getByRole('button', { name: `${d.removeAria}: ${removed.name}` }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(
    fillMessage(t.confirmRemove.title, { name: removed.name, team: team.name }),
  )
  await expect(confirm).toContainText(
    fillMessage(t.confirmRemove.description, { name: removed.name, team: team.name }),
  )
  await confirm.getByRole('button', { name: messages.common.cancel }).click()
  expect(await assignedUserIds(request, service.id)).toContain(removed.id) // Cancel changed nothing

  await row.getByRole('button', { name: `${d.removeAria}: ${removed.name}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: t.confirmRemove.action }).click()
  await expect(row).toHaveCount(0)
  await expect(
    page.getByText(
      fillMessage(t.toast.memberRemovedWithAssignments, { name: removed.name, count: 1 }),
    ),
  ).toBeVisible()
  const assigned = await assignedUserIds(request, service.id)
  expect(assigned).not.toContain(removed.id)
  expect(assigned).toContain(kept.id)
  expect(errors).toEqual([])
})

test('adding an inactive user shows an Indonesian error', async ({ page, request }) => {
  const errors = collectErrors(page)
  const [team, inactive] = [await createE2eTeam(request), await createE2eUser(request)]
  await deactivateUser(request, inactive.id)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/teams/${team.id}`)
  await addViaUi(page, inactive)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(t.errors.inactiveUser)).toBeVisible()
  await expect(dialog.getByText(d.inactiveBadge, { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

// Logs in through the UI, so it must not start with the admin session.
plain('a non-admin sees no teams link and a no-access page', async ({ page, request }) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await loginAndChange(page, await createE2eUser(request, 'PEMBINA'))
  const nav = page.getByRole('navigation', { name: messages.nav.label }).first()
  await expect(nav.getByRole('link', { name: messages.nav.teams })).toHaveCount(0)
  await page.goto('/teams')
  await expect(page.getByText(t.noAccessTitle)).toBeVisible()
  expect(errors).toEqual([])
})

for (const width of widths) {
  test(`teams screens at ${width}px: no horizontal scroll, axe clean, no console errors`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000)
    const errors = collectErrors(page)
    const [team, lead, volunteer] = [
      await createE2eTeam(request),
      await createE2eUser(request),
      await createE2eUser(request),
    ]
    await addTeamMember(request, team.id, lead.id, true)
    await addTeamMember(request, team.id, volunteer.id)
    await seedSession(page, await adminToken(request))
    await page.setViewportSize({ width, height: 800 })

    await page.goto('/teams')
    await expect(teamItem(page, width, team.name)).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    await page.screenshot({ path: `.screens/f9-list-${width}.png` })

    await page.getByRole('button', { name: t.addTeam }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: t.form.submitCreate }).click() // shows the error state
    await expect(page.getByText(t.validation.nameRequired)).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="dialog"]')).toEqual([])
    if (width < 1024) {
      const box = await page.getByLabel(t.form.nameLabel, { exact: true }).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: `.screens/f9-form-errors-${width}.png` })
    await page.getByRole('button', { name: messages.common.cancel }).click()

    // Open the team from the list, as a person would.
    await teamItem(page, width, team.name)
      .getByRole('link', { name: `${t.openAria}: ${team.name}` })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: team.name })).toBeVisible()
    await expect(memberItem(page, width, volunteer.name)).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    if (width < 1024) {
      const buttons = memberItem(page, width, volunteer.name).getByRole('button')
      for (let i = 0; i < (await buttons.count()); i++) {
        expect((await buttons.nth(i).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      }
      expect(
        (await page.getByRole('button', { name: d.addMember }).first().boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: `.screens/f9-detail-${width}.png` })

    await page.getByRole('button', { name: d.addMember }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('list', { name: t.picker.listLabel })).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="dialog"]')).toEqual([])
    if (width < 1024) {
      const row = dialog
        .getByRole('list', { name: t.picker.listLabel })
        .getByRole('listitem')
        .first()
      expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: `.screens/f9-add-${width}.png` })
    await page.keyboard.press('Escape')

    await memberItem(page, width, volunteer.name)
      .getByRole('button', { name: `${d.removeAria}: ${volunteer.name}` })
      .click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="alertdialog"]')).toEqual([])
    await page.screenshot({ path: `.screens/f9-remove-${width}.png` })
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: messages.common.cancel })
      .click()
    expect(errors).toEqual([])
  })
}
