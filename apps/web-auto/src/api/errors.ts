import { messages } from '@/lib/messages'
import type { ApiErrorBody, ErrorCode } from './types'

export type ErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'wrongCurrentPassword'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'server'
  | 'network'
  | 'unknown'

const KNOWN_CODES: readonly ErrorCode[] = [
  'PASSWORD_CHANGE_REQUIRED',
  'INVALID_USERS',
  'SERVICE_ALREADY_STARTED',
]

/** Thrown by the API client. It carries no backend message text. */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ErrorKind
  readonly code?: ErrorCode
  readonly fieldErrors: Record<string, string>
  readonly invalidUserIds: string[]

  constructor(init: {
    status: number
    kind: ErrorKind
    code?: ErrorCode
    fieldErrors?: Record<string, string>
    invalidUserIds?: string[]
  }) {
    super(`API error ${init.status}`)
    this.name = 'ApiError'
    this.status = init.status
    this.kind = init.kind
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.invalidUserIds = init.invalidUserIds ?? []
  }
}

export function kindForStatus(status: number): ErrorKind {
  if (status === 400) return 'validation'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notFound'
  if (status === 409) return 'conflict'
  if (status >= 500) return 'server'
  return 'unknown'
}

function asKnownCode(code: unknown): ErrorCode | undefined {
  return KNOWN_CODES.find((known) => known === code)
}

// Field validation messages look like "newPassword must be longer than or equal to 8 characters".
// Only the field name and the rule are read, to pick an Indonesian text. The text itself is dropped.
const RULES: { test: RegExp; text: string }[] = [
  { test: /must be shorter than or equal to/, text: messages.errors.fields.tooLong },
  { test: /must be after/, text: messages.errors.fields.endBeforeStart },
  { test: /must be in the future/, text: messages.errors.fields.startNotFuture },
  { test: /timezone offset|valid ISO 8601/, text: messages.errors.fields.invalidDate },
  { test: /must be an email/, text: messages.errors.fields.email },
  { test: /must be longer than or equal to/, text: messages.errors.fields.tooShort },
  { test: /should not be empty|must be a string/, text: messages.errors.fields.required },
]

function fieldErrorsFrom(message: unknown): Record<string, string> {
  const list = Array.isArray(message) ? message : typeof message === 'string' ? [message] : []
  const result: Record<string, string> = {}
  for (const item of list) {
    if (typeof item !== 'string') continue
    const match = /^([A-Za-z][A-Za-z0-9]*) (.+)$/.exec(item)
    if (!match) continue
    const rule = RULES.find((r) => r.test.test(match[2]))
    if (rule && !(match[1] in result)) result[match[1]] = rule.text
  }
  return result
}

export function fromResponse(status: number, body: unknown): ApiError {
  const parsed: ApiErrorBody = body && typeof body === 'object' ? (body as ApiErrorBody) : {}
  const code = asKnownCode(parsed.code)
  const invalid = Array.isArray(parsed.invalidUserIds)
    ? parsed.invalidUserIds.filter((id): id is string => typeof id === 'string')
    : undefined
  return new ApiError({
    status,
    kind: kindForStatus(status),
    code,
    fieldErrors: status === 400 ? fieldErrorsFrom(parsed.message) : undefined,
    invalidUserIds: invalid,
  })
}

export function networkError(): ApiError {
  return new ApiError({ status: 0, kind: 'network' })
}

export function normalizeError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError({ status: 0, kind: 'unknown' })
}

/** Indonesian text for any error: code first, then kind, then the generic message. */
export function errorMessage(error: unknown): string {
  const e = normalizeError(error)
  if (e.code) return messages.errors.codes[e.code]
  switch (e.kind) {
    case 'validation':
      return messages.errors.validation
    case 'unauthorized':
      return messages.errors.unauthorized
    case 'wrongCurrentPassword':
      return messages.errors.wrongCurrentPassword
    case 'forbidden':
      return messages.errors.forbidden
    case 'notFound':
      return messages.errors.notFound
    case 'conflict':
      return messages.errors.conflict
    case 'server':
      return messages.errors.server
    case 'network':
      return messages.errors.network
    default:
      return messages.states.genericError
  }
}
