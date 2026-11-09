import type { Page } from '@playwright/test'

/** E2E never loads Google: every request to the Maps embed gets a tiny local document. */
export async function mockGoogleMaps(page: Page): Promise<void> {
  await page.route('https://www.google.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html lang="id"><head><title>peta</title></head><body><p>peta</p></body></html>',
    }),
  )
}
