import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('.env.example', () => {
  it('lists every VITE_* variable the app reads, with placeholder values only', () => {
    const used = new Set<string>()
    for (const file of sourceFiles('src')) {
      if (/\.test\.tsx?$/.test(file) || file.endsWith('vite-env.d.ts')) continue
      for (const m of readFileSync(file, 'utf8').matchAll(
        /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g,
      )) {
        used.add(m[1]!)
      }
    }
    const example = readFileSync('.env.example', 'utf8')
    const listed = new Set([...example.matchAll(/^(VITE_[A-Z0-9_]+)=(.*)$/gm)].map((m) => m[1]!))
    expect([...used].sort()).toEqual([...listed].sort())
    expect(used.size).toBeGreaterThan(0)
    // No secret-looking values: only the portal path or empty.
    for (const m of example.matchAll(/^VITE_[A-Z0-9_]+=(.*)$/gm)) {
      expect(m[1]).toMatch(/^(\/[a-z-]*\/?)?$/)
    }
  })
})
