import { describe, expect, it } from 'vitest'
import { mapEmbedUrl, mapOpenUrl } from './maps'

const BASE = 'https://www.google.com/maps'

describe('maps urls', () => {
  it('encodes the query and only the embed url asks for output=embed', () => {
    const query = 'Jalan A & B #1'
    const embed = new URL(mapEmbedUrl(BASE, query))
    const open = new URL(mapOpenUrl(BASE, query))
    expect(embed.searchParams.get('q')).toBe(query)
    expect(open.searchParams.get('q')).toBe(query)
    expect(embed.searchParams.get('output')).toBe('embed')
    expect(open.searchParams.has('output')).toBe(false)
    expect(embed.hash).toBe('')
  })

  it('stays on the base origin and path', () => {
    for (const url of [mapEmbedUrl(BASE, 'x'), mapOpenUrl(BASE, 'x')]) {
      const parsed = new URL(url)
      expect(parsed.origin).toBe('https://www.google.com')
      expect(parsed.pathname).toBe('/maps')
    }
  })
})
