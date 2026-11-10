import { http, HttpResponse } from 'msw'
import type { EventItem } from '@/api/types'

// Response examples copied from docs/api/public.md.
export const bidangExample = [
  { id: 'a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb', name: 'Multimedia' },
  { id: 'aba2c1ed-b318-467b-8388-e97b051dec22', name: 'Music' },
]

// Shape copied from docs/api/events.md. The dates are far in the future relative to the fixed
// clocks the tests use, and the tests that care install their own list.
export const eventsExample: EventItem[] = [
  {
    id: '6f1c2b9e-0c58-4a8e-9d3f-2f7a1c0b5e11',
    title: 'Youth Night',
    startsAt: '2031-05-01T10:00:00.000Z',
    location: 'Lokasi akan diisi',
    description: 'Deskripsi akan diisi.',
  },
]

export const handlers = {
  events: (list: EventItem[] = eventsExample) =>
    http.get('*/api/public/events', () => HttpResponse.json(list)),
  bidang: () => http.get('*/api/public/bidang', () => HttpResponse.json(bidangExample)),
  prayerCreated: () =>
    http.post('*/api/public/prayer-requests', () =>
      HttpResponse.json({ ok: true }, { status: 201 }),
    ),
  volunteerCreated: () =>
    http.post('*/api/public/volunteer-applications', () =>
      HttpResponse.json({ ok: true }, { status: 201 }),
    ),
}
