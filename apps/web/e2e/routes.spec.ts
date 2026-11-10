import AxeBuilder from '@axe-core/playwright'
import {
  expect as baseExpect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { messages } from '../src/lib/messages.ts'
import {
  addTeamMember,
  createE2eService,
  createE2eTeam,
  createE2eUser,
  findInList,
  loginAndChange,
  plain,
  test,
  type CreatedUser,
} from './fixtures.ts'

// Feature 10: every route, at every width, role by role. Per route and width:
// zero console errors, no horizontal scroll, no clipped or overflowing content, axe with no
// serious or critical violations, touch targets of 44px below 1024px, and a screenshot.
const expect = baseExpect.configure({ timeout: 20_000 })
test.describe.configure({ timeout: 120_000 })
plain.describe.configure({ timeout: 180_000 })

const widths = [360, 390, 768, 1280]

interface Target {
  name: string
  path: string
  heading: string
  /** The no-access state is an h2 (ErrorState); every real page has an h1. */
  level?: 1 | 2
}

/** Console errors. Only a resource-load 403 or 404 on a no-access check is tolerated (D-049). */
function collectErrors(page: Page, tolerate: RegExp[] = []): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !tolerate.some((re) => re.test(msg.text()))) {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

async function seriousViolations(page: Page): Promise<string[]> {
  // Contrast is measured on the colors on screen, so let animations finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

/** Elements whose box leaves the viewport, or whose text is cut off by overflow:hidden. */
function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > root.clientWidth) problems.push('horizontal page scroll')
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`
    // Wide tables sit in their own horizontal scroller by design.
    const inScroller = (el: Element) =>
      !!el.closest('[data-slot="table-container"], .overflow-x-auto')
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0 || el.closest('.sr-only')) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (el.closest('[aria-hidden="true"]') || el.closest('[data-state="closed"]')) continue
      if (!inScroller(el) && (box.right > root.clientWidth + 1 || box.left < -1)) {
        problems.push(`outside viewport: ${describe(el)}`)
      }
      const clips =
        ['hidden', 'clip'].includes(style.overflowX) || style.textOverflow === 'ellipsis'
      if (clips && el.children.length === 0 && (el.textContent ?? '').trim()) {
        if (el.scrollWidth > el.clientWidth + 1) problems.push(`text cut off: ${describe(el)}`)
      }
    }
    return problems
  })
}

/** Interactive controls below 1024px are at least 44px tall (their label counts for checkboxes). */
function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = []
    const selector =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="combobox"], [role="switch"], [role="checkbox"], [role="tab"]'
    for (const el of document.querySelectorAll(selector)) {
      if (el.closest('.sr-only') || el.closest('[aria-hidden="true"]')) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      // A control that fills a bigger tappable label (checkbox rows, switches) counts as that label.
      const target = el.closest('label') ?? el
      const box = target.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      // Skip links that sit inside a sentence: they are text, not buttons.
      if (el.tagName === 'A' && el.closest('p') && !el.closest('li')) continue
      if (box.height < 43.5) {
        small.push(
          `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)}" ${Math.round(box.height)}px`,
        )
      }
    }
    return small
  })
}

async function audit(page: Page, target: Target, width: number, errors: string[]): Promise<void> {
  const label = `${target.name} at ${width}px`
  await page.setViewportSize({ width, height: 800 })
  await page.goto(target.path)
  await expect(
    page.getByRole('heading', { level: target.level ?? 1, name: target.heading }),
  ).toBeVisible()
  // Let skeletons resolve: none left on the page.
  await expect(page.getByRole('main').locator('[data-slot="skeleton"]')).toHaveCount(0)
  await page.screenshot({ path: `.screens/f10-${target.name}-${width}.png`, fullPage: true })
  expect(await layoutProblems(page), `layout, ${label}`).toEqual([])
  if (width < 1024) expect(await smallTargets(page), `touch targets, ${label}`).toEqual([])
  expect(await seriousViolations(page), `axe, ${label}`).toEqual([])
  expect(errors, `console, ${label}`).toEqual([])
}

const s = messages.schedule

for (const width of widths) {
  test(`admin: every admin route at ${width}px`, async ({ page, request }) => {
    const errors = collectErrors(page)
    const team = await createE2eTeam(request)
    const targets: Target[] = [
      { name: 'home', path: './', heading: messages.placeholder.title },
      { name: 'my-schedule', path: 'my-schedule', heading: s.myTitle },
      { name: 'schedule', path: 'schedule', heading: s.fullTitle },
      { name: 'services', path: 'services', heading: messages.services.title },
      { name: 'users', path: 'users', heading: messages.users.title },
      { name: 'teams', path: 'teams', heading: messages.teams.title },
      { name: 'prayer-requests', path: 'prayer-requests', heading: messages.submissions.prayer.title },
      {
        name: 'volunteer-applications',
        path: 'volunteer-applications',
        heading: messages.submissions.volunteer.title,
      },
      { name: 'team-detail', path: `teams/${team.id}`, heading: team.name },
      { name: 'not-found', path: 'tidak-ada', heading: messages.notFound.title },
      {
        name: 'assign-no-access',
        path: 'assign',
        heading: messages.assign.noAccessTitle,
        level: 2,
      },
    ]
    for (const target of targets) await audit(page, target, width, errors)
  })
}

async function memberContext(browser: Browser, user: CreatedUser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAndChange(page, user)
  return { context, page }
}

test('leader: the assign screen at every width', async ({ browser, request }) => {
  const [service, team, leader] = await Promise.all([
    createE2eService(request),
    createE2eTeam(request),
    createE2eUser(request),
  ])
  await addTeamMember(request, team.id, leader.id, true)
  const { context, page } = await memberContext(browser, leader)
  const errors = collectErrors(page)
  const target: Target = {
    name: 'assign',
    path: `assign?service=${service.id}&team=${team.id}`,
    heading: messages.assign.title,
  }
  for (const width of widths) await audit(page, target, width, errors)
  await context.close()
})

for (const width of widths) {
  test(`member: no-access pages for admin-only routes at ${width}px`, async ({
    browser,
    request,
  }) => {
    const member = await createE2eUser(request)
    const { context, page } = await memberContext(browser, member)
    // The pages decide from GET /me, so no 403 is expected; only a load error of that kind is tolerated.
    const errors = collectErrors(page, [/status of (403|404)/])
    const targets: Target[] = [
      {
        name: 'member-services',
        path: 'services',
        heading: messages.services.noAccessTitle,
        level: 2,
      },
      { name: 'member-users', path: 'users', heading: messages.users.noAccessTitle, level: 2 },
      { name: 'member-teams', path: 'teams', heading: messages.teams.noAccessTitle, level: 2 },
      { name: 'member-assign', path: 'assign', heading: messages.assign.noAccessTitle, level: 2 },
      { name: 'member-my-schedule', path: 'my-schedule', heading: s.myTitle },
    ]
    for (const target of targets) await audit(page, target, width, errors)
    await context.close()
  })
}

async function guestAudit(context: BrowserContext, page: Page, target: Target, errors: string[]) {
  for (const width of widths) await audit(page, target, width, errors)
  await context.close()
}

plain('login page at every width', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = collectErrors(page)
  await guestAudit(
    context,
    page,
    { name: 'login', path: 'login', heading: messages.auth.loginTitle },
    errors,
  )
})

// Interaction checks ported from the removed /design page (feature 2), now on real routes.
const sv = messages.services

for (const width of widths) {
  test.describe(`interaction checks at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('shell: sidebar from 1024px, menu sheet below', async ({ page }) => {
      await page.goto('my-schedule')
      const sidebar = page.getByRole('complementary')
      const menuButton = page.getByRole('button', { name: messages.nav.openMenu })
      if (width >= 1024) {
        await expect(sidebar).toBeVisible()
        await expect(menuButton).toBeHidden()
        await expect(sidebar.getByRole('link', { name: messages.nav.home })).toBeVisible()
      } else {
        await expect(sidebar).toBeHidden()
        await expect(menuButton).toBeVisible()
        await menuButton.click()
        const sheet = page.getByRole('dialog', { name: messages.nav.menuTitle })
        await expect(sheet).toBeVisible()
        await page.waitForTimeout(400)
        expect(await seriousViolations(page)).toEqual([])
        await page.keyboard.press('Escape')
        await expect(sheet).toBeHidden()
        await expect(menuButton).toBeFocused()
        await menuButton.click()
        await sheet.getByRole('link', { name: new RegExp(messages.nav.home) }).click()
        await expect(sheet).toBeHidden()
        await expect(page).toHaveURL(/\/volunteer-portal\/$/)
      }
    })

    test('confirm dialog fits the screen, is keyboard operable, axe clean, then a polite toast', async ({
      page,
      request,
    }) => {
      const service = await createE2eService(request)
      await page.goto('services')
      const trigger = await findInList(
        page,
        page.getByRole('button', { name: `${sv.deleteAria}: ${service.title}` }),
        { list: page.getByTestId(width >= 768 ? 'services-table' : 'services-cards') },
      )
      await trigger.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('alertdialog', { name: sv.confirmDelete.title })
      await expect(dialog).toBeVisible()
      await page.waitForTimeout(300)
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(800)
      const results = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze()
      expect(
        results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
      ).toEqual([])
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()
      // Confirm path: the toast is announced politely.
      await trigger.click()
      await dialog.getByRole('button', { name: sv.confirmDelete.action }).click()
      await expect(dialog).toBeHidden()
      await expect(page.getByText(sv.toast.deleted)).toBeVisible()
      await expect(page.locator('section[aria-live="polite"]')).toHaveCount(1)
    })

    test('the service form is single column below 768px', async ({ page }) => {
      await page.goto('services')
      await page.getByRole('button', { name: sv.add }).click()
      const a = await page.getByRole('button', { name: sv.form.startDate }).boundingBox()
      const b = await page.getByLabel(sv.form.startTime).boundingBox()
      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      if (width < 768) expect(Math.abs(a!.x - b!.x)).toBeLessThan(2)
      else expect(b!.x).toBeGreaterThan(a!.x + 50)
    })
  })
}

test('focus ring is visible on keyboard focus', async ({ page }) => {
  await page.goto('my-schedule')
  await expect(page.getByRole('main')).toBeVisible()
  await page.keyboard.press('Tab') // skip link
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement!)
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow }
  })
  expect(outline.style !== 'none' || outline.shadow !== 'none').toBe(true)
})

test('prefers-reduced-motion disables transitions and animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  const duration = await page
    .getByRole('link', { name: messages.nav.mySchedule, exact: true })
    .last()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return Math.max(parseFloat(s.transitionDuration), parseFloat(s.animationDuration))
    })
  expect(duration).toBeLessThan(0.01)
})

test('hover state changes a button background', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('./')
  const b = page.getByRole('link', { name: messages.nav.fullSchedule, exact: true }).last()
  const before = await b.evaluate((el) => getComputedStyle(el).backgroundColor)
  await b.hover()
  await page.waitForTimeout(300)
  const after = await b.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(after).not.toBe(before)
})
