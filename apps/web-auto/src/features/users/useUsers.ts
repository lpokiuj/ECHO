import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, getUsers, resetUserPassword, updateUser } from '@/api/client'
import type { CreateUserBody, UpdateUserBody } from '@/api/types'
import { ME_KEY } from '@/features/auth/useMe'

export const USERS_KEY = ['users'] as const

/** GET /users: every user, inactive included, no pagination. */
export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: getUsers, retry: false })
}

/**
 * Marks the list stale and returns at once: the refetch runs in the background, so a dialog
 * closes without waiting for (and re-rendering) a long list.
 */
function useRefreshUsers() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: USERS_KEY })
  }
}

export function useCreateUser() {
  const refresh = useRefreshUsers()
  return useMutation({ mutationFn: (body: CreateUserBody) => createUser(body), onSuccess: refresh })
}

export function useUpdateUser() {
  const refresh = useRefreshUsers()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserBody }) => updateUser(id, body),
    onSuccess: (user) => {
      refresh()
      // The admin edited their own name or email: the shell reads it from GET /me.
      const me = client.getQueryData<{ id: string }>(ME_KEY)
      if (me?.id === user.id) void client.invalidateQueries({ queryKey: ME_KEY })
    },
    // A 404 means the user is gone; the list must refresh then too.
    onError: refresh,
  })
}

export function useResetPassword() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (id: string) => resetUserPassword(id),
    onSuccess: refresh,
    onError: refresh,
  })
}
