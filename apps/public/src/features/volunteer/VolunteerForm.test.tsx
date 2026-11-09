import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { site } from '@/content/site'
import { bidangExample, handlers } from '@/test/handlers'
import { renderApp } from '@/test/render'
import { server } from '@/test/setup'

const copy = site.pages.volunteer.form
const success = site.pages.volunteer.success
const URL = '*/api/public/volunteer-applications'

/** Records every POST body; answers with `respond`. */
function mockApplication(respond: () => Response | Promise<Response>) {
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
    fullName: screen.getByLabelText(/^Nama lengkap/),
    whatsapp: screen.getByLabelText(/^Nomor WhatsApp/),
    email: screen.getByLabelText(/^Email/),
    message: screen.getByRole('textbox', { name: /^Pesan/ }),
    consent: screen.getByRole('checkbox', { name: new RegExp(copy.consentLabel) }),
    submit: screen.getByRole('button', { name: copy.submit }),
  }
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  const f = fields()
  await user.click(f.fullName)
  await user.paste('  e2e-test  ')
  await user.click(f.whatsapp)
  await user.paste('08123')
  await user.click(f.consent)
  return f
}

describe('VolunteerForm', { timeout: 20_000 }, () => {
  it('lists the bidang and sends the chosen ids, then offers another', async () => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    const bodies = mockApplication(created)
    renderApp('/relawan')
    const group = await screen.findByRole('group', { name: new RegExp(copy.bidang.legend) })
    expect(group).toBeInTheDocument()
    await user.click(await screen.findByRole('checkbox', { name: bidangExample[0]!.name }))
    await user.click(screen.getByRole('checkbox', { name: bidangExample[1]!.name }))
    const f = await fillValid(user)
    await user.click(f.submit)

    const heading = await screen.findByRole('heading', { name: success.title })
    expect(heading).toHaveFocus()
    expect(bodies).toEqual([
      {
        fullName: 'e2e-test',
        whatsapp: '08123',
        consent: true,
        bidangIds: bidangExample.map((b) => b.id),
      },
    ])
    await user.click(screen.getByRole('button', { name: success.again }))
    expect(fields().fullName).toHaveValue('')
    expect(fields().consent).not.toBeChecked()
    await waitFor(() => expect(fields().fullName).toHaveFocus())
  })

  it('shows a loading state while the bidang load', async () => {
    server.use(
      http.get('*/api/public/bidang', async () => {
        await new Promise((resolve) => setTimeout(resolve, 150))
        return HttpResponse.json(bidangExample)
      }),
    )
    renderApp('/relawan')
    expect(screen.getByRole('status', { name: copy.bidang.loading })).toBeInTheDocument()
    expect(fields().submit).toBeEnabled()
    await screen.findByRole('group', { name: new RegExp(copy.bidang.legend) })
  })

  it('shows an empty note and no group when there are no bidang', async () => {
    server.use(http.get('*/api/public/bidang', () => HttpResponse.json([])))
    renderApp('/relawan')
    expect(await screen.findByText(copy.bidang.empty)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: new RegExp(copy.bidang.legend) })).toBeNull()
  })

  it.each([
    ['500', () => new HttpResponse(null, { status: 500 })],
    ['network', () => HttpResponse.error()],
  ])('still submits, without bidangIds, when the bidang call fails (%s)', async (_label, respond) => {
    const user = userEvent.setup()
    server.use(http.get('*/api/public/bidang', respond))
    const bodies = mockApplication(created)
    renderApp('/relawan')
    expect(await screen.findByText(copy.bidang.failed)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: new RegExp(copy.bidang.legend) })).toBeNull()
    const f = await fillValid(user)
    await user.click(f.submit)
    await screen.findByRole('heading', { name: success.title })
    expect(bodies[0]).not.toHaveProperty('bidangIds')
  })

  it.each([
    ['400', () => HttpResponse.json({ message: ['consent must be true'], statusCode: 400 }, { status: 400 }), site.errors.validation],
    ['429', () => HttpResponse.json({ statusCode: 429 }, { status: 429, headers: { 'Retry-After': '60' } }), site.errors.rateLimited],
    ['500', () => new HttpResponse(null, { status: 500 }), site.errors.server],
    ['network', () => HttpResponse.error(), site.errors.network],
  ])('shows the mapped %s message in an alert and keeps the form data', async (_label, respond, message) => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    mockApplication(respond)
    renderApp('/relawan')
    const box = await screen.findByRole('checkbox', { name: bidangExample[0]!.name })
    await user.click(box)
    const f = await fillValid(user)
    await user.click(f.submit)

    const text = await screen.findByText(message)
    expect(text.closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByText(/consent must be true/)).toBeNull()
    expect(f.fullName).toHaveValue('  e2e-test  ')
    expect(f.consent).toBeChecked()
    expect(box).toBeChecked()
    expect(f.submit).toBeEnabled()
  })

  it('clears the banner and succeeds when the user submits again', async () => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    let calls = 0
    mockApplication(() => (++calls === 1 ? new HttpResponse(null, { status: 500 }) : created()))
    renderApp('/relawan')
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
    server.use(handlers.bidang())
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const bodies = mockApplication(async () => {
      await gate
      return created()
    })
    renderApp('/relawan')
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

  it('blocks an invalid email without sending', async () => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    const bodies = mockApplication(created)
    renderApp('/relawan')
    const f = await fillValid(user)
    await user.type(f.email, 'bukan-email')
    await user.click(f.submit)
    const error = await screen.findByText(copy.errors.emailInvalid)
    expect(f.email).toHaveAttribute('aria-invalid', 'true')
    expect(f.email.getAttribute('aria-describedby')).toContain(error.id)
    expect(bodies).toHaveLength(0)
  })

  it('blocks missing name, WhatsApp and consent without sending', async () => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    const bodies = mockApplication(created)
    renderApp('/relawan')
    await user.click(fields().submit)
    expect(await screen.findByText(copy.errors.fullNameRequired)).toBeInTheDocument()
    expect(screen.getByText(copy.errors.whatsappRequired)).toBeInTheDocument()
    expect(screen.getByText(copy.errors.consentRequired)).toBeInTheDocument()
    expect(fields().consent).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toHaveLength(0)
  })

  it('blocks a message over the limit without sending', async () => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    const bodies = mockApplication(created)
    renderApp('/relawan')
    const f = await fillValid(user)
    fireEvent.change(f.message, { target: { value: 'a'.repeat(1001) } })
    await user.click(f.submit)
    expect(await screen.findByText(copy.errors.messageTooLong(1000))).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it('has a honeypot that is hidden, unfocusable by Tab and sent as `website`', async () => {
    const user = userEvent.setup()
    server.use(handlers.bidang())
    const bodies = mockApplication(created)
    const { container } = renderApp('/relawan')
    const trap = container.querySelector<HTMLInputElement>('input#website')!
    expect(trap).toHaveAttribute('name', 'website')
    expect(trap).toHaveAttribute('tabindex', '-1')
    expect(trap).toHaveAttribute('autocomplete', 'off')
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    fields().fullName.focus()
    for (let i = 0; i < 14; i++) {
      await user.tab()
      expect(trap).not.toHaveFocus()
    }
    const f = await fillValid(user)
    await user.type(trap, 'spam-bot')
    await user.click(f.submit)
    await screen.findByRole('heading', { name: success.title })
    expect(bodies[0]).toMatchObject({ website: 'spam-bot' })
  })
})
