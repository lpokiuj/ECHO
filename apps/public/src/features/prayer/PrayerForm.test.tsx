import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { site } from '@/content/site'
import { server } from '@/test/setup'
import { renderApp } from '@/test/render'
import { PRAYER_LIMITS } from './limits'

const copy = site.pages.prayer.form
const success = site.pages.prayer.success
const URL = '*/api/public/prayer-requests'

/** Records every POST body; answers with `respond`. */
function mockPrayer(respond: () => Response | Promise<Response>) {
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.post(URL, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>)
      return respond()
    }),
  )
  return bodies
}

const created = () => HttpResponse.json({ ok: true }, { status: 201 })

function fields() {
  return {
    name: screen.getByLabelText(/^Nama/),
    contact: screen.getByLabelText(/^Kontak/),
    content: screen.getByRole('textbox', { name: /^Pokok doa/ }),
    followUp: screen.getByRole('checkbox', { name: copy.followUpLabel }),
    consent: screen.getByRole('checkbox', { name: new RegExp(copy.consentLabel) }),
    submit: screen.getByRole('button', { name: copy.submit }),
  }
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  const f = fields()
  await user.click(f.name)
  await user.paste('e2e-test')
  await user.click(f.content)
  await user.paste('  Mohon doakan keluarga saya  ')
  await user.click(f.consent)
  return f
}

// Full-form interaction tests are slower than the 5 s default when the whole suite runs in parallel.
describe('PrayerForm', { timeout: 20_000 }, () => {
  it('sends a trimmed request and shows the success screen, then offers another', async () => {
    const user = userEvent.setup()
    const bodies = mockPrayer(created)
    renderApp('/doa')
    const f = await fillValid(user)
    await user.click(f.submit)

    const heading = await screen.findByRole('heading', { name: success.title })
    expect(heading).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(success.message)
    expect(bodies).toEqual([
      {
        content: 'Mohon doakan keluarga saya',
        consent: true,
        wantsFollowUp: false,
        name: 'e2e-test',
      },
    ])
    expect(screen.queryByRole('button', { name: copy.submit })).toBeNull()

    await user.click(screen.getByRole('button', { name: success.again }))
    const again = fields()
    expect(again.name).toHaveValue('')
    expect(again.content).toHaveValue('')
    expect(again.consent).not.toBeChecked()
    await waitFor(() => expect(again.name).toHaveFocus())
  })

  it('sends the typed contact even when follow-up is unchecked', async () => {
    const user = userEvent.setup()
    const bodies = mockPrayer(created)
    renderApp('/doa')
    const f = await fillValid(user)
    await user.type(f.contact, 'kontak saya')
    await user.click(f.submit)
    await screen.findByRole('heading', { name: success.title })
    expect(bodies[0]).toMatchObject({ contact: 'kontak saya', wantsFollowUp: false })
  })

  it.each([
    ['400', () => HttpResponse.json({ message: ['consent must be true'], statusCode: 400 }, { status: 400 }), site.errors.validation],
    ['429', () => HttpResponse.json({ statusCode: 429 }, { status: 429, headers: { 'Retry-After': '60' } }), site.errors.rateLimited],
    ['500', () => new HttpResponse(null, { status: 500 }), site.errors.server],
    ['network', () => HttpResponse.error(), site.errors.network],
  ])('shows the mapped %s message in an alert and keeps the form data', async (_label, respond, message) => {
    const user = userEvent.setup()
    mockPrayer(respond)
    renderApp('/doa')
    const f = await fillValid(user)
    await user.click(f.submit)

    const text = await screen.findByText(message)
    expect(text.closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByText(/consent must be true/)).toBeNull()
    expect(f.name).toHaveValue('e2e-test')
    expect(f.content).toHaveValue('  Mohon doakan keluarga saya  ')
    expect(f.consent).toBeChecked()
    expect(f.submit).toBeEnabled()
  })

  it('clears the banner and succeeds when the user submits again', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockPrayer(() => (++calls === 1 ? new HttpResponse(null, { status: 500 }) : created()))
    renderApp('/doa')
    const f = await fillValid(user)
    await user.click(f.submit)
    await screen.findByText(site.errors.server)
    await user.click(f.submit)
    await screen.findByRole('heading', { name: success.title })
    expect(screen.queryByText(site.errors.server)).toBeNull()
    expect(calls).toBe(2)
  })

  it('disables the submit button while sending and sends once', async () => {
    const user = userEvent.setup()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const bodies = mockPrayer(async () => {
      await gate
      return created()
    })
    renderApp('/doa')
    const f = await fillValid(user)
    await user.click(f.submit)

    const busy = await screen.findByRole('button', { name: copy.submitting })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    fireEvent.submit(busy.closest('form')!)
    await user.click(busy)
    release()
    await screen.findByRole('heading', { name: success.title })
    expect(bodies).toHaveLength(1)
  })

  it('requires contact only while follow-up is checked, and blocks the send', async () => {
    const user = userEvent.setup()
    const bodies = mockPrayer(created)
    renderApp('/doa')
    const f = await fillValid(user)
    expect(f.contact).not.toHaveAttribute('aria-required')

    await user.click(f.followUp)
    expect(f.contact).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText(/^Kontak/).closest('div')).toHaveTextContent(copy.requiredMark)
    await user.click(f.submit)

    const error = await screen.findByText(copy.errors.contactRequired)
    expect(f.contact).toHaveAttribute('aria-invalid', 'true')
    expect(f.contact.getAttribute('aria-describedby')).toContain(error.id)
    expect(bodies).toHaveLength(0)

    await user.click(f.followUp)
    await waitFor(() => expect(screen.queryByText(copy.errors.contactRequired)).toBeNull())
    expect(f.contact).not.toHaveAttribute('aria-required')
  })

  it('blocks an empty content and a missing consent without sending', async () => {
    const user = userEvent.setup()
    const bodies = mockPrayer(created)
    renderApp('/doa')
    await user.click(fields().submit)
    expect(await screen.findByText(copy.errors.contentRequired)).toBeInTheDocument()
    expect(screen.getByText(copy.errors.consentRequired)).toBeInTheDocument()
    expect(fields().consent).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toHaveLength(0)
  })

  it('counts trimmed characters, is not a live region and flags the over-limit state', async () => {
    const user = userEvent.setup()
    const bodies = mockPrayer(created)
    renderApp('/doa')
    const f = fields()
    const counter = (n: number) =>
      `${n} ${copy.counter.of} ${PRAYER_LIMITS.content} ${copy.counter.unit}`
    expect(screen.getByText(counter(0))).toBeInTheDocument()
    await user.type(f.content, ' abc ')
    const node = screen.getByText(counter(3))
    expect(node).not.toHaveAttribute('aria-live')
    expect(f.content.getAttribute('aria-describedby')).toContain(node.id)

    fireEvent.change(f.content, { target: { value: 'a'.repeat(PRAYER_LIMITS.content - 150) } })
    expect(screen.getByRole('status')).toHaveTextContent(copy.counterNearLimit(200))

    fireEvent.change(f.content, { target: { value: 'a'.repeat(PRAYER_LIMITS.content + 1) } })
    expect(screen.getByText(counter(PRAYER_LIMITS.content + 1))).toHaveClass('text-destructive')
    await user.click(f.consent)
    await user.click(f.submit)
    expect(
      await screen.findAllByText(copy.errors.contentTooLong(PRAYER_LIMITS.content)),
    ).not.toHaveLength(0)
    expect(bodies).toHaveLength(0)
  })

  it('has a honeypot that is hidden, unfocusable by Tab and not announced', async () => {
    const user = userEvent.setup()
    mockPrayer(created)
    const { container } = renderApp('/doa')
    const trap = container.querySelector<HTMLInputElement>('input#website')!
    expect(trap).toHaveAttribute('name', 'website')
    expect(trap).toHaveAttribute('tabindex', '-1')
    expect(trap).toHaveAttribute('autocomplete', 'off')
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()

    const f = fields()
    f.name.focus()
    for (let i = 0; i < 12; i++) {
      await user.tab()
      expect(trap).not.toHaveFocus()
    }
  })

  it('sends a filled honeypot as `website`, as typed', async () => {
    const user = userEvent.setup()
    const bodies = mockPrayer(created)
    const { container } = renderApp('/doa')
    const f = await fillValid(user)
    await user.type(container.querySelector<HTMLInputElement>('input#website')!, 'spam-bot')
    await user.click(f.submit)
    await screen.findByRole('heading', { name: success.title })
    expect(bodies[0]).toMatchObject({ website: 'spam-bot' })
  })
})
