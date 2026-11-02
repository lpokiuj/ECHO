import { LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { MeResponse } from '@/api/types'
import { RoleBadge } from '@/components/RoleBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/useAuthActions'
import { messages } from '@/lib/messages'

/** `compact` hides the name text below 640px (avatar only); the accessible name stays. */
export function UserMenu({ me, compact = false }: { me: MeResponse; compact?: boolean }) {
  const logout = useLogout()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`hover:bg-accent dark:hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground h-auto min-h-11 max-w-full cursor-pointer justify-start gap-2 rounded-md px-2 transition-colors ${compact ? '' : 'w-full'}`}
        >
          <UserAvatar name={me.name} />
          <span className={`min-w-0 truncate text-base ${compact ? 'max-sm:sr-only' : ''}`}>
            {me.name}
          </span>
          <span className="sr-only">{messages.auth.accountMenu}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[90vw]">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-foreground truncate text-base font-medium">{me.name}</span>
          <span className="text-muted-foreground truncate text-sm font-normal">{me.email}</span>
          <span>
            <RoleBadge role={me.role} />
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout()
            toast.success(messages.auth.loggedOut)
          }}
        >
          <LogOutIcon aria-hidden="true" />
          {messages.auth.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
