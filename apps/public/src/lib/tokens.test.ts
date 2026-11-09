import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

const css = readFileSync('src/index.css', 'utf8')
const SOURCE_DIRS = ['src/components', 'src/pages', 'src/features']

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!m) throw new Error(`token --${name} missing or not a 6-digit hex`)
  return m[1]!
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('design tokens', () => {
  it('has no hex colors or raw color functions in components, pages or features', () => {
    const offenders: string[] = []
    for (const dir of SOURCE_DIRS) {
      for (const f of files(dir)) {
        if (!/\.(ts|tsx|css)$/.test(f)) continue
        const text = readFileSync(f, 'utf8')
        if (/#[0-9a-fA-F]{3,8}\b/.test(text) || /\b(rgb|rgba|hsl|hsla|oklch)\(/.test(text)) {
          offenders.push(f)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('has no arbitrary pixel sizes in components, pages or features', () => {
    const offenders: string[] = []
    for (const dir of SOURCE_DIRS) {
      for (const f of files(dir)) {
        if (!/\.tsx$/.test(f)) continue
        if (/\[\d+(\.\d+)?px\]/.test(readFileSync(f, 'utf8'))) offenders.push(f)
      }
    }
    expect(offenders).toEqual([])
  })

  it.each([
    ['foreground', 'background'],
    ['card-foreground', 'card'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['muted-foreground', 'muted'],
    ['muted-foreground', 'background'],
    ['accent-foreground', 'accent'],
    ['secondary-foreground', 'primary-soft'],
    ['primary-foreground', 'secondary-foreground'],
  ])('keeps %s on %s at 4.5:1 or better', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5)
  })
})
