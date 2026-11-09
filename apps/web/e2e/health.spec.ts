import { expect, test } from '@playwright/test'

// Needs the backend running; no login and no credentials.
test('dev proxy reaches the backend /health with 200', async ({ request, baseURL }) => {
  const response = await request.get(new URL('/api/health', baseURL).href)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
