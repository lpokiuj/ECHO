import { CalendarIcon, ClockIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatTimeRange } from '@/lib/dates'

interface ListCardProps {
  /** Heading or identity block. */
  title: ReactNode
  /** Badges shown beside the title; they wrap under it when there is no room. */
  badges?: ReactNode
  /** Meta row: icon plus text items. */
  meta?: ReactNode
  /** Extra content under the meta row, such as a note. */
  children?: ReactNode
  /**
   * Exception to the actions row: a card whose only action is one icon-only button and that has
   * no meta puts it at the end of the title row, and the title takes the remaining width.
   */
  inlineAction?: ReactNode
  /**
   * Actions row, divided from the card body. Text buttons stretch to the full width; icon-only
   * buttons keep their square size and sit at the end.
   */
  actions?: ReactNode
}

/** The one mobile (below 768px) list card: title row, meta row, then the actions row. */
export function ListCard({ title, badges, meta, children, actions, inlineAction }: ListCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className={inlineAction ? 'min-w-0 flex-1' : 'min-w-0 last:flex-1'}>{title}</div>
          {badges}
          {inlineAction}
        </div>
        {meta ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
            {meta}
          </div>
        ) : null}
        {children}
        {actions ? (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3 [&>button:not([data-size^=icon])]:w-full">
            {actions}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** A meta item: a decorative icon and text. */
export function MetaItem({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarIcon
  children: ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

/** Date and time range on one wrapping row. */
export function MetaDateTime({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <>
      <MetaItem icon={CalendarIcon}>{formatDate(startsAt)}</MetaItem>
      <MetaItem icon={ClockIcon}>{formatTimeRange(startsAt, endsAt)}</MetaItem>
    </>
  )
}
