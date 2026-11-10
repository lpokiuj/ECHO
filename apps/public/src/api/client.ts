// The only place that touches the network. No auth: no token, no cookies, no storage.
// Dev proxy: /api -> backend (prefix stripped).
import { fromResponse, networkError } from './errors'
import type { Bidang, EventItem, PrayerRequestBody, SubmissionResult, VolunteerApplicationBody } from './types'

const BASE_URL = '/api'

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'omit',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError()
  }

  if (response.ok) return (await readBody(response)) as T
  throw fromResponse(response, await readBody(response))
}

/** GET /public/bidang: the teams a volunteer can pick, ordered by name. */
export function getBidang(signal?: AbortSignal): Promise<Bidang[]> {
  return request<Bidang[]>('/public/bidang', { signal })
}

/** GET /public/events: upcoming events only, `startsAt` ascending. */
export function getEvents(signal?: AbortSignal): Promise<EventItem[]> {
  return request<EventItem[]>('/public/events', { signal })
}

/** POST /public/prayer-requests. 5 per 10 minutes per IP; a 429 becomes a `rateLimited` error. */
export function submitPrayerRequest(body: PrayerRequestBody): Promise<SubmissionResult> {
  return request<SubmissionResult>('/public/prayer-requests', { method: 'POST', body })
}

/** POST /public/volunteer-applications. Same rate limit as the prayer endpoint (counted apart). */
export function submitVolunteerApplication(
  body: VolunteerApplicationBody,
): Promise<SubmissionResult> {
  return request<SubmissionResult>('/public/volunteer-applications', { method: 'POST', body })
}
