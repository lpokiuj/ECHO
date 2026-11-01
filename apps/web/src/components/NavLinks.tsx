import { NavLink } from 'react-router'
import type { NavItem } from '@/components/nav-items'
import { cn } from '@/lib/utils'
import { messages } from '@/lib/messages'

interface NavLinksProps {
  items: NavItem[]
  onNavigate?: () => void
}

export function NavLinks({ items, onNavigate }: NavLinksProps) {
  return (
    <nav aria-label={messages.nav.label}>
      <ul className="flex flex-col gap-1">
        {items.map(({ id, to, label, icon: Icon }) => (
          <li key={id}>
            <NavLink
              to={to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-sidebar-foreground',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
