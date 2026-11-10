import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { handlers } from './handlers'

// Handlers are added per test from real examples in ../../docs/api/public.md.
// Default: no upcoming events, so any test that renders the home page has an answer.
export const server = setupServer(handlers.events([]))

// jsdom does not implement scrolling.
window.scrollTo = vi.fn()
Element.prototype.scrollIntoView = vi.fn()
// jsdom has no ResizeObserver (Radix's checkbox uses one in forms).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  queryClient.clear()
  server.resetHandlers()
  vi.unstubAllEnvs()
})
afterAll(() => server.close())
