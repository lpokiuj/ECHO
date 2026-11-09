// Static events (placeholders). Read ONLY through getEvents() in src/lib/events.ts, so the data can
// later move to an API without touching components. `startsAt` is ISO 8601 with an explicit offset.
export interface EventItem {
  id: string
  title: string
  startsAt: string
  location: string
  description: string
}

export const events: EventItem[] = [
  {
    id: 'kegiatan-1',
    title: 'Kegiatan contoh 1 (contoh)',
    startsAt: '2030-01-05T10:00:00+07:00',
    location: 'Lokasi akan diisi',
    description: 'Deskripsi kegiatan akan diisi.',
  },
  {
    id: 'kegiatan-2',
    title: 'Kegiatan contoh 2 (contoh)',
    startsAt: '2030-02-09T16:00:00+07:00',
    location: 'Lokasi akan diisi',
    description: 'Deskripsi kegiatan akan diisi.',
  },
  {
    id: 'kegiatan-3',
    title: 'Kegiatan contoh 3 (contoh)',
    startsAt: '2030-03-16T18:30:00+07:00',
    location: 'Lokasi akan diisi',
    description: 'Deskripsi kegiatan akan diisi.',
  },
]
