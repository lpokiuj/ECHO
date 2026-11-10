import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { handlers, bidangExample, eventsExample } from '@/test/handlers'
import { server } from '@/test/setup'
import { site } from '@/content/site'
import { getBidang, getEvents, submitPrayerRequest, submitVolunteerApplication } from './client'
import { ApiError, errorMessage } from './errors'

describe('getBidang', () => {
  it('returns the list from the docs example, without any Authorization header', async () => {
    let auth: string | null = 'unset'
    let cookies: string | null = 'unset'
    server.use(
      http.get('*/api/public/bidang', ({ request }) => {
        auth = request.headers.get('Authorization')
        cookies = request.headers.get('Cookie')
        return HttpResponse.json(bidangExample)
      }),
    )
    expect(await getBidang()).toEqual(bidangExample)
    expect(auth).toBeNull()
    expect(cookies).toBeNull()
  })
})

describe('getEvents (client)', () => {
  it('returns the list, with no Authorization header and no cookies', async () => {
    let auth: string | null = 'unset'
    let cookies: string | null = 'unset'
    server.use(
      http.get('*/api/public/events', ({ request }) => {
        auth = request.headers.get('Authorization')
        cookies = request.headers.get('Cookie')
        return HttpResponse.json(eventsExample)
      }),
    )
    expect(await getEvents()).toEqual(eventsExample)
    expect(auth).toBeNull()
    expect(cookies).toBeNull()
  })

  it('throws an ApiError on 500 and on a network failure', async () => {
    server.use(http.get('*/api/public/events', () => HttpResponse.json({}, { status: 500 })))
    await expect(getEvents()).rejects.toBeInstanceOf(ApiError)
    server.use(http.get('*/api/public/events', () => HttpResponse.error()))
    await expect(getEvents()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('submissions', () => {
  it('posts a prayer request as JSON and resolves with {ok:true}', async () => {
    let body: unknown
    let auth: string | null = 'unset'
    server.use(
      http.post('*/api/public/prayer-requests', async ({ request }) => {
        body = await request.json()
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true }, { status: 201 })
      }),
    )
    const result = await submitPrayerRequest({
      name: 'e2e-test',
      content: 'Doa contoh',
      consent: true,
    })
    expect(result).toEqual({ ok: true })
    expect(body).toEqual({ name: 'e2e-test', content: 'Doa contoh', consent: true })
    expect(auth).toBeNull()
  })

  it('posts a volunteer application', async () => {
    server.use(handlers.volunteerCreated())
    const result = await submitVolunteerApplication({
      fullName: 'e2e-test',
      whatsapp: '000',
      consent: true,
      bidangIds: [bidangExample[0]!.id],
    })
    expect(result).toEqual({ ok: true })
  })

  it('maps a 400 to a validation error and keeps the raw text out of the visible message', async () => {
    server.use(
      http.post('*/api/public/prayer-requests', () =>
        HttpResponse.json(
          { message: ['consent must be true'], error: 'Bad Request', statusCode: 400 },
          { status: 400 },
        ),
      ),
    )
    const error = await submitPrayerRequest({ content: 'x', consent: false }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.kind).toBe('validation')
    expect(error.details).toEqual(['consent must be true'])
    expect(errorMessage(error)).toBe(site.errors.validation)
    expect(errorMessage(error)).not.toContain('consent must be true')
  })

  it('maps a 429 to rateLimited and reads Retry-After', async () => {
    server.use(
      http.post('*/api/public/volunteer-applications', () =>
        HttpResponse.json(
          { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    )
    const error = await submitVolunteerApplication({
      fullName: 'e2e-test',
      whatsapp: '000',
      consent: true,
    }).catch((e) => e)
    expect(error.kind).toBe('rateLimited')
    expect(error.retryAfterSeconds).toBe(120)
    expect(errorMessage(error)).toBe(site.errors.rateLimited)
  })

  it('maps a 500 to a server error and a dropped connection to a network error', async () => {
    server.use(http.get('*/api/public/bidang', () => new HttpResponse(null, { status: 500 })))
    const serverError = await getBidang().catch((e) => e)
    expect(serverError.kind).toBe('server')

    server.use(http.get('*/api/public/bidang', () => HttpResponse.error()))
    const networkError = await getBidang().catch((e) => e)
    expect(networkError.kind).toBe('network')
    expect(errorMessage(networkError)).toBe(site.errors.network)
  })
})
