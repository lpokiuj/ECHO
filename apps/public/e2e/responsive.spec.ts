import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { site } from '../src/content/site.ts'
import { mockGoogleMaps } from './maps-mock.ts'

const pages = [
  { name: 'home', path: '/', heading: site.hero.title },
  { name: 'doa', path: '/doa', heading: site.pages.prayer.title },
  { name: 'relawan', path: '/relawan', heading: site.pages.volunteer.title },
  { name: '404', path: '/tidak-ada', heading: site.pages.notFound.title },
]

for (const width of [360, 768, 1280]) {
  for (const { name, path, heading } of pages) {
    test(`${name} at ${width}px: no console errors, no overflow, no axe violations`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      page.on('pageerror', (err) => errors.push(err.message))

      await mockGoogleMaps(page)
      await page.setViewportSize({ width, height: 800 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      if (path === '/') {
        await expect(page.getByRole('heading', { name: /Kegiatan contoh 1/ })).toBeVisible()
        await expect(
          page.getByRole('heading', { level: 2, name: site.sections.worship.title }),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { level: 2, name: site.sections.location.title }),
        ).toBeVisible()
        await expect(page.getByTitle(site.sections.location.map.title)).toBeAttached()
        if (width < 1024) {
          const heroRegion = page.getByRole('region', { name: site.hero.title })
          for (const cta of [site.hero.primaryCta, site.hero.secondaryCta]) {
            const box = await heroRegion.getByRole('link', { name: cta.label }).boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
          }
        }
      }
      await page.screenshot({ path: `.screens/${name}-${width}.png`, fullPage: true })

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(overflow).toBe(false)

      // Touch targets of at least 44px below 1024px (header controls and footer link).
      if (width < 1024) {
        const targets = [
          page.getByRole('button', { name: site.a11y.openMenu }),
          page.getByRole('link', { name: site.brand.logoLabel }),
          page.getByRole('link', { name: site.footer.portalLinkLabel }),
        ]
        for (const target of targets) {
          const box = await target.boundingBox()
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
        }
      }

      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(serious.map((v) => v.id)).toEqual([])
      expect(errors).toEqual([])
    })
  }
}
