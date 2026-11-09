import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures.ts'
import { messages } from '../src/lib/messages.ts'

for (const width of [390, 768, 1280]) {
  test(`placeholder at ${width}px: no console errors, no overflow, no axe violations`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    await page.setViewportSize({ width, height: 800 })
    await page.goto('./')
    await expect(page.getByRole('heading', { name: messages.placeholder.title })).toBeVisible()
    await page.screenshot({ path: `.screens/placeholder-${width}.png`, fullPage: true })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)

    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious).toEqual([])
    expect(errors).toEqual([])
  })
}
