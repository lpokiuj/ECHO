import AxeBuilder from '@axe-core/playwright'
import { expect as baseExpect, type Browser, type Page } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import {
  adminToken,
  createE2eUser,
  expectNotInList,
  findInList,
  listUsers,
  loginAndChange,
  loginAttemptStatus,
  pembinaToken,
  plain,
  randomSuffix,
  requireEnv,
  seedSession,
  test,
  type CreatedUser,
} from './fixtures.ts'

// The list holds every leftover e2e- user (hundreds), so a dev-mode render is slow, especially
// with parallel workers: wait longer than the default 5s and allow longer tests (see D-032).
const expect = baseExpect.configure({ timeout: 20_000 })
test.describe.configure({ timeout: 90_000 })

const t = messages.users
const f = t.form
const widths = [360, 390, 768, 1280]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    // The browser logs the duplicate-email 409 this spec provokes on purpose.
    if (msg.type() === 'error' && !/status of 409/.test(msg.text())) errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

/** `scope` limits axe to one dialog; without it the whole page, every row, is scanned (D-038 resolved). */
async function seriousViolations(page: Page, scope?: string) {
  // Contrast is measured on the colors on screen, so wait for the dialog's open animation to end.
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

/** The visible item for a user: a table row from 768px, a card below. The unique e2e- name finds it. */
function itemFor(page: Page, width: number, name: string) {
  return width >= 768
    ? page.getByTestId('users-table').getByRole('row').filter({ hasText: name })
    : page.getByTestId('users-cards').getByRole('listitem').filter({ hasText: name })
}

function listFor(page: Page, width: number) {
  return page.getByTestId(width >= 768 ? 'users-table' : 'users-cards')
}

async function chooseRole(page: Page, label: string) {
  await page.getByRole('combobox', { name: f.roleLabel }).click()
  await page.getByRole('option', { name: label }).click()
}

async function createViaUi(page: Page, name: string, email: string, roleLabel?: string) {
  await page.getByRole('button', { name: t.add }).click()
  await page.getByLabel(f.nameLabel).fill(name)
  await page.getByLabel(f.emailLabel).fill(email)
  if (roleLabel) await chooseRole(page, roleLabel)
  await page.getByRole('button', { name: f.submitCreate }).click()
}

/** A logged-out browser context: the new user's own session, not the admin's. */
async function freshPage(browser: Browser, width = 1280): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 800 } })
  return context.newPage()
}

const loginStatus = (page: Page, email: string, password: string) =>
  loginAttemptStatus(page.request, email, password)

test('admin creates a user; that user logs in and changes the password', async ({
  page,
  browser,
}) => {
  const errors = collectErrors(page)
  const suffix = randomSuffix()
  const user: CreatedUser = {
    id: '',
    name: `e2e-${suffix}`,
    email: `e2e-${suffix}@echo.local`,
    password: requireEnv('E2E_USER_PASSWORD'),
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('users')
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible()

  await createViaUi(page, user.name, user.email)
  const row = await findInList(page, itemFor(page, 1280, user.name), { list: listFor(page, 1280) })
  // The list refetches after the create; with hundreds of leftover users and parallel workers
  // that can take much longer than the default (see D-032).
  await expect(row).toBeVisible()
  await expect(row).toContainText(messages.roles.MEMBER)
  await expect(row).toContainText(t.active)

  // Duplicate email is shown inline on the email field, and the dialog stays open.
  await createViaUi(page, `${user.name}-dua`, user.email)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(t.emailTaken)).toBeVisible()
  await expect(page.getByLabel(f.emailLabel)).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: messages.common.cancel }).click()

  // The new user logs in with the default password and must change it (new one stays in memory).
  const other = await freshPage(browser)
  await loginAndChange(other, user)
  await other.context().close()
  expect(errors).toEqual([])
})

test('admin edits name and role, then deactivates after a confirmation', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page)
  const user = await createE2eUser(request)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('users')

  const renamed = `${user.name}-ubah`
  await (
    await findInList(page, itemFor(page, 1280, user.name), { list: listFor(page, 1280) })
  )
    .getByRole('button', { name: `${t.editAria}: ${user.name}` })
    .click()
  await page.getByLabel(f.nameLabel).fill(renamed)
  await chooseRole(page, messages.roles.PEMBINA)
  await page.getByRole('button', { name: f.submitEdit }).click()
  const row = await findInList(page, itemFor(page, 1280, renamed), { list: listFor(page, 1280) })
  await expect(row).toContainText(messages.roles.PEMBINA)

  await row.getByRole('button', { name: `${t.editAria}: ${renamed}` }).click()
  await page.getByRole('switch', { name: f.activeLabel }).click()
  await page.getByRole('button', { name: f.submitEdit }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(renamed)
  await confirm.getByRole('button', { name: t.confirmDeactivate.action }).click()
  await expect(
    await findInList(page, itemFor(page, 1280, renamed), { list: listFor(page, 1280) }),
  ).toContainText(t.inactive)
  // A deactivated user cannot log in any more (status only, never the body).
  expect(await loginStatus(page, user.email, user.password)).toBe(401)
  expect(errors).toEqual([])
})

test('admin deletes a user after confirming; cancelling deletes nothing', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page)
  const user = await createE2eUser(request)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('users')
  const list = listFor(page, 1280)
  const deleteName = `${t.deleteAria}: ${user.name}`

  // Cancel: the dialog names the user, says it is permanent, and nothing is deleted.
  const row = await findInList(page, itemFor(page, 1280, user.name), { list })
  await row.getByRole('button', { name: deleteName }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(user.name)
  await expect(confirm).toContainText(t.confirmDelete.description)
  await confirm.getByRole('button', { name: messages.common.cancel }).click()
  await expect(confirm).toHaveCount(0)
  expect((await listUsers(request)).some((u) => u.id === user.id)).toBe(true)
  await expect(row).toBeVisible()

  // Confirm: the user is gone from the list, after a reload too, and cannot log in.
  await row.getByRole('button', { name: deleteName }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: t.confirmDelete.action }).click()
  await expect(page.getByText(t.toast.deleted)).toBeVisible()
  await expectNotInList(page, itemFor(page, 1280, user.name), { list })
  await page.reload()
  await expectNotInList(page, itemFor(page, 1280, user.name), { list })
  expect((await listUsers(request)).some((u) => u.id === user.id)).toBe(false)
  expect(await loginStatus(page, user.email, user.password)).toBe(401)
  expect(errors).toEqual([])
})

test('the admin has no delete button on their own row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('users')
  const row = await findInList(page, itemFor(page, 1280, requireEnv('E2E_ADMIN_EMAIL')), {
    list: listFor(page, 1280),
  })
  await expect(row).toContainText(t.you)
  await expect(row.getByRole('button', { name: new RegExp(`^${t.deleteAria}`) })).toHaveCount(0)
})

test('reset password asks first; the user logs in with the default password', async ({
  page,
  request,
  browser,
}) => {
  const errors = collectErrors(page)
  const user = await createE2eUser(request)
  const first = await freshPage(browser)
  await loginAndChange(first, user) // a first login, so the account has been used before the reset
  await first.context().close()

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('users')
  const row = await findInList(page, itemFor(page, 1280, user.name), { list: listFor(page, 1280) })
  await row.getByRole('button', { name: `${t.resetAria}: ${user.name}` }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(user.name)
  await confirm.getByRole('button', { name: messages.common.cancel }).click()
  await expect(confirm).toHaveCount(0)
  await row.getByRole('button', { name: `${t.resetAria}: ${user.name}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: t.confirmReset.action }).click()
  await expect(page.getByText(t.toast.reset)).toBeVisible()

  // Back to the default password: logging in with it lands home (no forced change).
  const second = await freshPage(browser)
  await second.goto('login')
  await second.getByLabel(messages.auth.emailLabel).fill(user.email)
  await second.getByLabel(messages.auth.passwordLabel).fill(user.password)
  await second.getByRole('button', { name: messages.auth.loginSubmit }).click()
  await expect(second).toHaveURL(/\/volunteer-portal\/$/)
  await second.context().close()
  expect(errors).toEqual([])
})

test('the admin cannot change their own role or active flag', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('users')
  const row = await findInList(page, itemFor(page, 1280, requireEnv('E2E_ADMIN_EMAIL')), {
    list: listFor(page, 1280),
  })
  await expect(row).toContainText(t.you)
  await row.getByRole('button', { name: new RegExp(`^${t.editAria}`) }).click()
  await expect(page.getByRole('combobox', { name: f.roleLabel })).toBeDisabled()
  await expect(page.getByRole('switch', { name: f.activeLabel })).toBeDisabled()
  await expect(page.getByText(f.selfHint)).toBeVisible()
  await page.getByRole('button', { name: messages.common.cancel }).click() // nothing is saved
})

// Uses the shared PEMBINA session, so it must not start with the admin session.
plain('a non-admin sees no users link and a no-access page', async ({ page }) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await seedSession(page, pembinaToken())
  await page.goto('./')
  await expect(
    page.getByRole('heading', { level: 1, name: messages.placeholder.title }),
  ).toBeVisible()
  const nav = page.getByRole('navigation', { name: messages.nav.label }).first()
  await expect(nav.getByRole('link', { name: messages.nav.users })).toHaveCount(0)
  await page.goto('users')
  await expect(page.getByText(t.noAccessTitle)).toBeVisible()
  expect(errors).toEqual([])
})

for (const width of widths) {
  test(`users screens at ${width}px: no horizontal scroll, axe clean, no console errors`, async ({
    page,
    request,
  }) => {
    // Several axe runs over a list that grows with every leftover e2e- user.
    test.setTimeout(180_000)
    const errors = collectErrors(page)
    const user = await createE2eUser(request)
    await seedSession(page, await adminToken())
    await page.setViewportSize({ width, height: 800 })
    await page.goto('users')
    await expect(
      await findInList(page, itemFor(page, width, user.name), { list: listFor(page, width) }),
    ).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])
    await page.screenshot({ path: `.screens/f8-list-${width}.png` })

    await page.getByRole('button', { name: t.add }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: f.submitCreate }).click() // shows every error state
    await expect(page.getByText(t.validation.nameRequired)).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="dialog"]')).toEqual([])
    await page.screenshot({ path: `.screens/f8-form-errors-${width}.png` })
    await page.getByRole('button', { name: messages.common.cancel }).click()

    await (
      await findInList(page, itemFor(page, width, user.name), { list: listFor(page, width) })
    )
      .getByRole('button', { name: `${t.editAria}: ${user.name}` })
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: `.screens/f8-form-edit-${width}.png` })
    if (width < 1024) {
      for (const box of [
        await page.getByLabel(f.nameLabel).boundingBox(),
        await page.getByLabel(f.emailLabel).boundingBox(),
        await page.getByRole('combobox', { name: f.roleLabel }).boundingBox(),
        await page.getByRole('switch', { name: f.activeLabel }).locator('xpath=..').boundingBox(),
      ])
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    expect(await seriousViolations(page, '[role="dialog"]')).toEqual([])
    // Deactivate confirmation, inside the form dialog.
    await page.getByRole('switch', { name: f.activeLabel }).click()
    await page.getByRole('button', { name: f.submitEdit }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="alertdialog"]')).toEqual([])
    await page.screenshot({ path: `.screens/f8-deactivate-${width}.png` })
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: messages.common.cancel })
      .click()
    await page.getByRole('button', { name: messages.common.cancel }).click()

    await (
      await findInList(page, itemFor(page, width, user.name), { list: listFor(page, width) })
    )
      .getByRole('button', { name: `${t.resetAria}: ${user.name}` })
      .click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="alertdialog"]')).toEqual([])
    await page.screenshot({ path: `.screens/f8-reset-${width}.png` })
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: messages.common.cancel })
      .click()

    await (
      await findInList(page, itemFor(page, width, user.name), { list: listFor(page, width) })
    )
      .getByRole('button', { name: `${t.deleteAria}: ${user.name}` })
      .click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page, '[role="alertdialog"]')).toEqual([])
    await page.screenshot({ path: `.screens/f8-delete-${width}.png` })
    expect(errors).toEqual([])
  })
}
