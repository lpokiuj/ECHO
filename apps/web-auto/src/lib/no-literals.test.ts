import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// PLAN feature 10: no user-facing text literals outside src/lib/messages.ts.
const ROOT = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    const isSource = /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
    const exempt =
      path.endsWith(join('lib', 'messages.ts')) ||
      path.includes(join('src', 'test')) ||
      path.includes(join('src', 'api', 'types'))
    return isSource && !exempt ? [path] : []
  })
}

// JSX text between tags. Text with code punctuation is a TypeScript generic or an arrow, not copy.
const TEXT_NODE = />\s*([^<>{}\n()=&|?;]*[A-Za-z]{2,}[^<>{}\n()=&|?;]*)\s*</g
const TEXT_ATTR =
  /\b(?:aria-label|aria-description|placeholder|title|alt|label)="([^"{]*[A-Za-z]{2,}[^"]*)"/g
const TOAST_OR_ERROR = /\btoast(?:\.\w+)?\(\s*['"`]([^'"`]*[A-Za-z]{3,}[^'"`]*)['"`]/g

describe('user-facing text lives in messages.ts', () => {
  it('has no text literals in components or hooks', () => {
    const hits: string[] = []
    for (const file of sourceFiles(ROOT)) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const rel = relative(ROOT, file)
      const patterns = file.endsWith('.tsx')
        ? [TEXT_NODE, TEXT_ATTR, TOAST_OR_ERROR]
        : [TOAST_OR_ERROR]
      for (const pattern of patterns) {
        for (const m of code.matchAll(pattern)) {
          const text = (m[1] ?? '').trim()
          if (text && !/^(?:return|if|const|let|export)\b/.test(text)) hits.push(`${rel}: ${text}`)
        }
      }
    }
    expect(hits).toEqual([])
  })
})
