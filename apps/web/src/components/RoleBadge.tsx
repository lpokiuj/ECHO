import { Badge } from '@/components/ui/badge'
import { messages } from '@/lib/messages'

export type Role = keyof typeof messages.roles

const variants: Record<Role, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  PEMBINA: 'secondary',
  MEMBER: 'outline',
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={variants[role]}>{messages.roles[role]}</Badge>
}
