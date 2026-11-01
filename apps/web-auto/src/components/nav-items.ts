import { HomeIcon, PaletteIcon, type LucideIcon } from 'lucide-react'
import { messages } from '@/lib/messages'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Dev-only entries are removed in feature 10 (DECISIONS D-003). */
  devOnly?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: messages.nav.home, icon: HomeIcon },
  { to: '/design', label: messages.nav.design, icon: PaletteIcon, devOnly: true },
]
