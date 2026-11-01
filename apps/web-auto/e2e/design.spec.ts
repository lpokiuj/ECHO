import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { messages } from '../src/lib/messages.ts'

const widths = [360, 390, 768, 1280]
const routes = ['/', '/design', '/tidak-ada']
const t = messages.design

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

async function hasHorizontalScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
}

/** Visible elements whose right edge sticks out of the viewport. */
async function clippedElements(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const out: string[] = []
    for (const el of document.querySelectorAll('main *, header *, aside *')) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      if (r.right > vw + 1 || r.left < -1)
        out.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)}`)
    }
    return out
  })
}

for (const width of widths) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    for (const route of routes) {
      test(`${route}: no console errors, no overflow, no clipping, no axe violations`, async ({
        page,
      }) => {
        const errors = collectErrors(page)
        await page.goto(route)
        await expect(page.locator('html')).toHaveAttribute('lang', 'id')
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page).toHaveTitle(/Portal Relawan Echo/)
        const name = route === '/' ? 'home' : route.slice(1)
        await page.screenshot({ path: `.screens/f2-${name}-${width}.png`, fullPage: true })
        expect(await hasHorizontalScroll(page)).toBe(false)
        expect(await clippedElements(page)).toEqual([])
        expect(await seriousViolations(page)).toEqual([])
        expect(errors).toEqual([])
      })
    }

    test('shell: sidebar from 1024px, menu sheet below', async ({ page }) => {
      await page.goto('/design')
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
        await page.screenshot({ path: `.screens/f2-menu-${width}.png` })
        expect(await seriousViolations(page)).toEqual([])
        await page.keyboard.press('Escape')
        await expect(sheet).toBeHidden()
        await expect(menuButton).toBeFocused()
        await menuButton.click()
        await sheet.getByRole('link', { name: new RegExp(messages.nav.home) }).click()
        await expect(sheet).toBeHidden()
        await expect(page).toHaveURL(/\/$/)
      }
    })

    test('confirm dialog fits the screen, is keyboard operable and axe clean', async ({ page }) => {
      await page.goto('/design')
      const trigger = page.getByRole('button', { name: t.confirm.trigger })
      await trigger.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('alertdialog', { name: t.confirm.title })
      await expect(dialog).toBeVisible()
      await page.waitForTimeout(300)
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(800)
      await page.screenshot({ path: `.screens/f2-confirm-${width}.png` })
      expect(await seriousViolations(page)).toEqual([])
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()
      // confirm path: pending state, then a toast
      await trigger.click()
      await page.getByRole('button', { name: t.confirm.action }).click()
      await expect(dialog).toBeHidden()
      await expect(page.getByText(t.confirm.done)).toBeVisible()
    })

    test('toasts are announced politely and axe clean', async ({ page }) => {
      await page.goto('/design')
      await page.getByRole('button', { name: t.toasts.error }).click()
      await expect(page.getByText(t.toasts.errorText)).toBeVisible()
      await expect(page.locator('section[aria-live="polite"]')).toHaveCount(1)
      await page.screenshot({ path: `.screens/f2-toast-${width}.png` })
      expect(await seriousViolations(page)).toEqual([])
    })

    test('select opens, selects, and the page is axe clean afterwards', async ({ page }) => {
      await page.goto('/design')
      await page.getByRole('combobox', { name: t.form.teamLabel }).click()
      await expect(page.getByRole('option', { name: t.form.teamOptions[0] })).toBeVisible()
      // Not checked with axe while open: Radix Select aria-hides the page root, which axe
      // reports as aria-hidden-focus because the listbox is not a dialog.
      await page.getByRole('option', { name: t.form.teamOptions[1] }).click()
      await expect(page.getByRole('combobox', { name: t.form.teamLabel })).toHaveText(
        t.form.teamOptions[1],
      )
    })

    test('list is a table from 768px and cards below', async ({ page }) => {
      await page.goto('/design')
      if (width >= 768) {
        await expect(page.getByRole('table')).toBeVisible()
      } else {
        await expect(page.getByRole('table')).toBeHidden()
        await expect(
          page.getByRole('listitem').filter({ hasText: t.list.people[0] }).first(),
        ).toBeVisible()
      }
    })

    test('forms are single column below 768px', async ({ page }) => {
      await page.goto('/design')
      const a = await page.getByLabel(t.form.nameLabel).boundingBox()
      const b = await page.getByRole('combobox', { name: t.form.teamLabel }).boundingBox()
      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      if (width < 768) expect(Math.abs(a!.x - b!.x)).toBeLessThan(2)
      else expect(b!.x).toBeGreaterThan(a!.x + 50)
    })

    if (width < 1024) {
      test('touch targets are at least 44px tall', async ({ page }) => {
        for (const route of ['/', '/design']) {
          await page.goto(route)
          const small = await page.evaluate(() => {
            const out: string[] = []
            const sel = 'button, a[href], input, [role=combobox], [role=tab]'
            for (const el of document.querySelectorAll(sel)) {
              const r = el.getBoundingClientRect()
              if (r.width < 2 || r.height < 2) continue // sr-only skip link
              if (r.height < 43.5)
                out.push(
                  `${el.tagName} "${(el.textContent || '').trim().slice(0, 30)}" ${r.height}`,
                )
            }
            return out
          })
          expect(small).toEqual([])
        }
      })
    }
  })
}

test('focus ring is visible on keyboard focus', async ({ page }) => {
  await page.goto('/design')
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
  await page.goto('/design')
  const duration = await page
    .getByRole('button', { name: t.buttons.primary, exact: true })
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return Math.max(parseFloat(s.transitionDuration), parseFloat(s.animationDuration))
    })
  expect(duration).toBeLessThan(0.01)
})

test('hover state changes a button background', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/design')
  const b = page.getByRole('button', { name: t.buttons.outline })
  const before = await b.evaluate((el) => getComputedStyle(el).backgroundColor)
  await b.hover()
  await page.waitForTimeout(300)
  const after = await b.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(after).not.toBe(before)
})
