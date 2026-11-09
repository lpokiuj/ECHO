import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { site } from '@/content/site'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'

const items = site.sections.faq.items

function renderAccordion() {
  return render(
    <Accordion type="single" collapsible>
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>,
  )
}

const trigger = (i: number) => screen.getByRole('button', { name: items[i]!.question })

describe('Accordion', () => {
  it('starts closed, Tab reaches the first trigger, Enter and Space toggle it', async () => {
    renderAccordion()
    expect(trigger(0)).toHaveAttribute('aria-expanded', 'false')
    await userEvent.tab()
    expect(trigger(0)).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(trigger(0)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(items[0]!.answer)).toBeVisible()
    await userEvent.keyboard('{Enter}')
    expect(trigger(0)).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard(' ')
    expect(trigger(0)).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard(' ')
    expect(trigger(0)).toHaveAttribute('aria-expanded', 'false')
  })

  it('moves focus between triggers with the arrow keys, Home and End', async () => {
    renderAccordion()
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    expect(trigger(1)).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(trigger(0)).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(trigger(items.length - 1)).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(trigger(0)).toHaveFocus()
  })

  it('opens one item at a time', async () => {
    renderAccordion()
    await userEvent.click(trigger(0))
    await userEvent.click(trigger(1))
    expect(trigger(0)).toHaveAttribute('aria-expanded', 'false')
    expect(trigger(1)).toHaveAttribute('aria-expanded', 'true')
  })
})
