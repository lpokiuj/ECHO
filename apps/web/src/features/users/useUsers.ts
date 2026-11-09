import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, deleteUser, getUsers, resetUserPassword, updateUser } from '@/api/client'
import type { CreateUserBody, UpdateUserBody, User } from '@/api/types'
import { ME_KEY } from '@/features/auth/useMe'
import { MY_SCHEDULE_KEY, SERVICES_KEY } from '@/features/schedule/useSchedule'

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
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserBody) => createUser(body),
    onSuccess: (user) => {
      // Show the new row at once; the background refetch then puts it in server order.
      client.setQueryData<User[]>(USERS_KEY, (list) => (list ? [...list, user] : list))
      refresh()
    },
  })
}

export function useUpdateUser() {
  const refresh = useRefreshUsers()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserBody }) => updateUser(id, body),
    onSuccess: (user) => {
      // Show the change at once; the background refetch confirms it.
      client.setQueryData<User[]>(USERS_KEY, (list) =>
        list?.map((u) => (u.id === user.id ? { ...u, ...user } : u)),
      )
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

/** Also removes the user's memberships and assignments, so schedules refresh too. */
export function useDeleteUser() {
  const refresh = useRefreshUsers()
  const client = useQueryClient()
  const refreshAll = () => {
    refresh()
    void client.invalidateQueries({ queryKey: SERVICES_KEY })
    void client.invalidateQueries({ queryKey: MY_SCHEDULE_KEY })
    void client.invalidateQueries({ queryKey: ['candidates'] })
  }
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: (_data, id) => {
      client.setQueryData<User[]>(USERS_KEY, (list) => list?.filter((u) => u.id !== id))
      refreshAll()
    },
    // A 404 means the user is already gone; a 409 or 400 leaves the row. The list refreshes either way.
    onError: refreshAll,
  })
}
