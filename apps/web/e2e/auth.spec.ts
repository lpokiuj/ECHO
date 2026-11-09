import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import { adminToken, createE2eUser, plain as test, randomSuffix, seedSession } from './fixtures.ts'
const widths = [360, 390, 768, 1280]
const t = messages.auth

function collectErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignore.some((r) => r.test(msg.text()))) errors.push(msg.text())
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

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel(t.emailLabel).fill(email)
  await page.getByLabel(t.passwordLabel).fill(password)
  await page.getByRole('button', { name: t.loginSubmit }).click()
}

test('wrong credentials show one generic message and stay on login', async ({ page }) => {
  const errors = collectErrors(page, [/status of 401/])
  await page.goto('login')
  await submitLogin(page, `e2e-${randomSuffix()}@echo.local`, 'salah-salah-123')
  await expect(page.getByText(t.loginFailed)).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  expect(errors).toEqual([])
})

test('an unauthenticated visit to a protected route goes to login', async ({ page }) => {
  await page.goto('my-schedule')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { level: 1, name: t.loginTitle })).toBeVisible()
})

test('admin-created user logs in and lands home with no forced change', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page, [/status of 401/])
  const user = await createE2eUser(request)
  await page.setViewportSize({ width: 1280, height: 800 })

  await page.goto('login')
  await submitLogin(page, user.email, user.password)
  await expect(page).toHaveURL(/\/volunteer-portal\/$/)
  await expect(page.getByRole('navigation', { name: messages.nav.label }).first()).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: messages.placeholder.title }),
  ).toBeVisible()
  await expect(page.getByRole('main').getByText(user.name)).toBeVisible()

  // The session survives a reload, then logout and a new login with the new password.
  await page.reload()
  await expect(page.getByRole('main').getByText(user.name)).toBeVisible()
  const menu = page.getByRole('button', { name: new RegExp(t.accountMenu) }).first()
  await menu.click()
  await page.getByRole('menuitem', { name: t.logout }).click()
  await expect(page).toHaveURL(/\/login$/)
  await submitLogin(page, user.email, user.password)
  await expect(page).toHaveURL(/\/volunteer-portal\/$/)
  await expect(page.getByRole('main').getByText(user.name)).toBeVisible()
  expect(errors).toEqual([])
})

test('admin sees the role badge and the nav for routes that exist', async ({ page }) => {
  await seedSession(page, await adminToken())
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: messages.nav.label }).first()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(nav.getByRole('link', { name: messages.nav.home })).toBeVisible()
  await page
    .getByRole('button', { name: new RegExp(t.accountMenu) })
    .first()
    .click()
  await expect(page.getByText(messages.roles.ADMIN).first()).toBeVisible()
})

test('deep link survives a hard refresh under /volunteer-portal/ and never hits the old path', async ({
  page,
}) => {
  const paths: string[] = []
  page.on('request', (r) => paths.push(new URL(r.url()).pathname))
  await seedSession(page, await adminToken())
  await page.goto('teams')
  await expect(page.getByRole('heading', { level: 1, name: messages.teams.title })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: messages.teams.title })).toBeVisible()
  await expect(page).toHaveURL(/\/volunteer-portal\/teams$/)
  // The home URL keeps its trailing slash, so a hard refresh there is served too.
  await page.goto('./')
  await page.reload()
  await expect(page).toHaveURL(/\/volunteer-portal\/$/)
  await expect(
    page.getByRole('heading', { level: 1, name: messages.placeholder.title }),
  ).toBeVisible()
  expect(paths.length).toBeGreaterThan(0)
  expect(paths.filter((p) => p.startsWith('/volunteer/'))).toEqual([])
  expect(
    paths.filter((p) => !p.startsWith('/api/') && !p.startsWith('/volunteer-portal/')),
  ).toEqual([])
})

for (const width of widths) {
  test(`login and home at ${width}px: no overflow, axe clean, no console errors`, async ({
    page,
    request,
  }) => {
    const errors = collectErrors(page)
    const user = await createE2eUser(request)
    await page.setViewportSize({ width, height: 800 })

    await page.goto('login')
    await expect(page.getByRole('heading', { level: 1, name: t.loginTitle })).toBeVisible()
    await page.screenshot({ path: `.screens/f4-login-${width}.png`, fullPage: true })
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])

    // Empty submit shows field errors (client validation only, no request).
    await page.getByRole('button', { name: t.loginSubmit }).click()
    await expect(page.getByText(t.required).first()).toBeVisible()
    await page.screenshot({ path: `.screens/f4-login-errors-${width}.png`, fullPage: true })
    expect(await seriousViolations(page)).toEqual([])

    if (width < 1024) {
      for (const el of [
        page.getByLabel(t.emailLabel),
        page.getByLabel(t.passwordLabel),
        page.getByRole('button', { name: t.loginSubmit }),
      ]) {
        expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
    }

    await submitLogin(page, user.email, user.password)
    await expect(
      page.getByRole('heading', { level: 1, name: messages.placeholder.title }),
    ).toBeVisible()
    await expect(page.getByRole('main').getByText(user.name)).toBeVisible()
    await page.screenshot({ path: `.screens/f4-home-${width}.png`, fullPage: true })
    expect(await hasHorizontalScroll(page)).toBe(false)
    expect(await seriousViolations(page)).toEqual([])

    await page
      .getByRole('button', { name: new RegExp(t.accountMenu) })
      .first()
      .click()
    await expect(page.getByRole('menuitem', { name: t.logout })).toBeVisible()
    await page.waitForTimeout(300) // let the open animation settle for the screenshot
    await page.screenshot({ path: `.screens/f4-usermenu-${width}.png` })
    // axe is skipped while the Radix menu is open (aria-hidden-focus false positive, D-007).
    if (width < 1024) {
      // offsetHeight ignores the open animation's scale transform.
      const height = await page
        .getByRole('menuitem', { name: t.logout })
        .evaluate((el) => (el as HTMLElement).offsetHeight)
      expect(height).toBeGreaterThanOrEqual(44)
    }
    expect(errors).toEqual([])
  })
}
