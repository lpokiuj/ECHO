import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { queryClient } from '@/api/queryClient'
import { logout } from '@/api/session'
import { afterAll, afterEach, beforeAll } from 'vitest'

// Handlers are added per test from real examples in ../../docs/api/. None yet.
export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  logout()
  queryClient.clear()
  server.resetHandlers()
})
afterAll(() => server.close())
