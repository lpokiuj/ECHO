import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/setup'
import { ERROR_BODIES, respond } from '@/test/handlers'
import { messages } from '@/lib/messages'
import { getMe } from './client'
import { errorMessage } from './errors'

async function failWith(status: number, body: unknown): Promise<unknown> {
  server.use(http.get('*/api/me', () => respond(status, body)))
  return getMe().then(
    () => {
      throw new Error('expected failure')
    },
    (e: unknown) => e,
  )
}

describe('error normalization', () => {
  it.each([
    [400, ERROR_BODIES.validationString, 'validation', messages.errors.validation],
    [403, ERROR_BODIES.forbidden, 'forbidden', messages.errors.forbidden],
    [404, ERROR_BODIES.notFound, 'notFound', messages.errors.notFound],
    [409, ERROR_BODIES.conflict, 'conflict', messages.errors.conflict],
    [500, { statusCode: 500, message: 'Internal server error' }, 'server', messages.errors.server],
  ])('maps %i to Indonesian by status', async (status, body, kind, text) => {
    const error = await failWith(status, body)
    expect(error).toMatchObject({ status, kind })
    expect(errorMessage(error)).toBe(text)
  })

  it('maps a network failure', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.error()))
    const error = await getMe().catch((e: unknown) => e)
    expect(error).toMatchObject({ kind: 'network' })
    expect(errorMessage(error)).toBe(messages.errors.network)
  })

  it('maps known codes by code before status', async () => {
    const error = await failWith(409, ERROR_BODIES.serviceStarted)
    expect(errorMessage(error)).toBe(messages.errors.codes.SERVICE_ALREADY_STARTED)
  })

  it('names fields from validation arrays without showing backend text', async () => {
    const error = await failWith(400, ERROR_BODIES.validationArray)
    expect(error).toMatchObject({
      fieldErrors: {
        email: messages.errors.fields.email,
        password: messages.errors.fields.tooShort,
      },
    })
  })

  it('shows the generic message for an unknown code and never the backend text', async () => {
    const backendText = 'Totally unknown backend sentence'
    const error = await failWith(418, { statusCode: 418, code: 'WEIRD_CODE', message: backendText })
    expect(errorMessage(error)).toBe(messages.states.genericError)
    for (const status of [400, 403, 404, 409, 500]) {
      const e = await failWith(status, {
        statusCode: status,
        code: 'WEIRD_CODE',
        message: backendText,
      })
      expect(errorMessage(e)).not.toContain(backendText)
      expect(JSON.stringify(e)).not.toContain(backendText)
      expect((e as Error).message).not.toContain(backendText)
    }
  })

  it('falls back to generic for non-ApiError values', () => {
    expect(errorMessage(new Error('boom'))).toBe(messages.states.genericError)
  })
})
