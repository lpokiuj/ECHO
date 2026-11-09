import { expect, test as base, type Page, type Route } from '@playwright/test'

// Rate-limit guard for POST /public/volunteer-applications (5 per 10 minutes per IP, in memory,
// every request counts). Same pattern as prayer-mocks.ts: `guardVolunteerPosts` installs a DEFAULT
// route that aborts the request and records it as `unexpected`; a test must opt in explicitly with
// `mock(...)` (no backend call) or `real()` (the one real POST of a run). The `volunteer` fixture is
// automatic and fails any test that let a request reach the default route.
const ENDPOINT = '**/api/public/volunteer-applications'
const BIDANG = '**/api/public/bidang'

export type VolunteerMock =
  | { status: 201 }
  | { status: 400 }
  | { status: 429; retryAfter?: number }
  | { status: 500 }
  | { abort: true }

export interface VolunteerGuard {
  /** Every POST the page sent to the endpoint, with its parsed JSON body. */
  sent: Record<string, unknown>[]
  /** POSTs that hit the default route (nobody opted in). Must stay empty. */
  unexpected: string[]
  /** Answers every POST with a canned response (docs/api/public.md examples). Never reaches the backend. */
  mock: (response: VolunteerMock) => Promise<void>
  /** Holds each request in flight until `hold` resolves, then answers 201. Never reaches the backend. */
  mockHeld: (hold: Promise<void>) => Promise<void>
  /** Lets POSTs through to the real backend. Only the single "[real]" test calls this. */
  real: () => Promise<void>
}

function body(route: Route): Record<string, unknown> {
  try {
    return (route.request().postDataJSON() ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

function fulfill(route: Route, response: VolunteerMock) {
  if ('abort' in response) return route.abort('failed')
  if (response.status === 201) return route.fulfill({ status: 201, json: { ok: true } })
  if (response.status === 400) {
    return route.fulfill({
      status: 400,
      json: { message: ['consent must be true'], error: 'Bad Request', statusCode: 400 },
    })
  }
  if (response.status === 429) {
    return route.fulfill({
      status: 429,
      headers: { 'Retry-After': String(response.retryAfter ?? 60) },
      json: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
    })
  }
  return route.fulfill({ status: 500, json: { statusCode: 500 } })
}

export async function guardVolunteerPosts(page: Page): Promise<VolunteerGuard> {
  const guard: VolunteerGuard = {
    sent: [],
    unexpected: [],
    mock: async (response) => {
      await page.route(ENDPOINT, (route) => {
        guard.sent.push(body(route))
        return fulfill(route, response)
      })
    },
    mockHeld: async (hold) => {
      await page.route(ENDPOINT, async (route) => {
        guard.sent.push(body(route))
        await hold
        await fulfill(route, { status: 201 })
      })
    },
    real: async () => {
      await page.route(ENDPOINT, (route) => {
        guard.sent.push(body(route))
        return route.continue()
      })
    },
  }
  // Registered first, so every later page.route (mock/real) takes precedence over it.
  await page.route(ENDPOINT, (route) => {
    guard.unexpected.push(route.request().method())
    guard.sent.push(body(route))
    return route.abort('failed')
  })
  return guard
}

export const bidangFixture = [
  { id: 'a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb', name: 'Multimedia' },
  { id: 'aba2c1ed-b318-467b-8388-e97b051dec22', name: 'Music' },
]

/** Stubs GET /public/bidang (not rate limited; the stub only keeps the data deterministic). */
export async function mockBidang(
  page: Page,
  mode: 'ok' | 'empty' | 'fail' | 'abort' | { hold: Promise<void> },
) {
  await page.route(BIDANG, async (route) => {
    if (mode === 'abort') return route.abort('failed')
    if (mode === 'fail') return route.fulfill({ status: 500, json: { statusCode: 500 } })
    if (mode === 'empty') return route.fulfill({ status: 200, json: [] })
    if (typeof mode === 'object') await mode.hold
    return route.fulfill({ status: 200, json: bidangFixture })
  })
}

export const test = base.extend<{ volunteer: VolunteerGuard }>({
  volunteer: [
    async ({ page }, use) => {
      const guard = await guardVolunteerPosts(page)
      await use(guard)
      expect(guard.unexpected, 'a request reached the default volunteer route').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
