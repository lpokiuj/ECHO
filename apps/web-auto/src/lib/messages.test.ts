import { describe, expect, it } from 'vitest'
import { messages } from './messages'

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

describe('messages', () => {
  it('has no empty strings', () => {
    expect(strings(messages).filter((s) => s.trim() === '')).toEqual([])
  })

  it('uses the organisation terms for roles', () => {
    expect(messages.roles).toEqual({ ADMIN: 'Admin', PEMBINA: 'Pembina', MEMBER: 'Relawan' })
  })
})
