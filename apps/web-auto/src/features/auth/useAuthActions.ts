import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { changePassword, getMe, login } from '@/api/client'
import { logout, setToken } from '@/api/session'
import type { ChangePasswordRequest, LoginRequest } from '@/api/types'
import { PATHS } from '@/routes/paths'
import { ME_KEY } from './useMe'

export function useLogin() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (body: LoginRequest) => {
      const { accessToken } = await login(body)
      setToken(accessToken)
      queryClient.clear()
      return queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: getMe, staleTime: 0 })
    },
    onSuccess: (me) => {
      void navigate(me.mustChangePassword ? PATHS.changePassword : PATHS.home, { replace: true })
    },
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (body: ChangePasswordRequest) => {
      await changePassword(body)
      return queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: getMe, staleTime: 0 })
    },
    onSuccess: () => {
      void navigate(PATHS.home, { replace: true })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return () => {
    logout()
    queryClient.clear()
    void navigate(PATHS.login, { replace: true })
  }
}
