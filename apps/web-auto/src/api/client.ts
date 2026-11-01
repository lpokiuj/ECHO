// The only place that touches the network. Dev proxy: /api -> backend (prefix stripped).
import { ApiError, fromResponse, networkError } from './errors'
import { expireSession, emit, getToken, setToken } from './session'
import type {
  ChangePasswordRequest,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
} from './types'

const BASE_URL = '/api'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** POST /auth/change-password only: a 401 means a wrong current password, not an expired session. */
  wrongPassword401?: boolean
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError()
  }

  // Every authenticated response, including 4xx, may carry a fresh token. Absent: keep the old one.
  const fresh = response.headers.get('X-Access-Token')
  if (fresh) setToken(fresh)

  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await readBody(response)) as T
  }

  const base = fromResponse(response.status, await readBody(response))
  if (response.status === 401) {
    if (options.wrongPassword401) {
      throw new ApiError({ status: 401, kind: 'wrongCurrentPassword' })
    }
    expireSession()
  }
  if (response.status === 403 && base.code === 'PASSWORD_CHANGE_REQUIRED') {
    emit({ type: 'passwordChangeRequired' })
  }
  throw base
}

export function login(body: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', { method: 'POST', body })
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/me')
}

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return request<void>('/auth/change-password', { method: 'POST', body, wrongPassword401: true })
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}
