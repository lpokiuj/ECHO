import { http, HttpResponse } from 'msw'

// Response examples copied from docs/api/public.md.
export const bidangExample = [
  { id: 'a3ff8b91-dc3a-4175-af7b-1ac7c5b58bdb', name: 'Multimedia' },
  { id: 'aba2c1ed-b318-467b-8388-e97b051dec22', name: 'Music' },
]

export const handlers = {
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
