import { Section } from '@/components/Section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { site } from '@/content/site'

/** Pertama Kali?: FAQ accordion for newcomers (one item open at a time, all closed at first). */
export function FaqSection() {
  const copy = site.sections.faq
  return (
    <Section id={copy.id} title={copy.title} intro={copy.intro} tone="muted">
      <Accordion
        type="single"
        collapsible
        className="bg-card max-w-3xl rounded-2xl border p-2 shadow-sm"
      >
        {copy.items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  )
}
