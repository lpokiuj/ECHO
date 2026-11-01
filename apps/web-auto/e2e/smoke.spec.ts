import { expect, test } from './fixtures.ts'
import { messages } from '../src/lib/messages.ts'

test('placeholder page renders in Indonesian', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { name: messages.placeholder.title })).toBeVisible()
})
