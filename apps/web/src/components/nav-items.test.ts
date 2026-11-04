import { describe, expect, it } from 'vitest'
import type { MeResponse } from '@/api/types'
import { ME_BY_ROLE } from '@/test/handlers'
import { buildNavItems, visibleNavItems } from './nav-items'

const asMe = (body: unknown) => body as MeResponse
const ids = (me: MeResponse) => buildNavItems(me).map((i) => i.id)

describe('buildNavItems (full intended set)', () => {
  it('MEMBER: schedules only', () => {
    expect(ids(asMe(ME_BY_ROLE.member))).toEqual([
      'home',
      'mySchedule',
      'fullSchedule',
      'attendance',
    ])
  })
  it('leader (any isLeader membership): adds assign', () => {
    expect(ids(asMe(ME_BY_ROLE.leader))).toEqual([
      'home',
      'mySchedule',
      'fullSchedule',
      'attendance',
      'assign',
    ])
  })
  it('PEMBINA: adds services, no admin items', () => {
    expect(ids(asMe(ME_BY_ROLE.pembina))).toEqual([
      'home',
      'mySchedule',
      'fullSchedule',
      'attendance',
      'services',
    ])
  })
  it('ADMIN: adds services, users and teams', () => {
    expect(ids(asMe(ME_BY_ROLE.admin))).toEqual([
      'home',
      'mySchedule',
      'fullSchedule',
      'attendance',
      'services',
      'users',
      'teams',
    ])
  })
  it('renders only items whose route exists', () => {
    expect(visibleNavItems(asMe(ME_BY_ROLE.admin)).map((i) => i.id)).toEqual([
      'home',
      'mySchedule',
      'fullSchedule',
      'attendance',
      'services',
      'users',
      'teams',
    ])
  })
})
