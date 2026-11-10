import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { queryClient } from '@/api/queryClient'
import { logout } from '@/api/session'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { handlers } from './handlers'

// Handlers are added per test from real examples in ../../docs/api/. None yet.
export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
// The nav badge of ADMIN and PEMBINA reads the counts; tests override this per case.
beforeEach(() => server.use(handlers.counts()))
afterEach(() => {
  cleanup()
  logout()
  queryClient.clear()
  server.resetHandlers()
})
afterAll(() => server.close())
