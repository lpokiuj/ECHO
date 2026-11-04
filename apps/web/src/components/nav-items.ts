import {
  ClipboardCheckIcon,
  HomeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  SettingsIcon,
  UserCheckIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import type { MeResponse } from '@/api/types'
import { messages } from '@/lib/messages'

export interface NavItem {
  id: string
  to: string
  label: string
  icon: LucideIcon
  /** False until the feature that builds the route lands (DECISIONS D-012). */
  routeExists: boolean
}

/** Every item the user is meant to have, from GET /me. Hiding is UX only; the backend decides. */
export function buildNavItems(me: MeResponse): NavItem[] {
  const items: NavItem[] = [
    { id: 'home', to: '/', label: messages.nav.home, icon: HomeIcon, routeExists: true },
    {
      id: 'mySchedule',
      to: '/my-schedule',
      label: messages.nav.mySchedule,
      icon: CalendarIcon,
      routeExists: true,
    },
    {
      id: 'fullSchedule',
      to: '/schedule',
      label: messages.nav.fullSchedule,
      icon: CalendarDaysIcon,
      routeExists: true,
    },
  ]
  items.push({
    id: 'attendance',
    to: '/attendance',
    label: messages.nav.attendance,
    icon: UserCheckIcon,
    routeExists: true,
  })
  if (me.memberships.some((m) => m.isLeader)) {
    items.push({
      id: 'assign',
      to: '/assign',
      label: messages.nav.assign,
      icon: ClipboardCheckIcon,
      routeExists: true,
    })
  }
  if (me.role === 'ADMIN' || me.role === 'PEMBINA') {
    items.push({
      id: 'services',
      to: '/services',
      label: messages.nav.services,
      icon: SettingsIcon,
      routeExists: true,
    })
  }
  if (me.role === 'ADMIN') {
    items.push(
      {
        id: 'users',
        to: '/users',
        label: messages.nav.users,
        icon: UserCogIcon,
        routeExists: true,
      },
      { id: 'teams', to: '/teams', label: messages.nav.teams, icon: UsersIcon, routeExists: true },
    )
  }
  return items
}

/** The subset whose routes exist today. */
export function visibleNavItems(me: MeResponse): NavItem[] {
  return buildNavItems(me).filter((item) => item.routeExists)
}
