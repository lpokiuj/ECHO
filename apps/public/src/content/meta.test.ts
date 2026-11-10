import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { site } from './site'

// index.html is static (crawlers without JS read it), so it cannot import from site.ts. This test
// keeps its title and meta tags identical to `site.meta` and `site.brand`.
const html = readFileSync('index.html', 'utf8')

function tag(attr: 'name' | 'property', key: string): string | undefined {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`)
  return html.match(re)?.[1]
}

describe('index.html meta tags', () => {
  it('has the fallback title equal to the home title', () => {
    expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe(site.brand.name)
  })

  it('mirrors site.meta', () => {
    expect(tag('name', 'description')).toBe(site.meta.description)
    expect(tag('name', 'theme-color')).toBe(site.meta.themeColor)
    expect(tag('property', 'og:description')).toBe(site.meta.description)
    expect(tag('property', 'og:title')).toBe(site.brand.name)
    expect(tag('property', 'og:site_name')).toBe(site.brand.name)
    expect(tag('property', 'og:locale')).toBe(site.meta.locale)
    expect(tag('property', 'og:type')).toBe('website')
    expect(tag('property', 'og:image')).toBe(site.meta.ogImage)
    expect(tag('property', 'og:image:alt')).toBe(site.meta.ogImageAlt)
    expect(tag('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('points og:image at a placeholder asset in public/ and loads nothing external', () => {
    expect(existsSync(`public${site.meta.ogImage}`)).toBe(true)
    expect(html).not.toMatch(/https?:\/\//i)
  })
})
