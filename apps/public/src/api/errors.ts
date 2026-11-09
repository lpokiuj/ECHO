import { site } from '@/content/site'

export type ApiErrorKind = 'network' | 'validation' | 'rateLimited' | 'server'

/**
 * A failed API call. `details` keeps the server's raw validation text for debugging only: it is
 * never shown to visitors. Use `errorMessage` for the Indonesian text.
 */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  readonly retryAfterSeconds?: number
  readonly details: string[]

  constructor(init: {
    status: number
    kind: ApiErrorKind
    retryAfterSeconds?: number
    details?: string[]
  }) {
    super(`API error ${init.status} (${init.kind})`)
    this.name = 'ApiError'
    this.status = init.status
    this.kind = init.kind
    this.retryAfterSeconds = init.retryAfterSeconds
    this.details = init.details ?? []
  }
}

function detailsOf(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return []
  const message = (body as { message?: unknown }).message
  if (typeof message === 'string') return [message]
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === 'string')
  return []
}

export function fromResponse(response: Response, body: unknown): ApiError {
  const status = response.status
  if (status === 400) return new ApiError({ status, kind: 'validation', details: detailsOf(body) })
  if (status === 429) {
    const retry = Number(response.headers.get('Retry-After'))
    return new ApiError({
      status,
      kind: 'rateLimited',
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : undefined,
    })
  }
  return new ApiError({ status, kind: 'server' })
}

export function networkError(): ApiError {
  return new ApiError({ status: 0, kind: 'network' })
}

/** The Indonesian message for any thrown value, with a generic fallback. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return site.errors[error.kind]
  return site.errors.server
}
