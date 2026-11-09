import { QrCodeIcon } from 'lucide-react'
import { Section } from '@/components/Section'
import { site } from '@/content/site'

/** Persembahan: bank and QRIS placeholder block. Never real numbers (content.test.ts enforces it). */
export function GivingSection() {
  const copy = site.sections.giving
  const rows = [copy.bank.bankName, copy.bank.accountName, copy.bank.accountNumber]
  return (
    <Section id={copy.id} title={copy.title} intro={copy.intro} tone="muted">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card rounded-2xl border p-6 sm:p-8">
          <h3 className="text-xl font-bold">{copy.bank.title}</h3>
          <dl className="mt-4 space-y-4">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-muted-foreground text-sm font-semibold">{row.label}</dt>
                <dd className="mt-1 text-lg font-bold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-card rounded-2xl border p-6 sm:p-8">
          <h3 className="text-xl font-bold">{copy.qris.title}</h3>
          <div className="border-border text-muted-foreground mt-4 flex aspect-square max-w-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center">
            <QrCodeIcon className="size-10" aria-hidden="true" />
            <p>{copy.qris.placeholder}</p>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-6 max-w-2xl">{copy.note}</p>
    </Section>
  )
}
