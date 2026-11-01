// Dev-only (DECISIONS D-003). Removed together with its route and nav link in feature 10.
import { CalendarXIcon, PlusIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge, type Role } from '@/components/RoleBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { messages } from '@/lib/messages'

const t = messages.design

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const people = t.list.people.map((name, i) => ({
  name,
  role: t.list.roles[i] as Role,
  team: t.list.teams[i]!,
}))

export function DesignPage() {
  useDocumentTitle(t.title)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  function confirm() {
    setPending(true)
    window.setTimeout(() => {
      setPending(false)
      setConfirmOpen(false)
      toast.success(t.confirm.done)
    }, 600)
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Button>
            <PlusIcon aria-hidden="true" />
            {t.primaryAction}
          </Button>
        }
      />

      <Section title={t.sections.buttons}>
        <div className="flex flex-wrap gap-3">
          <Button>{t.buttons.primary}</Button>
          <Button variant="secondary">{t.buttons.secondary}</Button>
          <Button variant="outline">{t.buttons.outline}</Button>
          <Button variant="ghost">{t.buttons.ghost}</Button>
          <Button variant="destructive">{t.buttons.destructive}</Button>
          <Button disabled>{t.buttons.disabled}</Button>
          <Button loading>{t.buttons.loading}</Button>
        </div>
      </Section>

      <Section title={t.sections.forms}>
        <form
          className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-name">{t.form.nameLabel}</Label>
            <Input id="design-name" placeholder={t.form.namePlaceholder} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-team">{t.form.teamLabel}</Label>
            <Select>
              <SelectTrigger id="design-team" className="w-full">
                <SelectValue placeholder={t.form.teamPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {t.form.teamOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-disabled">{t.form.disabledLabel}</Label>
            <Input id="design-disabled" disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-invalid">{t.form.invalidLabel}</Label>
            <Input id="design-invalid" aria-invalid="true" aria-describedby="design-invalid-msg" />
            <p id="design-invalid-msg" className="text-destructive text-sm">
              {t.form.invalidMessage}
            </p>
          </div>
        </form>
      </Section>

      <Section title={t.sections.badges}>
        <div className="flex flex-wrap items-center gap-3">
          {(Object.keys(messages.roles) as Role[]).map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
          <Badge variant="destructive">{t.buttons.destructive}</Badge>
          {t.list.people.map((n) => (
            <UserAvatar key={n} name={n} />
          ))}
        </div>
      </Section>

      <Section title={t.sections.tabs}>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">{t.tabs.one}</TabsTrigger>
            <TabsTrigger value="two">{t.tabs.two}</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="pt-3">
            {t.tabs.oneBody}
          </TabsContent>
          <TabsContent value="two" className="pt-3">
            {t.tabs.twoBody}
          </TabsContent>
        </Tabs>
      </Section>

      <Section title={t.sections.feedback}>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast.success(t.toasts.successText)}>
            {t.toasts.success}
          </Button>
          <Button variant="outline" onClick={() => toast.error(t.toasts.errorText)}>
            {t.toasts.error}
          </Button>
          <Button variant="outline" onClick={() => toast.info(t.toasts.infoText)}>
            {t.toasts.info}
          </Button>
        </div>
      </Section>

      <Section title={t.sections.loading}>
        <div className="flex flex-col gap-3">
          <ListSkeleton />
          <Skeleton className="h-10 w-48" />
        </div>
      </Section>

      <Section title={t.sections.empty}>
        <EmptyState
          icon={CalendarXIcon}
          title={t.empty.title}
          description={t.empty.description}
          action={<Button>{t.empty.action}</Button>}
        />
      </Section>

      <Section title={t.sections.error}>
        <ErrorState
          title={t.error.title}
          description={t.error.description}
          onRetry={() => toast.info(t.toasts.infoText)}
        />
      </Section>

      <Section title={t.sections.list}>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.list.name}</TableHead>
                <TableHead>{t.list.role}</TableHead>
                <TableHead>{t.list.team}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.name}>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <UserAvatar name={p.name} />
                      {p.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={p.role} />
                  </TableCell>
                  <TableCell>{p.team}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="flex flex-col gap-3 md:hidden">
          {people.map((p) => (
            <li key={p.name}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <UserAvatar name={p.name} />
                    {p.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <RoleBadge role={p.role} />
                  <span className="text-muted-foreground">{p.team}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.sections.confirm}>
        <div className="flex">
          <ConfirmDialog
            trigger={<Button variant="destructive">{t.confirm.trigger}</Button>}
            open={confirmOpen}
            onOpenChange={(o) => !pending && setConfirmOpen(o)}
            title={t.confirm.title}
            description={t.confirm.description}
            confirmLabel={t.confirm.action}
            destructive
            pending={pending}
            onConfirm={confirm}
          />
        </div>
      </Section>
    </div>
  )
}
