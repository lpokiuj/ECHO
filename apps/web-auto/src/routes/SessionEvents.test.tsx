import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { emit, expireSession, logout, setToken } from '@/api/session'
import { PATHS } from './paths'
import { SessionEvents } from './SessionEvents'

afterEach(() => logout())

function setup() {
  queryClient.setQueryData(['x'], 1)
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <>
          <SessionEvents />
          <p>home</p>
        </>
      ),
    },
    { path: PATHS.login, element: <p>login page</p> },
    { path: PATHS.changePassword, element: <p>change page</p> },
  ])
  render(<RouterProvider router={router} />)
}

describe('SessionEvents', () => {
  it('goes to login and clears the query cache on 401', async () => {
    setToken('fake-token-1')
    setup()
    expireSession()
    expect(await screen.findByText('login page')).toBeInTheDocument()
    expect(queryClient.getQueryData(['x'])).toBeUndefined()
  })

  it('goes to the forced change route on PASSWORD_CHANGE_REQUIRED', async () => {
    setup()
    emit({ type: 'passwordChangeRequired' })
    expect(await screen.findByText('change page')).toBeInTheDocument()
  })
})
