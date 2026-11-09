import { expect, test } from '@playwright/test'
import { site } from '../src/content/site.ts'

const acaraLabel = site.nav.items.find((i) => i.id === 'acara')!.label

test.describe('smoke at 360px', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('loads home and navigates through the mobile burger menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    await expect(page.getByRole('heading', { level: 1, name: site.hero.title })).toBeVisible()
    // The desktop nav is hidden below lg; the burger is the way in.
    await expect(page.getByRole('navigation', { name: site.a11y.mainNav })).toBeHidden()

    await page.getByRole('button', { name: site.a11y.openMenu }).click()
    const dialog = page.getByRole('dialog', { name: site.a11y.menuTitle })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('link', { name: 'Doa' }).click()
    await expect(page).toHaveURL(/\/doa$/)
    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole('heading', { level: 1, name: site.pages.prayer.title }),
    ).toBeVisible()

    await page.getByRole('button', { name: site.a11y.openMenu }).click()
    await page
      .getByRole('dialog', { name: site.a11y.menuTitle })
      .getByRole('link', { name: site.nav.cta.label })
      .click()
    await expect(page).toHaveURL(/\/relawan$/)
    await expect(
      page.getByRole('heading', { level: 1, name: site.pages.volunteer.title }),
    ).toBeVisible()
  })

  test('a section link in the burger menu scrolls to its section', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: site.a11y.openMenu }).click()
    await page
      .getByRole('dialog', { name: site.a11y.menuTitle })
      .getByRole('link', { name: acaraLabel })
      .click()
    await expect(page).toHaveURL(/\/#acara$/)
    await expect(
      page.getByRole('heading', { level: 2, name: site.sections.events.title }),
    ).toBeInViewport()
  })
})

test('the footer link points at the portal', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: site.footer.portalLinkLabel })
  await expect(link).toBeVisible()
  // VITE_PORTAL_URL: the dev default is the portal's dev URL; unset it is the same-origin path.
  await expect(link).toHaveAttribute('href', /\/volunteer-portal\/$/)
})
