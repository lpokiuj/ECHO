import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { messages } from '@/lib/messages'
import { DesignPage } from './DesignPage'

describe('DesignPage', () => {
  it('shows every component section and state', () => {
    render(<DesignPage />)
    const t = messages.design
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    for (const name of Object.values(t.sections)) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    // buttons incl. disabled and loading
    expect(screen.getByRole('button', { name: t.buttons.disabled })).toBeDisabled()
    expect(screen.getByRole('button', { name: t.buttons.loading })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    // form controls, labelled
    expect(screen.getByLabelText(t.form.nameLabel)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: t.form.teamLabel })).toBeInTheDocument()
    expect(screen.getByLabelText(t.form.disabledLabel)).toBeDisabled()
    expect(screen.getByLabelText(t.form.invalidLabel)).toHaveAttribute('aria-invalid', 'true')
    // tabs, role badges, empty and error states, table, confirm trigger, toast triggers
    expect(screen.getByRole('tab', { name: t.tabs.one })).toBeInTheDocument()
    expect(screen.getAllByText(messages.roles.MEMBER).length).toBeGreaterThan(0)
    expect(screen.getByText(t.empty.description)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(t.error.description)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.confirm.trigger })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.toasts.success })).toBeInTheDocument()
  })
})
