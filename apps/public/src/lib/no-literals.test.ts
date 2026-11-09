import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// No user-facing text literals outside src/content/. Components never hard-code copy.
const ROOT = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    const isSource = /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
    const exempt = path.includes(join('src', 'content')) || path.includes(join('src', 'test'))
    return isSource && !exempt ? [path] : []
  })
}

// JSX text between tags. Text with code punctuation is a TypeScript generic or an arrow, not copy.
const TEXT_NODE = />\s*([^<>{}\n()=&|?;]*[A-Za-z]{2,}[^<>{}\n()=&|?;]*)\s*</g
const TEXT_ATTR =
  /\b(?:aria-label|aria-description|placeholder|title|alt|label)="([^"{]*[A-Za-z]{2,}[^"]*)"/g

describe('user-facing text lives in src/content/', () => {
  it('has no text literals in components, pages or hooks', () => {
    const hits: string[] = []
    for (const file of sourceFiles(ROOT)) {
      if (!file.endsWith('.tsx')) continue
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const rel = relative(ROOT, file)
      for (const pattern of [TEXT_NODE, TEXT_ATTR]) {
        for (const m of code.matchAll(pattern)) {
          const text = (m[1] ?? '').trim()
          if (text && !/^(?:return|if|const|let|export)\b/.test(text)) hits.push(`${rel}: ${text}`)
        }
      }
    }
    expect(hits).toEqual([])
  })
})
