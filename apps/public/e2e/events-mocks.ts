import type { Page, Route } from '@playwright/test'

// Mocks for GET /api/public/events. Dates are relative to the real clock (never fixed years).
export interface MockEvent {
  id: string
  title: string
  startsAt: string
  location: string
  description: string
}

const DAY = 24 * 60 * 60 * 1000

export function mockEvent(id: string, offsetDays: number): MockEvent {
  return {
    id,
    title: `Acara ${id}`,
    startsAt: new Date(Date.now() + offsetDays * DAY).toISOString(),
    location: 'Lokasi akan diisi',
    description: 'Deskripsi akan diisi.',
  }
}

/** Answers GET /public/events with `status` and `body`. Returns a function to change the answer. */
export async function mockEvents(page: Page, status: number, body: unknown) {
  let current = { status, body }
  await page.route('**/api/public/events', (route: Route) =>
    route.fulfill({
      status: current.status,
      contentType: 'application/json',
      body: JSON.stringify(current.body),
    }),
  )
  return (nextStatus: number, nextBody: unknown) => {
    current = { status: nextStatus, body: nextBody }
  }
}
