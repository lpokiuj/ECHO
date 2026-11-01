import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InboxIcon } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { initialsOf, UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { messages } from '@/lib/messages'

describe('PageHeader', () => {
  it('renders title, description and the primary action', () => {
    render(<PageHeader title="Judul" description="Satu kalimat." action={<Button>Aksi</Button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Judul' })).toBeInTheDocument()
    expect(screen.getByText('Satu kalimat.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aksi' })).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('shows an icon, one sentence and a next action', () => {
    const { container } = render(
      <EmptyState
        icon={InboxIcon}
        title="Kosong"
        description="Belum ada apa pun."
        action={<Button>Buat</Button>}
      />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Belum ada apa pun.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buat' })).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('is an alert with a plain sentence and a working retry', async () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent(messages.states.genericError)
    await userEvent.click(screen.getByRole('button', { name: messages.common.retry }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows no retry button without a handler', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('ConfirmDialog', () => {
  function Harness({ onConfirm, pending = false }: { onConfirm: () => void; pending?: boolean }) {
    const [open, setOpen] = useState(true)
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Hapus jadwal Ibadah Raya?"
        description="Semua penugasan ikut terhapus."
        confirmLabel="Hapus"
        destructive
        pending={pending}
        onConfirm={onConfirm}
      />
    )
  }

  it('names what changes and calls onConfirm only on confirm', async () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    expect(screen.getByRole('alertdialog', { name: 'Hapus jadwal Ibadah Raya?' })).toBeVisible()
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Hapus' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the element that opened a state-driven dialog', async () => {
    function FromState() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Button onClick={() => setOpen(true)}>Buka</Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Judul"
            description="Isi"
            onConfirm={() => undefined}
          />
        </>
      )
    }
    render(<FromState />)
    const opener = screen.getByRole('button', { name: 'Buka' })
    await userEvent.click(opener)
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(opener).toHaveFocus()
  })

  it('does not call onConfirm on cancel and closes', async () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: messages.common.cancel }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('returns focus to the trigger when it closes', async () => {
    function WithTrigger() {
      const [open, setOpen] = useState(false)
      return (
        <ConfirmDialog
          trigger={<Button>Buka</Button>}
          open={open}
          onOpenChange={setOpen}
          title="Judul"
          description="Isi"
          onConfirm={vi.fn()}
        />
      )
    }
    render(<WithTrigger />)
    const trigger = screen.getByRole('button', { name: 'Buka' })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: messages.common.cancel }))
    expect(trigger).toHaveFocus()
  })

  it('disables both buttons while pending', () => {
    render(<Harness onConfirm={vi.fn()} pending />)
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeDisabled()
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled()
  })
})

describe('Button loading', () => {
  it('is disabled and busy', () => {
    render(<Button loading>Simpan</Button>)
    const b = screen.getByRole('button', { name: 'Simpan' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('aria-busy', 'true')
  })
})

describe('RoleBadge and UserAvatar', () => {
  it.each(Object.entries(messages.roles))('labels %s as %s', (role, label) => {
    render(<RoleBadge role={role as keyof typeof messages.roles} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('builds initials', () => {
    expect(initialsOf('Budi Santoso')).toBe('BS')
    expect(initialsOf('siti')).toBe('S')
    expect(initialsOf('  ')).toBe('?')
    expect(initialsOf('Ahmad bin Ali Hasan')).toBe('AH')
  })

  it('renders initials in the avatar', () => {
    render(<UserAvatar name="Siti Aminah" />)
    expect(screen.getByText('SA')).toBeInTheDocument()
  })
})
